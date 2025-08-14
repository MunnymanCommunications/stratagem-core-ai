// Enhanced PDF reading functionality for AI chat
import { supabase } from '@/integrations/supabase/client';

export interface DocumentContent {
  filename: string;
  content: string;
  metadata: {
    pages: number;
    size: number;
    type: string;
  };
}

// PDF content extraction using pdf-parse
export const extractPDFContent = async (filePath: string): Promise<string> => {
  try {
    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .download(filePath);

    if (error) {
      console.error('Error downloading PDF:', error);
      return 'Error: Could not download PDF file';
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Import pdf-parse dynamically for client-side usage
    const pdf = await import('pdf-parse/lib/pdf-parse.js');
    
    // Extract text from PDF
    const pdfData = await pdf.default(buffer);
    
    return pdfData.text || 'No text content found in PDF';
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    return 'Error: Could not extract text from PDF file';
  }
};

// Enhanced document context builder for AI
export const buildDocumentContext = (userDocs: any[], globalDocs: any[]): string => {
  let context = '\n\nAvailable Documents:\n';
  
  if (userDocs && userDocs.length > 0) {
    context += '\nUser Documents:\n';
    userDocs.forEach(doc => {
      context += `- ${doc.filename} (${doc.mime_type})\n`;
      // In the future, include actual content: ${doc.content}
    });
  }
  
  if (globalDocs && globalDocs.length > 0) {
    context += '\nCompany Documents:\n';
    globalDocs.forEach(doc => {
      context += `- ${doc.filename} (${doc.mime_type})\n`;
      // In the future, include actual content: ${doc.content}
    });
  }
  
  context += '\nNote: The AI can see document names and types but cannot read their actual content yet. This feature requires PDF parsing implementation.';
  
  return context;
};