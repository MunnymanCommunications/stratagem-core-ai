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
    
    // Enhanced PDF text extraction approach
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder('latin1').decode(uint8Array);
    
    let extractedText = '';
    
    // Method 1: Extract text using stream operators (more comprehensive)
    const streamMatches = text.match(/BT[\s\S]*?ET/g);
    if (streamMatches) {
      streamMatches.forEach(stream => {
        // Look for text showing operators
        const textShowMatches = stream.match(/\((.*?)\)\s*Tj/g) || 
                              stream.match(/\[(.*?)\]\s*TJ/g) ||
                              stream.match(/\((.*?)\)\s*'/g);
        
        if (textShowMatches) {
          textShowMatches.forEach(match => {
            const content = match.match(/[\(\[](.*)[\)\]]/)?.[1];
            if (content) {
              // Clean up text content
              let cleanContent = content
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\');
              
              extractedText += cleanContent + ' ';
            }
          });
        }
      });
    }
    
    // Method 2: Look for plain text patterns if Method 1 didn't work
    if (!extractedText.trim()) {
      const plainTextMatches = text.match(/\(([^)]+)\)/g);
      if (plainTextMatches) {
        plainTextMatches.forEach(match => {
          const content = match.slice(1, -1); // Remove parentheses
          if (content.length > 2 && !content.match(/^[\d\s\.]+$/)) {
            extractedText += content + ' ';
          }
        });
      }
    }
    
    // Method 3: Extract text between specific markers
    if (!extractedText.trim()) {
      const markerMatches = text.match(/>\s*([A-Za-z][^<>]*?)\s*</g);
      if (markerMatches) {
        markerMatches.forEach(match => {
          const content = match.replace(/[<>]/g, '').trim();
          if (content.length > 2) {
            extractedText += content + ' ';
          }
        });
      }
    }
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-printable characters
      .trim();
    
    // If no text found with any method, return a descriptive placeholder
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