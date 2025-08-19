import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Download, Save, FileText } from 'lucide-react';

interface DocumentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'proposal' | 'invoice';
  aiGeneratedContent: string;
  clientName?: string;
}

interface CompanyTemplate {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
}

const DocumentEditor = ({ 
  isOpen, 
  onClose, 
  documentType, 
  aiGeneratedContent,
  clientName = 'Client'
}: DocumentEditorProps) => {
  const [editableContent, setEditableContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [companyTemplate, setCompanyTemplate] = useState<CompanyTemplate | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Load saved template
      const templateKey = documentType === 'proposal' ? 'proposalTemplate' : 'invoiceTemplate';
      const savedTemplate = localStorage.getItem(templateKey);
      
      if (savedTemplate) {
        const template = JSON.parse(savedTemplate);
        setCompanyTemplate(template.companyInfo || null);
      }

      // Ensure AI content is properly formatted and set
      if (aiGeneratedContent && aiGeneratedContent.trim()) {
        // Clean up the AI content and format it properly
        let cleanContent = aiGeneratedContent
          .replace(/^#{1,6}\s*/gm, '<h3>') // Convert markdown headers to h3
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
          .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
          .replace(/\n\n/g, '</p><p>') // Paragraphs
          .replace(/\n/g, '<br>'); // Line breaks
        
        // Wrap in paragraphs if not already wrapped
        if (!cleanContent.startsWith('<')) {
          cleanContent = '<p>' + cleanContent + '</p>';
        }
        
        setEditableContent(cleanContent);
      } else {
        setEditableContent('<p>Please generate content first using the AI chat, then click on the highlighted Generate Proposal/Invoice button.</p>');
      }
      
      setDocumentTitle(`${documentType.charAt(0).toUpperCase() + documentType.slice(1)} for ${clientName}`);
    }
  }, [isOpen, aiGeneratedContent, documentType, clientName]);

  const generateHeader = () => {
    if (!companyTemplate) return '';
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
        <div>
          ${companyTemplate.logo ? `<img src="${companyTemplate.logo}" alt="Company Logo" style="max-height: 80px; margin-bottom: 15px;" />` : ''}
          <h1 style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0;">${companyTemplate.name}</h1>
          <p style="margin: 5px 0; color: #6b7280;">${companyTemplate.address}</p>
          <p style="margin: 5px 0; color: #6b7280;">Phone: ${companyTemplate.phone}</p>
          <p style="margin: 5px 0; color: #6b7280;">Email: ${companyTemplate.email}</p>
          ${companyTemplate.website ? `<p style="margin: 5px 0; color: #6b7280;">Website: ${companyTemplate.website}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 28px; font-weight: bold; color: #3b82f6; margin: 0; text-transform: uppercase;">
            ${documentType === 'proposal' ? 'PROPOSAL' : 'INVOICE'}
          </h2>
          <p style="margin: 10px 0; color: #6b7280;">Date: ${new Date().toLocaleDateString()}</p>
          <p style="margin: 5px 0; color: #6b7280;">Doc #: ${documentType.toUpperCase()}-${Date.now().toString().slice(-6)}</p>
        </div>
      </div>
    `;
  };

  const generateFooter = () => {
    if (!companyTemplate) return '';
    
    return `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
        <p>Thank you for your business!</p>
        <p>${companyTemplate.name} | ${companyTemplate.phone} | ${companyTemplate.email}</p>
      </div>
    `;
  };

  const getFullDocument = () => {
    const header = generateHeader();
    const footer = generateFooter();
    
    return `
      <div style="max-width: 800px; margin: 0 auto; padding: 40px; font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        ${header}
        <div style="margin: 30px 0;">
          ${editableContent}
        </div>
        ${footer}
      </div>
    `;
  };

  const saveDocument = () => {
    const documentData = {
      id: Date.now().toString(),
      type: documentType,
      title: documentTitle,
      content: getFullDocument(),
      clientName,
      amount: extractAmount(editableContent),
      createdAt: new Date().toISOString()
    };

    // Save to localStorage
    const existingDocs = JSON.parse(localStorage.getItem('generatedDocuments') || '[]');
    existingDocs.push(documentData);
    localStorage.setItem('generatedDocuments', JSON.stringify(existingDocs));

    toast.success(`${documentType.charAt(0).toUpperCase() + documentType.slice(1)} saved successfully!`);
    onClose();
  };

  const downloadPDF = () => {
    const fullContent = getFullDocument();
    
    // Create a blob with the HTML content
    const blob = new Blob([fullContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Document downloaded successfully!');
  };

  const extractAmount = (content: string): number => {
    // Try to extract dollar amounts from content
    const matches = content.match(/\$[\d,]+\.?\d*/g);
    if (matches) {
      const amounts = matches.map(match => parseFloat(match.replace(/[$,]/g, '')));
      return Math.max(...amounts);
    }
    return 0;
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    setEditableContent(e.currentTarget.innerHTML);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="documentTitle">Document Title</Label>
            <Input
              id="documentTitle"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Enter document title"
            />
          </div>

          <Separator />

          {/* Document Preview */}
          <div className="border rounded-lg overflow-hidden">
            {/* Header Preview */}
            {companyTemplate && (
              <div 
                className="p-6 bg-gray-50 border-b"
                dangerouslySetInnerHTML={{ __html: generateHeader() }}
              />
            )}

            {/* Editable Content */}
            <div 
              ref={contentRef}
              contentEditable
              onInput={handleContentChange}
              className="p-6 min-h-[300px] focus:outline-none focus:ring-2 focus:ring-blue-500 prose max-w-none"
              dangerouslySetInnerHTML={{ __html: editableContent }}
              style={{ 
                lineHeight: '1.6',
                fontFamily: 'Arial, sans-serif'
              }}
            />

            {/* Footer Preview */}
            {companyTemplate && (
              <div 
                className="p-6 bg-gray-50 border-t"
                dangerouslySetInnerHTML={{ __html: generateFooter() }}
              />
            )}
          </div>

          <div className="flex justify-between gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button onClick={saveDocument} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Document
              </Button>
              <Button onClick={downloadPDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentEditor;