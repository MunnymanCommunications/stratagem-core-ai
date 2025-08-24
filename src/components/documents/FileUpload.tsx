import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, File, X, CheckCircle } from 'lucide-react';
import { extractPDFContent } from '@/supabase/pdf-reader';

interface FileUploadProps {
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  title?: string;
  description?: string;
  documentType?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  id: string;
}

const FileUpload = ({
  onUploadComplete,
  maxFiles = 5,
  acceptedFileTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
  title = "Upload Documents",
  description = "Drag and drop files here or click to browse"
}: FileUploadProps) => {
  const { user } = useAuth();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast.error('Please sign in to upload files');
      return;
    }

    const filesToUpload = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
      id: Math.random().toString(36).substr(2, 9)
    }));

    setUploadingFiles(prev => [...prev, ...filesToUpload]);

    for (const uploadingFile of filesToUpload) {
      try {
        const { file } = uploadingFile;
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${file.name}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Extract text from PDF if it's a PDF file
        let extractedText = null;
        if (file.type === 'application/pdf') {
          try {
            setUploadingFiles(prev =>
              prev.map(f =>
                f.id === uploadingFile.id
                  ? { ...f, progress: 50 }
                  : f
              )
            );
            
            extractedText = await extractPDFContent(uploadData.path, 'documents');
            
            if (extractedText && extractedText.length > 50 && !extractedText.startsWith('No readable text') && !extractedText.includes('PDF extraction failed')) {
              console.log('PDF text extracted successfully, length:', extractedText.length);
            } else {
              console.warn('PDF extraction returned minimal or no content:', extractedText?.substring(0, 100));
              extractedText = null; // Don't store poor quality extractions
            }
          } catch (error) {
            console.error('Error extracting PDF text:', error);
            extractedText = null;
          }
        }

        // Save file metadata to database
        const { error: dbError } = await supabase
          .from('user_documents')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            extracted_text: extractedText
          });

        if (dbError) throw dbError;

        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, status: 'complete', progress: 100 }
              : f
          )
        );

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, status: 'error' }
              : f
          )
        );
        toast.error(`Failed to upload ${uploadingFile.file.name}`);
      }
    }

    onUploadComplete?.();
  }, [user, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxFiles
  });

  const removeUploadingFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? 'Drop files here...' : 'Upload your documents'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop files or click to browse
          </p>
          <Button variant="outline">Browse Files</Button>
          <p className="text-xs text-muted-foreground mt-4">
            Supported formats: {acceptedFileTypes.join(', ')}
          </p>
        </div>

        {uploadingFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium">Uploading Files</h4>
            {uploadingFiles.map((uploadingFile) => (
              <div key={uploadingFile.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <File className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadingFile.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {uploadingFile.status === 'uploading' && (
                      <>
                        <Progress value={uploadingFile.progress} className="flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {Math.round(uploadingFile.progress)}%
                        </span>
                      </>
                    )}
                    {uploadingFile.status === 'complete' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">Complete</span>
                      </div>
                    )}
                    {uploadingFile.status === 'error' && (
                      <span className="text-xs text-red-600">Upload failed</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUploadingFile(uploadingFile.id)}
                  disabled={uploadingFile.status === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;