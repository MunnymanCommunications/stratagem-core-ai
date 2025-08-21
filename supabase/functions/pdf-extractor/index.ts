import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

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

    // Convert blob to buffer and extract text
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    console.log('PDF file size:', arrayBuffer.byteLength);
    console.log('Starting text extraction...');
    
    // Convert buffer to string for text extraction
    const pdfString = new TextDecoder('latin1').decode(buffer);
    
    // Extract text from PDF streams
    let extractedText = '';
    
    // Look for text objects in PDF
    const textRegex = /BT\s+(.*?)\s+ET/gs;
    const matches = pdfString.match(textRegex);
    
    if (matches) {
      for (const match of matches) {
        // Extract text from parentheses and brackets
        const textInParens = match.match(/\((.*?)\)/g);
        const textInBrackets = match.match(/\[(.*?)\]/g);
        
        if (textInParens) {
          for (const text of textInParens) {
            const cleanText = text.replace(/[()]/g, '');
            if (cleanText.length > 0 && !/^[0-9\s\.\-\+]+$/.test(cleanText)) {
              extractedText += cleanText + ' ';
            }
          }
        }
        
        if (textInBrackets) {
          for (const text of textInBrackets) {
            const cleanText = text.replace(/[\[\]]/g, '');
            if (cleanText.length > 0 && !/^[0-9\s\.\-\+]+$/.test(cleanText)) {
              extractedText += cleanText + ' ';
            }
          }
        }
      }
    }
    
    // Also look for simple text patterns
    const simpleTextRegex = /Tj\s*\n?\s*\((.*?)\)/g;
    let match;
    while ((match = simpleTextRegex.exec(pdfString)) !== null) {
      const text = match[1];
      if (text && text.length > 0 && !/^[0-9\s\.\-\+]+$/.test(text)) {
        extractedText += text + ' ';
      }
    }
    
    console.log('Raw extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
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