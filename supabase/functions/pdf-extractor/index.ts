import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  filePath: string;
  bucket: string;
}

// Extract text from PDF using pdf.js
async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    console.log('Extracting text from PDF using pdf.js...');
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum} of ${pdf.numPages}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `Page ${pageNum}:\n${pageText}\n\n`;
    }
    
    if (!fullText.trim()) {
      return `PDF Document: ${fileName}

File processed but no extractable text content found. This may be an image-based PDF or contain non-text elements.

The document has been uploaded successfully and can be referenced in conversations.`;
    }
    
    console.log(`Successfully extracted ${fullText.length} characters from ${pdf.numPages} pages`);
    return fullText.trim();
    
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    
    // Fallback to basic summary if extraction fails
    return `PDF Document: ${fileName}

Text extraction encountered an error, but the document has been uploaded successfully.
Error: ${error.message}

The document is available for reference in conversations.`;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { filePath, bucket }: RequestBody = await req.json();

    console.log('Processing PDF file:', filePath);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Get file info
    const arrayBuffer = await fileData.arrayBuffer();
    const fileName = filePath.split('/').pop() || 'document.pdf';
    
    console.log('PDF file size:', arrayBuffer.byteLength);
    
    // Extract text from PDF 
    const extractedText = await extractTextFromPDF(arrayBuffer, fileName);
    
    console.log('Successfully processed PDF');
    
    return new Response(JSON.stringify({ 
      success: true,
      content: extractedText,
      fileSize: arrayBuffer.byteLength,
      pagesProcessed: 'multiple'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in pdf-extractor function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});