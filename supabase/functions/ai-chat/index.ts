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
  structuredData?: {
    projectDriver: string;
    priorities: string;
    budget: string;
    storageAndCameras: string;
    decisionMaker: string;
    siteLayout: string;
    siteImages: string[];
    projectRoadmap: string;
    additionalNotes: string;
  };
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

    const { message, conversationHistory, userId, structuredData }: RequestBody = await req.json();

    console.log('Processing AI chat request for user:', userId);

    // Get admin settings first to get API key
    const { data: adminSettings, error: adminError } = await supabase
      .from('admin_settings')
      .select('global_prompt, general_assistant_id, ai_model, api_key_encrypted')
      .limit(1)
      .single();

    if (adminError) {
      console.error('Error fetching admin settings:', adminError);
    }

    // Get API key from admin settings or fall back to environment variable
    const OPENAI_API_KEY = adminSettings?.api_key_encrypted || Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Please set it in Admin Settings or environment variables.');
    }

    console.log('Using API key from:', adminSettings?.api_key_encrypted ? 'admin settings' : 'environment variables');

    // Get user documents with extracted text
    const { data: userDocs, error: userDocsError } = await supabase
      .from('user_documents')
      .select('filename, file_path, mime_type, extracted_text')
      .eq('user_id', userId);

    if (userDocsError) {
      console.error('Error fetching user documents:', userDocsError);
    }

    // Get global documents with extracted text
    const { data: globalDocs, error: globalDocsError } = await supabase
      .from('global_documents')
      .select('filename, file_path, mime_type, extracted_text');

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

    if (adminError) {
      console.error('Error fetching admin settings:', adminError);
    }

    // Build context from documents with actual content extraction
    let documentsContext = '';
    
    if (userDocs && userDocs.length > 0) {
      documentsContext += '\n\nUser Documents Available:\n';
      for (const doc of userDocs) {
        documentsContext += `- ${doc.filename} (${doc.mime_type})\n`;
        
        console.log(`Document: ${doc.filename}, extracted_text length: ${doc.extracted_text?.length || 0}`);
        console.log(`First 100 chars: ${doc.extracted_text?.substring(0, 100) || 'No extracted text'}`);
        
        // Use stored extracted text if available and it's not garbage data
        if (doc.extracted_text && doc.extracted_text.length > 50 && !doc.extracted_text.includes('endstream') && !doc.extracted_text.includes('xref')) {
          const truncatedContent = doc.extracted_text.length > 1500 ? 
            doc.extracted_text.substring(0, 1500) + '...' : doc.extracted_text;
          documentsContext += `  Content: ${truncatedContent}\n`;
        } else if (doc.mime_type === 'application/pdf') {
          documentsContext += `  Content: [PDF text extraction failed - please re-upload document]\n`;
        } else if (doc.extracted_text) {
          documentsContext += `  Content: ${doc.extracted_text}\n`;
        }
      }
    }

    if (globalDocs && globalDocs.length > 0) {
      documentsContext += '\n\nCompany Documents Available:\n';
      for (const doc of globalDocs) {
        documentsContext += `- ${doc.filename} (${doc.mime_type})\n`;
        
        console.log(`Global Document: ${doc.filename}, extracted_text length: ${doc.extracted_text?.length || 0}`);
        console.log(`First 100 chars: ${doc.extracted_text?.substring(0, 100) || 'No extracted text'}`);
        
        // Use stored extracted text if available and it's not garbage data
        if (doc.extracted_text && doc.extracted_text.length > 50 && !doc.extracted_text.includes('endstream') && !doc.extracted_text.includes('xref')) {
          const truncatedContent = doc.extracted_text.length > 1500 ? 
            doc.extracted_text.substring(0, 1500) + '...' : doc.extracted_text;
          documentsContext += `  Content: ${truncatedContent}\n`;
        } else if (doc.mime_type === 'application/pdf') {
          documentsContext += `  Content: [PDF text extraction failed - please re-upload document]\n`;
        } else if (doc.extracted_text) {
          documentsContext += `  Content: ${doc.extracted_text}\n`;
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

    // Prepare user content for OpenAI (handle images if present)
    let userContent: any = message;
    if (structuredData && structuredData.siteImages && structuredData.siteImages.length > 0) {
      userContent = [
        { type: 'text', text: message },
        ...structuredData.siteImages.map(imageData => ({
          type: 'image_url',
          image_url: { url: imageData }
        }))
      ];
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Include recent conversation history
      { role: 'user', content: userContent }
    ];

    console.log('Calling OpenAI API with', messages.length, 'messages');
    console.log('Assistant ID configured:', adminSettings?.general_assistant_id);

    // Use assistant if configured, otherwise use regular chat completion
    let response;
    let useAssistant = false;
    
    if (adminSettings?.general_assistant_id) {
      try {
        console.log('Attempting to use OpenAI Assistant:', adminSettings.general_assistant_id);
        
        // Use OpenAI Assistants API - create thread and run
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: userContent }]
          })
        });

        console.log('Thread creation response status:', threadResponse.status);

        if (!threadResponse.ok) {
          const errorText = await threadResponse.text();
          console.error('Failed to create thread. Status:', threadResponse.status, 'Error:', errorText);
          console.log('Falling back to chat completion due to thread creation failure');
          useAssistant = false;
        } else {
          const thread = await threadResponse.json();
          console.log('Thread created successfully:', thread.id);
          
          // Create run with streaming
          const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
              assistant_id: adminSettings.general_assistant_id,
              stream: true
            })
          });
          
          console.log('Run creation response status:', runResponse.status);
          
          if (!runResponse.ok) {
            const errorText = await runResponse.text();
            console.error('Assistant run failed. Status:', runResponse.status, 'Error:', errorText);
            console.log('Falling back to chat completion due to run failure');
            useAssistant = false;
          } else {
            console.log('Assistant run created successfully, using streaming response');
            response = runResponse;
            useAssistant = true;
          }
        }
      } catch (error) {
        console.error('Assistant API error:', error);
        console.log('Falling back to chat completion due to exception');
        useAssistant = false;
      }
    } else {
      console.log('No assistant ID configured, using chat completion');
    }
    
    if (!useAssistant) {
      // Use regular chat completion with proper model handling
      const model = adminSettings?.ai_model || 'gpt-4o-mini';
      
      // For newer models like GPT-5, use max_completion_tokens and remove temperature
      const isNewerModel = model.includes('gpt-5') || 
                           model.includes('gpt-4.1') || 
                           model.includes('o3') || 
                           model.includes('o4');

      const requestBody: any = {
        model: model,
        messages: messages,
        stream: true
      };

      if (isNewerModel) {
        requestBody.max_completion_tokens = 1500;
      } else {
        requestBody.max_tokens = 1500;
        requestBody.temperature = 0.7;
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    }

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
                  
                  // Handle Assistant API streaming format
                  if (useAssistant) {
                    if (parsed.event === 'thread.message.delta') {
                      const content = parsed.data?.delta?.content?.[0]?.text?.value;
                      if (content) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                      }
                    } else if (parsed.event === 'thread.run.completed') {
                      controller.close();
                      return;
                    } else if (parsed.event === 'thread.run.failed') {
                      console.error('Assistant run failed:', parsed.data);
                      controller.close();
                      return;
                    }
                  } else {
                    // Handle regular chat completion streaming format
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                    }
                  }
                } catch (e) {
                  console.log('Failed to parse streaming data:', e, 'Raw data:', data);
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