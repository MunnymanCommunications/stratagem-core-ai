import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  message: string;
  conversationHistory: Array<{
    role: string;
    content: string;
  }>;
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { message, conversationHistory, userId }: RequestBody = await req.json();

    console.log('Processing AI chat request for user:', userId);

    // Get user documents
    const { data: userDocs, error: userDocsError } = await supabase
      .from('user_documents')
      .select('filename, file_path, mime_type')
      .eq('user_id', userId);

    if (userDocsError) {
      console.error('Error fetching user documents:', userDocsError);
    }

    // Get global documents
    const { data: globalDocs, error: globalDocsError } = await supabase
      .from('global_documents')
      .select('filename, file_path, mime_type');

    if (globalDocsError) {
      console.error('Error fetching global documents:', globalDocsError);
    }

    // Get user profile info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email, company')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    // Get admin settings for global prompt
    const { data: adminSettings, error: adminError } = await supabase
      .from('admin_settings')
      .select('global_prompt')
      .limit(1)
      .single();

    if (adminError) {
      console.error('Error fetching admin settings:', adminError);
    }

    // Build context from documents with content extraction
    let documentsContext = '';
    
    if (userDocs && userDocs.length > 0) {
      documentsContext += '\n\nUser Documents Available:\n';
      for (const doc of userDocs) {
        documentsContext += `- ${doc.filename} (${doc.mime_type})\n`;
        
        // Extract content for PDFs and text files
        if (doc.mime_type === 'application/pdf') {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('user-uploads')
              .download(doc.file_path);
            
            if (!downloadError && fileData) {
              // For edge function, we need to implement PDF parsing here
              // For now, we'll indicate the file is available but content extraction
              // needs to be implemented on the client side
              documentsContext += `  Content: [PDF content available - ${Math.round(fileData.size / 1024)}KB]\n`;
            }
          } catch (error) {
            console.error('Error processing document:', error);
          }
        }
      }
    }

    if (globalDocs && globalDocs.length > 0) {
      documentsContext += '\n\nCompany Documents Available:\n';
      for (const doc of globalDocs) {
        documentsContext += `- ${doc.filename} (${doc.mime_type})\n`;
        
        if (doc.mime_type === 'application/pdf') {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('global-uploads')
              .download(doc.file_path);
            
            if (!downloadError && fileData) {
              documentsContext += `  Content: [PDF content available - ${Math.round(fileData.size / 1024)}KB]\n`;
            }
          } catch (error) {
            console.error('Error processing global document:', error);
          }
        }
      }
    }

    // Build user context
    let userContext = '';
    if (profile) {
      userContext = `\n\nUser Information:\nName: ${profile.full_name}\nEmail: ${profile.email}\nCompany: ${profile.company || 'Not specified'}`;
    }

    // Get conversation history context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nConversation History:\n';
      conversationHistory.slice(-10).forEach(msg => { // Last 10 messages for context
        historyContext += `${msg.role}: ${msg.content}\n`;
      });
    }

    // Build system prompt
    let systemPrompt = adminSettings?.global_prompt || 'You are a helpful AI assistant named Harvey. You help users with their business needs including generating proposals, invoices, and providing business advice.';
    
    // Replace template variables
    systemPrompt = systemPrompt
      .replace(/\{\{company_name\}\}/g, profile?.company || 'your company')
      .replace(/\{\{user_name\}\}/g, profile?.full_name || 'there')
      .replace(/\{\{user_email\}\}/g, profile?.email || '')
      .replace(/\{\{conversation_history\}\}/g, historyContext)
      .replace(/\{\{documents\}\}/g, documentsContext);

    systemPrompt += documentsContext + userContext + '\n\nWhen generating proposals or invoices, use the available documents to include accurate pricing, services, and company information. Always be helpful and professional.';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Include recent conversation history
      { role: 'user', content: message }
    ];

    console.log('Calling OpenAI API with', messages.length, 'messages');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Handle streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      response: "I'm having trouble connecting to my AI services right now. Please try again in a moment."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});