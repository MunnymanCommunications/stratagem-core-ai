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

// Helper function to convert PDF to base64 for GPT-4 Vision
function pdfToBase64(pdfBuffer: Uint8Array): string {
  try {
    // Convert PDF buffer directly to base64
    const base64 = btoa(String.fromCharCode(...pdfBuffer));
    return base64;
  } catch (error) {
    console.error('Error converting PDF to base64:', error);
    throw error;
  }
}

// Helper function to extract text from PDF using GPT-4 Vision directly
async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  
  console.log('Extracting text from PDF using GPT-4 Vision...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text content from this PDF document. Return only the text without any additional commentary or formatting. Preserve the original text structure and formatting as much as possible. If there are multiple pages, separate them clearly.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }
    
    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';
    
    return extractedText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
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

    console.log('Extracting text from PDF using GPT-4 Vision:', filePath);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    console.log('PDF file size:', arrayBuffer.byteLength);
    console.log('Converting PDF to base64...');
    
    // Convert PDF to base64
    const pdfBase64 = pdfToBase64(buffer);
    
    console.log('PDF converted to base64');
    
    // Extract text from PDF using GPT-4 Vision
    const extractedText = await extractTextFromPDF(pdfBase64);
    
    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    
    // If no meaningful text extracted, provide informative message
    const finalText = extractedText.length > 20 ? extractedText : 
      `PDF document uploaded (${Math.round(arrayBuffer.byteLength / 1024)}KB). Text extraction completed but minimal text found. Document may contain primarily images or graphics.`;

    return new Response(JSON.stringify({ 
      success: true,
      content: finalText,
      fileSize: arrayBuffer.byteLength,
      pagesProcessed: 1
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