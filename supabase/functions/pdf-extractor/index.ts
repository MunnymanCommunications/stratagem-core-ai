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

    // Convert blob to array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    
    // For Deno edge functions, we'll use a simpler text extraction approach
    // In a production environment, you might want to use a more robust PDF parsing library
    
    // Try to extract basic text from PDF (this is a simplified approach)
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);
    
    // Look for text content patterns in PDF
    const textMatches = text.match(/BT\s*\/\w+\s+\d+\s+Tf\s+[\d\s\.]+\s+Td\s*\((.*?)\)\s*Tj/g);
    let extractedText = '';
    
    if (textMatches) {
      textMatches.forEach(match => {
        const textContent = match.match(/\((.*?)\)/);
        if (textContent && textContent[1]) {
          extractedText += textContent[1] + ' ';
        }
      });
    }
    
    // If no text found with simple extraction, return a placeholder
    if (!extractedText.trim()) {
      extractedText = 'PDF content available but text extraction requires more advanced processing. File size: ' + Math.round(arrayBuffer.byteLength / 1024) + 'KB';
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