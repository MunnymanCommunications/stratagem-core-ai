// Enhanced PDF reading functionality for AI chat
import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface DocumentContent {
  filename: string;
  content: string;
  metadata: {
    pages: number;
    size: number;
    type: string;
  };
}

// PDF content extraction using pdf.js
export const extractPDFContent = async (filePath: string, bucket: string = 'user-uploads'): Promise<string> => {
  try {
    console.log('Extracting content from PDF:', filePath);
    
    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error('Error downloading PDF:', error);
      return 'Error: Could not download PDF file';
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim() || 'No text content found in PDF';
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    return 'Error: Could not extract text from PDF file - ' + error.message;
  }
};

// Enhanced document context builder for AI with actual content
export const buildDocumentContext = async (userDocs: any[], globalDocs: any[]): Promise<string> => {
  let context = '\n\nAvailable Documents:\n';
  
  if (userDocs && userDocs.length > 0) {
    context += '\nUser Documents:\n';
    for (const doc of userDocs) {
      context += `- ${doc.filename} (${doc.mime_type})\n`;
      
      // Extract actual content for PDFs
      if (doc.mime_type === 'application/pdf') {
        try {
          const content = await extractPDFContent(doc.file_path, 'user-uploads');
          if (content && !content.startsWith('Error:')) {
            // Limit content to first 1000 characters to avoid token limits
            const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            context += `  Content Preview: ${truncatedContent}\n`;
          } else {
            context += `  Content: Unable to extract text\n`;
          }
        } catch (error) {
          console.error('Error extracting document content:', error);
          context += `  Content: Unable to extract text\n`;
        }
      }
    }
  }
  
  if (globalDocs && globalDocs.length > 0) {
    context += '\nCompany Documents:\n';
    for (const doc of globalDocs) {
      context += `- ${doc.filename} (${doc.mime_type})\n`;
      
      // Extract actual content for PDFs
      if (doc.mime_type === 'application/pdf') {
        try {
          const content = await extractPDFContent(doc.file_path, 'global-uploads');
          if (content && !content.startsWith('Error:')) {
            // Limit content to first 1000 characters to avoid token limits
            const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            context += `  Content Preview: ${truncatedContent}\n`;
          } else {
            context += `  Content: Unable to extract text\n`;
          }
        } catch (error) {
          console.error('Error extracting global document content:', error);
          context += `  Content: Unable to extract text\n`;
        }
      }
    }
  }
  
  if (!userDocs?.length && !globalDocs?.length) {
    context += '\nNo documents currently uploaded. The AI can help with general business tasks but cannot reference specific company documents or pricing.';
  }
  
  return context;
};