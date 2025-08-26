import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface HelpfulDocument {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  file_path: string;
  extracted_text?: string;
}

const HelpfulDocumentUpload = () => {
  const [documents, setDocuments] = useState<HelpfulDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHelpfulDocuments();
  }, []);

  const fetchHelpfulDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('global_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching helpful documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.type.includes('pdf') && !file.type.includes('document') && !file.type.includes('image')) {
      toast.error('Please upload PDF, document, or image files only');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = customName.trim() 
        ? `${customName.replace(/[^a-zA-Z0-9.-]/g, '_')}.${file.name.split('.').pop()}`
        : file.name;
      const filePath = `helpful-documents/${timestamp}_${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Extract text from PDFs using the edge function
      let extractedText = null;
      if (file.type === 'application/pdf') {
        try {
          const { data: extractData, error: extractError } = await supabase.functions
            .invoke('pdf-extractor', {
              body: { 
                filePath: filePath,
                bucket: 'documents'
              }
            });

          if (extractError) {
            console.warn('Text extraction failed:', extractError);
          } else {
            extractedText = extractData?.text;
          }
        } catch (extractError) {
          console.warn('Text extraction failed:', extractError);
        }
      }

      setUploadProgress(75);

      // Save document metadata to database
      const { data: docData, error: docError } = await supabase
        .from('global_documents')
        .insert({
          filename: fileName,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          extracted_text: extractedText
        })
        .select()
        .single();

      if (docError) throw docError;

      setUploadProgress(100);
      toast.success('Document uploaded successfully');
      setCustomName('');
      fetchHelpfulDocuments(); // Refresh the list
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (files: File[]) => {
    handleFileUpload(files);
  };

  const deleteDocument = async (doc: HelpfulDocument) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('global_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success('Document deleted successfully');
      fetchHelpfulDocuments(); // Refresh the list
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileSelect,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: false,
    disabled: uploading
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeColor = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (mimeType.includes('word')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (mimeType.includes('image')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Helpful Documents Management
        </CardTitle>
        <CardDescription>
          Upload documents that will be available to all base and pro users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Name Input */}
        <div>
          <Label htmlFor="customName">Custom Document Name (Optional)</Label>
          <Input
            id="customName"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter a custom name for the document"
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            If provided, this name will be used instead of the original filename
          </p>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          
          {uploading ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploading document...</p>
              <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop the document here' : 'Upload Helpful Document'}
              </p>
              <p className="text-sm text-muted-foreground">
                Drag and drop a PDF, Word document, or image, or click to select
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Maximum file size: 50MB
              </p>
            </div>
          )}
        </div>

        {/* Document List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Uploaded Documents</h3>
            <Badge variant="secondary">{documents.length} documents</Badge>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 border rounded-lg bg-muted/50">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">No documents uploaded</p>
              <p className="text-xs text-muted-foreground">Upload your first helpful document above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge className={getFileTypeColor(doc.mime_type)}>
                          {doc.mime_type.split('/')[1]?.toUpperCase()}
                        </Badge>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteDocument(doc)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HelpfulDocumentUpload;