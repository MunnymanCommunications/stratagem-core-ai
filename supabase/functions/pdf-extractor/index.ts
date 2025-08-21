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
    
    // More robust PDF text extraction
    const uint8Array = new Uint8Array(arrayBuffer);
    let extractedText = '';
    
    // Convert to string for processing
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    console.log('PDF file size:', arrayBuffer.byteLength);
    console.log('Starting text extraction...');
    
    // Method 1: Extract text from content streams
    const contentStreamRegex = /stream\s*\n([\s\S]*?)\s*endstream/gi;
    const contentStreams = [];
    let match;
    
    while ((match = contentStreamRegex.exec(pdfString)) !== null) {
      contentStreams.push(match[1]);
    }
    
    console.log('Found', contentStreams.length, 'content streams');
    
    // Method 2: Look for text objects and operators
    for (const stream of contentStreams) {
      // Find BT...ET blocks (text objects)
      const textObjectRegex = /BT\s*([\s\S]*?)\s*ET/gi;
      let textMatch;
      
      while ((textMatch = textObjectRegex.exec(stream)) !== null) {
        const textContent = textMatch[1];
        
        // Extract text from Tj operators: (text)Tj
        const tjMatches = textContent.match(/\(((?:[^\\)]|\\.)*)(\s*)Tj/gi);
        if (tjMatches) {
          tjMatches.forEach(tj => {
            const textMatch = tj.match(/\(((?:[^\\)]|\\.)*)/);
            if (textMatch && textMatch[1]) {
              let text = textMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\')
                .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
              
              if (text.trim() && text.length > 1 && !/^[\s\d\.,\-\+]+$/.test(text)) {
                extractedText += text + ' ';
              }
            }
          });
        }
        
        // Extract text from TJ operators: [(text1)(text2)]TJ
        const tjArrayMatches = textContent.match(/\[((?:[^\]]|\](?!\s*TJ))*)\]\s*TJ/gi);
        if (tjArrayMatches) {
          tjArrayMatches.forEach(tj => {
            const arrayContent = tj.match(/\[((?:[^\]]|\](?!\s*TJ))*)\]/);
            if (arrayContent && arrayContent[1]) {
              const textMatches = arrayContent[1].match(/\(((?:[^\\)]|\\.)*)\)/g);
              if (textMatches) {
                textMatches.forEach(textItem => {
                  const text = textItem.slice(1, -1) // Remove parentheses
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\(/g, '(')
                    .replace(/\\\)/g, ')')
                    .replace(/\\\\/g, '\\');
                  
                  if (text.trim() && text.length > 1 && !/^[\s\d\.,\-\+]+$/.test(text)) {
                    extractedText += text + ' ';
                  }
                });
              }
            }
          });
        }
      }
    }
    
    // Fallback: Look for any text in parentheses that might be readable
    if (!extractedText.trim()) {
      console.log('No text found in streams, trying fallback method...');
      const fallbackMatches = pdfString.match(/\(([^)]{3,})\)/g);
      if (fallbackMatches) {
        const seenTexts = new Set();
        fallbackMatches.forEach(match => {
          const text = match.slice(1, -1).trim();
          if (text.length > 2 && 
              !/^[\d\s\.,\-\+\/\\]+$/.test(text) && 
              !/^[A-F0-9\s]+$/.test(text) && 
              !seenTexts.has(text.toLowerCase())) {
            seenTexts.add(text.toLowerCase());
            extractedText += text + ' ';
          }
        });
      }
    }
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim();
    
    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    
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