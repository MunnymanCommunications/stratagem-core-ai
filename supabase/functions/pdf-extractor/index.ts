import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Use a more reliable PDF processing approach
async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    console.log('Processing PDF with text extraction...');
    
    // Convert ArrayBuffer to Uint8Array for processing
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Basic PDF text extraction - look for text objects in PDF
    const pdfText = new TextDecoder().decode(uint8Array);
    
    // Extract readable text using regex patterns for PDF text objects
    const textMatches = pdfText.match(/\((.*?)\)/g) || [];
    const extractedText = textMatches
      .map(match => match.replace(/[()]/g, ''))
      .filter(text => text.length > 2 && /[a-zA-Z]/.test(text))
      .join(' ');
    
    if (extractedText.length > 50) {
      console.log(`Successfully extracted ${extractedText.length} characters of text`);
      return `PDF Document: ${fileName}\n\nExtracted Content:\n${extractedText}`;
    }
    
    // If no readable text found, return basic info
    return `PDF Document: ${fileName}\n\nFile Size: ${Math.round(arrayBuffer.byteLength / 1024)}KB\n\nThis PDF has been uploaded successfully. The document appears to be image-based or contains formatted content that requires specialized parsing. The file is available for reference in conversations.`;
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    
    return `PDF Document: ${fileName}\n\nFile Size: ${Math.round(arrayBuffer.byteLength / 1024)}KB\n\nThe document has been uploaded successfully but text extraction encountered an error. The file is available for reference in conversations.\n\nError: ${error.message}`;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  filePath: string;
  bucket: string;
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
    
    // Store extracted text in user_documents table
    const { error: updateError } = await supabase
      .from('user_documents')
      .update({ extracted_text: extractedText })
      .eq('file_path', filePath);
    
    if (updateError) {
      console.error('Failed to update document with extracted text:', updateError);
    } else {
      console.log('Extracted text stored in database');
    }
    
    return new Response(JSON.stringify({
      success: true,
      content: extractedText,
      fileSize: arrayBuffer.byteLength,
      pagesProcessed: 'basic'
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