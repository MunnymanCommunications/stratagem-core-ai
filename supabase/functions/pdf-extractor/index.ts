import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import * as pdfParse from 'https://esm.sh/pdf-parse@1.1.1';

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

    console.log('Extracting text from PDF:', filePath);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert blob to buffer for pdf-parse
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    console.log('PDF file size:', arrayBuffer.byteLength);
    console.log('Starting text extraction with pdf-parse...');
    
    // Use pdf-parse library for robust text extraction
    const pdfData = await pdfParse(buffer);
    let extractedText = pdfData.text;
    
    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim();
    
    // If no meaningful text extracted, provide informative message
    if (!extractedText || extractedText.length < 10) {
      extractedText = `PDF document uploaded (${Math.round(arrayBuffer.byteLength / 1024)}KB). Content extraction may require manual processing or the PDF may contain primarily images/graphics.`;
    }

    return new Response(JSON.stringify({ 
      success: true,
      content: extractedText.trim(),
      fileSize: arrayBuffer.byteLength
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