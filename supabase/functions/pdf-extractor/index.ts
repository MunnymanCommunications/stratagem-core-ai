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

// Helper function to convert PDF to images using pdf.js
async function pdfToImages(pdfBuffer: Uint8Array): Promise<string[]> {
  try {
    // Import pdf.js with specific version that works in Deno
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.js');
    
    // Safely disable worker for Deno environment
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    const images: string[] = [];
    
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) { // Limit to 5 pages
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      
      // Create canvas
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Could not get canvas context');
        continue;
      }
      
      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to base64 image
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      images.push(base64);
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
}

// Helper function to extract text from images using GPT-4 Vision
async function extractTextFromImages(images: string[]): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  
  let extractedText = '';
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    
    console.log(`Extracting text from page ${i + 1}...`);
    
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
                  text: 'Extract all text content from this PDF page. Return only the text without any additional commentary or formatting. Preserve the original text structure and formatting as much as possible.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`OpenAI API error for page ${i + 1}:`, errorData);
        continue;
      }
      
      const data = await response.json();
      const pageText = data.choices?.[0]?.message?.content || '';
      
      if (pageText.trim()) {
        extractedText += `\n\n--- Page ${i + 1} ---\n${pageText.trim()}`;
      }
      
    } catch (error) {
      console.error(`Error processing page ${i + 1}:`, error);
      continue;
    }
  }
  
  return extractedText.trim();
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
    console.log('Converting PDF to images...');
    
    // Convert PDF pages to images
    const images = await pdfToImages(buffer);
    
    if (images.length === 0) {
      throw new Error('Could not convert PDF to images');
    }
    
    console.log(`Converted ${images.length} pages to images`);
    
    // Extract text from images using GPT-4 Vision
    const extractedText = await extractTextFromImages(images);
    
    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 chars:', extractedText.substring(0, 200));
    
    // If no meaningful text extracted, provide informative message
    const finalText = extractedText.length > 20 ? extractedText : 
      `PDF document uploaded (${Math.round(arrayBuffer.byteLength / 1024)}KB). Text extraction completed but minimal text found. Document may contain primarily images or graphics.`;

    return new Response(JSON.stringify({ 
      success: true,
      content: finalText,
      fileSize: arrayBuffer.byteLength,
      pagesProcessed: images.length
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