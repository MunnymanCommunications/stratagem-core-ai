import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { filePath, bucket }: RequestBody = await req.json();
    
    console.log(`Processing PDF with OpenAI enhancement: ${filePath}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the PDF file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    console.log(`PDF file size: ${fileData.size}`);

    // Convert PDF to text first, then enhance with OpenAI
    console.log('Converting PDF to text...');
    
    // Get the array buffer from the file data
    const arrayBuffer = await fileData.arrayBuffer();
    
    // First, try basic text extraction from PDF
    let rawText = '';
    try {
      // Use a simple PDF text extraction approach
      const uint8Array = new Uint8Array(arrayBuffer);
      const decoder = new TextDecoder('utf-8');
      const pdfString = decoder.decode(uint8Array);
      
      // Extract text between parentheses and other readable content
      const textMatches = pdfString.match(/\([^)]+\)/g) || [];
      rawText = textMatches.map(match => match.slice(1, -1)).join(' ');
      
      // Also try to extract other readable text patterns
      const otherMatches = pdfString.match(/[A-Za-z][A-Za-z0-9\s,.!?-]{10,}/g) || [];
      if (otherMatches.length > 0) {
        rawText += ' ' + otherMatches.join(' ');
      }
      
      console.log(`Extracted ${rawText.length} characters of raw text`);
    } catch (error) {
      console.error('Basic PDF extraction failed:', error);
    }

    if (!rawText || rawText.length < 10) {
      throw new Error('Unable to extract readable text from PDF');
    }

    // Use OpenAI to clean and structure the extracted text
    console.log('Enhancing text extraction with OpenAI...');
    
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at cleaning and structuring extracted PDF text. Remove any garbled characters, fix spacing issues, and organize the content in a readable format while preserving all meaningful information.'
          },
          {
            role: 'user',
            content: `Please clean and structure this extracted PDF text, removing any garbled characters and improving readability while preserving all meaningful content:\n\n${rawText}`
          }
        ],
        max_tokens: 4000
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${errorText}`);
    }

    const openAIResult = await openAIResponse.json();
    const extractedText = openAIResult.choices[0]?.message?.content || '';

    if (!extractedText.trim()) {
      throw new Error('No text content extracted from PDF');
    }

    // Clean the extracted text to ensure it's safe for database storage
    const cleanedText = extractedText
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    console.log(`Successfully extracted ${cleanedText.length} characters of text using OpenAI enhancement`);

    return new Response(JSON.stringify({
      success: true,
      content: cleanedText,
      fileSize: fileData.size,
      extractionMethod: 'openai-enhanced'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in PDF Vision extractor:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      extractionMethod: 'openai-enhanced'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});