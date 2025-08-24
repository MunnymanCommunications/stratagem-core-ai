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

interface ProcessingMetrics {
  startTime: number;
  endTime?: number;
  tokensUsed?: number;
  processingMethod?: string;
  success: boolean;
  errorType?: string;
  retryCount: number;
}

// Utility function for structured logging
function logWithMetrics(level: 'info' | 'warn' | 'error', message: string, metrics?: Partial<ProcessingMetrics>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metrics
  };
  console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`, metrics ? JSON.stringify(metrics) : '');
}

// Enhanced PDF text extraction using proper PDF parsing techniques
async function convertPDFToImages(arrayBuffer: ArrayBuffer): Promise<string[]> {
  try {
    logWithMetrics('info', 'Starting enhanced PDF text extraction');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    let extractedText = '';
    
    // Convert to string for pattern matching
    const decoder = new TextDecoder('latin1'); // Latin1 preserves byte values
    const pdfString = decoder.decode(uint8Array);
    
    // Method 1: Extract text from TJ operators (text showing operators)
    const tjMatches = pdfString.match(/\[(.*?)\]\s*TJ/g) || [];
    const textFromTJ = tjMatches.map(match => {
      const content = match.match(/\[(.*?)\]/)?.[1] || '';
      // Clean up the content
      return content.replace(/[()]/g, '').replace(/\\\\/g, '').trim();
    }).filter(text => text.length > 0 && /[a-zA-Z0-9]/.test(text));
    
    if (textFromTJ.length > 0) {
      extractedText += textFromTJ.join(' ') + ' ';
      logWithMetrics('info', 'Extracted text from TJ operators', { count: textFromTJ.length });
    }
    
    // Method 2: Extract text from Tj operators (simple text showing)
    const tjSimpleMatches = pdfString.match(/\((.*?)\)\s*Tj/g) || [];
    const textFromTjSimple = tjSimpleMatches.map(match => {
      const content = match.match(/\((.*?)\)/)?.[1] || '';
      return content.replace(/\\[rn]/g, ' ').trim();
    }).filter(text => text.length > 0 && /[a-zA-Z0-9]/.test(text));
    
    if (textFromTjSimple.length > 0) {
      extractedText += textFromTjSimple.join(' ') + ' ';
      logWithMetrics('info', 'Extracted text from Tj operators', { count: textFromTjSimple.length });
    }
    
    // Method 3: Extract from parentheses (traditional method as fallback)
    const parenMatches = pdfString.match(/\([^)]{3,}\)/g) || [];
    const textFromParens = parenMatches.map(match => {
      return match.slice(1, -1) // Remove parentheses
        .replace(/\\[rn]/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .trim();
    }).filter(text => text.length > 2 && /[a-zA-Z0-9]/.test(text));
    
    if (textFromParens.length > 0) {
      extractedText += textFromParens.join(' ') + ' ';
      logWithMetrics('info', 'Extracted text from parentheses', { count: textFromParens.length });
    }
    
    // Method 4: Extract from stream content with better filtering
    const streamMatches = pdfString.match(/stream\s*([\s\S]*?)\s*endstream/g) || [];
    streamMatches.forEach((stream, index) => {
      const streamContent = stream.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
      
      // Look for text patterns in streams
      const streamText = streamContent.match(/\([^)]{3,}\)/g) || [];
      streamText.forEach(text => {
        const cleaned = text.slice(1, -1).replace(/\\[rn]/g, ' ').trim();
        if (cleaned.length > 3 && /[a-zA-Z]/.test(cleaned)) {
          extractedText += cleaned + ' ';
        }
      });
      
      // Also look for readable ASCII in streams
      const readableChars = streamContent.match(/[a-zA-Z0-9\s.,;:!?$%-]{10,}/g) || [];
      readableChars.forEach(text => {
        const cleaned = text.trim();
        if (cleaned.length > 10 && /[a-zA-Z]/.test(cleaned)) {
          extractedText += cleaned + ' ';
        }
      });
    });
    
    // Clean and normalize the extracted text
    let cleanedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,;:!?$%()-]/g, ' ') // Remove special chars but keep common punctuation
      .replace(/\s+/g, ' ') // Normalize again
      .trim();
    
    // Remove duplicate phrases (common in PDF extraction)
    const words = cleanedText.split(' ');
    const uniqueWords = [...new Set(words)];
    if (uniqueWords.length < words.length * 0.7) {
      // If more than 30% duplicates, deduplicate
      cleanedText = uniqueWords.join(' ');
    }
    
    logWithMetrics('info', 'PDF text extraction completed', { 
      extractedLength: cleanedText.length,
      tjMatches: tjMatches.length,
      tjSimpleMatches: tjSimpleMatches.length,
      parenMatches: parenMatches.length,
      streamMatches: streamMatches.length
    });
    
    // Return meaningful content or indicate if extraction failed
    if (cleanedText.length > 20 && /[a-zA-Z]/.test(cleanedText)) {
      return [cleanedText];
    } else {
      logWithMetrics('warn', 'Minimal text extracted, PDF may be image-based or encrypted');
      return ['PDF appears to contain minimal readable text. Document may be image-based or require OCR processing.'];
    }
    
  } catch (error) {
    logWithMetrics('error', 'PDF text extraction failed', { 
      errorType: 'extraction_error',
      errorMessage: error.message 
    });
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

// Enhanced retry logic with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      logWithMetrics('warn', `Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms`, {
        retryCount: attempt + 1,
        errorType: error.message?.includes('rate') ? 'rate_limit' : 'api_error'
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Chunk text to stay within token limits
function chunkText(text: string, maxChunkSize: number = 8000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '.';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const metrics: ProcessingMetrics = {
    startTime: Date.now(),
    success: false,
    retryCount: 0
  };

  try {
    const { filePath, bucket }: RequestBody = await req.json();
    
    logWithMetrics('info', `Starting PDF processing with GPT-5 Vision`, { 
      filePath, 
      bucket,
      startTime: metrics.startTime 
    });

    // Initialize services
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      const error = 'OpenAI API key not configured - check Supabase secrets';
      logWithMetrics('error', error, { errorType: 'configuration_error' });
      throw new Error(error);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file with error handling
    logWithMetrics('info', 'Downloading file from Supabase Storage');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      const error = `File download failed: ${downloadError.message}`;
      logWithMetrics('error', error, { errorType: 'storage_error' });
      throw new Error(error);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2);
    
    logWithMetrics('info', `File downloaded successfully`, { 
      fileSize: `${fileSizeMB}MB`,
      bytes: arrayBuffer.byteLength 
    });

    // Extract and process PDF text
    const extractedTexts = await convertPDFToImages(arrayBuffer);
    
    if (!extractedTexts.length || !extractedTexts[0]) {
      throw new Error('No readable content found in PDF');
    }

    // Process with GPT-5 Mini for text enhancement
    logWithMetrics('info', 'Processing extracted text with GPT-5 Mini');
    
    const allProcessedText: string[] = [];
    let totalTokensUsed = 0;

    for (let i = 0; i < extractedTexts.length; i++) {
      const rawText = extractedTexts[i];
      
      // Skip if no meaningful content
      if (rawText === 'No readable text found in PDF' || rawText.length < 10) {
        logWithMetrics('warn', 'Skipping empty or minimal content');
        continue;
      }
      
      // Chunk text to avoid token limits
      const chunks = chunkText(rawText, 8000); // Conservative for GPT-5
      
      for (const chunk of chunks) {
        try {
          const processedResult = await retryWithBackoff(async () => {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-5-mini-2025-08-07',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an expert document processor. Clean, structure, and enhance the extracted PDF text while preserving all meaningful information. Fix formatting issues, remove garbled characters, and ensure readability. If the text contains tables or structured data, preserve the structure. Return only the cleaned, readable content without adding any commentary.'
                  },
                  {
                    role: 'user',
                    content: `Clean and structure this extracted PDF text, preserving all meaningful content:\n\n${chunk}`
                  }
                ],
                max_completion_tokens: 4000,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              logWithMetrics('error', `OpenAI API error: ${response.status}`, { 
                errorType: response.status === 429 ? 'rate_limit' : 'api_error',
                responseStatus: response.status 
              });
              throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            return response.json();
          }, 3, 2000);

          const processedText = processedResult.choices[0]?.message?.content || '';
          if (processedText.trim()) {
            allProcessedText.push(processedText.trim());
          }

          // Track token usage for monitoring
          totalTokensUsed += processedResult.usage?.total_tokens || 0;
          
          logWithMetrics('info', `Processed text chunk ${allProcessedText.length}`, {
            chunkLength: chunk.length,
            outputLength: processedText.length,
            tokensUsed: processedResult.usage?.total_tokens || 0
          });

        } catch (chunkError) {
          logWithMetrics('warn', `Chunk processing failed, using original text`, {
            errorType: 'chunk_processing_error',
            chunkIndex: i,
            error: chunkError.message
          });
          // Use original chunk as fallback
          if (chunk.trim().length > 10) {
            allProcessedText.push(chunk.trim());
          }
        }
      }
    }

    if (!allProcessedText.length) {
      throw new Error('No text content could be processed');
    }

    // Combine and clean final text
    const finalText = allProcessedText.join('\n\n')
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    metrics.endTime = Date.now();
    metrics.success = true;
    metrics.tokensUsed = totalTokensUsed;
    metrics.processingMethod = 'gpt-5-mini-text-enhancement';

    const processingTime = (metrics.endTime - metrics.startTime) / 1000;

    logWithMetrics('info', `PDF processing completed successfully`, {
      processingTimeSeconds: processingTime,
      finalTextLength: finalText.length,
      totalTokensUsed,
      chunksProcessed: allProcessedText.length,
      success: true
    });

    return new Response(JSON.stringify({
      success: true,
      content: finalText,
      fileSize: arrayBuffer.byteLength,
      extractionMethod: 'gpt-5-mini-text-enhancement',
      processingMetrics: {
        processingTimeMs: metrics.endTime - metrics.startTime,
        tokensUsed: totalTokensUsed,
        chunksProcessed: allProcessedText.length,
        fileSizeMB: parseFloat(fileSizeMB)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    metrics.endTime = Date.now();
    metrics.success = false;
    metrics.errorType = error.message?.includes('rate') ? 'rate_limit' : 
                       error.message?.includes('configuration') ? 'configuration_error' :
                       error.message?.includes('storage') ? 'storage_error' : 'processing_error';

    const processingTime = (metrics.endTime - metrics.startTime) / 1000;

    logWithMetrics('error', `PDF processing failed after ${processingTime}s`, {
      ...metrics,
      processingTimeSeconds: processingTime,
      errorMessage: error.message
    });
    
    // Return user-friendly error messages
    let userMessage = 'Document processing failed. Please try again.';
    let statusCode = 500;

    if (error.message?.includes('rate')) {
      userMessage = 'Service temporarily busy. Please wait a moment and try again.';
      statusCode = 429;
    } else if (error.message?.includes('configuration')) {
      userMessage = 'Service configuration error. Please contact support.';
      statusCode = 503;
    } else if (error.message?.includes('storage')) {
      userMessage = 'File could not be accessed. Please re-upload the document.';
      statusCode = 404;
    } else if (error.message?.includes('No readable content')) {
      userMessage = 'Document appears to be empty or unreadable. Please check the file format.';
      statusCode = 422;
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      errorType: metrics.errorType,
      extractionMethod: 'gpt-5-mini-text-enhancement',
      processingMetrics: {
        processingTimeMs: metrics.endTime - metrics.startTime,
        success: false
      }
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});