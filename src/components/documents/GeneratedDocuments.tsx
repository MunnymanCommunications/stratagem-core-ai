import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Mail, Edit, FileText, Receipt, Trash2 } from 'lucide-react';

interface GeneratedDocument {
  id: string;
  type: 'proposal' | 'invoice';
  title: string;
  content: string;
  clientName: string;
  amount?: number;
  generatedAt: Date;
}

const GeneratedDocuments = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);

  useEffect(() => {
    // Load documents from localStorage
    const saved = localStorage.getItem('generatedDocuments');
    if (saved) {
      const parsedDocs = JSON.parse(saved).map((doc: any) => ({
        ...doc,
        generatedAt: new Date(doc.generatedAt)
      }));
      setDocuments(parsedDocs);
    }
  }, []);

  const saveDocuments = (docs: GeneratedDocument[]) => {
    localStorage.setItem('generatedDocuments', JSON.stringify(docs));
    setDocuments(docs);
  };

  const deleteDocument = (id: string) => {
    const updatedDocs = documents.filter(doc => doc.id !== id);
    saveDocuments(updatedDocs);
  };

  const downloadDocument = (doc: GeneratedDocument) => {
    const element = document.createElement('a');
    const file = new Blob([doc.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${doc.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const emailDocument = (doc: GeneratedDocument) => {
    const subject = encodeURIComponent(`${doc.type === 'proposal' ? 'Proposal' : 'Invoice'}: ${doc.title}`);
    const body = encodeURIComponent(`Dear ${doc.clientName},\n\nPlease find the attached ${doc.type}.\n\n${doc.content}\n\nBest regards`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generated Documents
          </CardTitle>
          <CardDescription>AI-generated proposals and invoices will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
            <p className="text-muted-foreground">
              Use the quick action buttons in the chat to generate proposals and invoices
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generated Documents
        </CardTitle>
        <CardDescription>AI-generated proposals and invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {doc.type === 'proposal' ? (
                    <FileText className="h-8 w-8 text-blue-500" />
                  ) : (
                    <Receipt className="h-8 w-8 text-green-500" />
                  )}
                  <div>
                    <h4 className="font-medium">{doc.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      Client: {doc.clientName}
                    </p>
                    {doc.amount && (
                      <p className="text-sm font-medium text-green-600">
                        ${doc.amount.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={doc.type === 'proposal' ? 'default' : 'secondary'}>
                    {doc.type === 'proposal' ? 'Proposal' : 'Invoice'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted rounded p-3 mb-3">
                <p className="text-sm line-clamp-3">{doc.content}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Generated {doc.generatedAt.toLocaleDateString()} at {doc.generatedAt.toLocaleTimeString()}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(doc)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => emailDocument(doc)}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default GeneratedDocuments;