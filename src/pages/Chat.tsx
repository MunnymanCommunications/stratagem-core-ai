import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Bot, User, Plus, FileText } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const Chat = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation);
    }
  }, [currentConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const createNewConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user?.id,
          title: 'New Conversation'
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentConversation(data.id);
      setConversations(prev => [data, ...prev]);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create new conversation');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentConversation || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // Add user message to database
      const { data: userMessageData, error: userError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation,
          user_id: user?.id,
          role: 'user',
          content: userMessage
        })
        .select()
        .single();

      if (userError) throw userError;

      // Add user message to UI immediately
      setMessages(prev => [...prev, {
        id: userMessageData.id,
        role: userMessageData.role as 'user' | 'assistant',
        content: userMessageData.content,
        created_at: userMessageData.created_at
      }]);

      // Simulate AI response (replace with actual AI API call)
      const aiResponse = "I'm a simulated AI response. In a real implementation, this would connect to your AI model API with the uploaded documents as context.";

      // Add AI response to database
      const { data: aiMessageData, error: aiError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation,
          user_id: user?.id,
          role: 'assistant',
          content: aiResponse
        })
        .select()
        .single();

      if (aiError) throw aiError;

      // Add AI message to UI
      setMessages(prev => [...prev, {
        id: aiMessageData.id,
        role: aiMessageData.role as 'user' | 'assistant',
        content: aiMessageData.content,
        created_at: aiMessageData.created_at
      }]);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
        await supabase
          .from('chat_conversations')
          .update({ title })
          .eq('id', currentConversation);
        
        setConversations(prev => prev.map(conv => 
          conv.id === currentConversation ? { ...conv, title } : conv
        ));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Conversations Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Conversations</CardTitle>
                  <Button onClick={createNewConversation} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <div className="space-y-2 p-4">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => setCurrentConversation(conversation.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          currentConversation === conversation.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <p className="font-medium truncate">{conversation.title}</p>
                        <p className="text-xs opacity-70">
                          {new Date(conversation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No conversations yet. Start a new one!
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Assistant
                  <Badge variant="secondary">Beta</Badge>
                </CardTitle>
              </CardHeader>
              
              {currentConversation ? (
                <>
                  <CardContent className="flex-1 p-0">
                    <ScrollArea className="h-[calc(100vh-16rem)] p-4">
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {message.role === 'assistant' && (
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-primary-foreground" />
                              </div>
                            )}
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              <p className="text-xs opacity-70 mt-2">
                                {new Date(message.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            {message.role === 'user' && (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <div className="bg-muted p-3 rounded-lg">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                  
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                      />
                      <Button onClick={sendMessage} disabled={!inputMessage.trim() || isLoading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Welcome to your AI Assistant</h3>
                    <p className="text-muted-foreground mb-4">
                      Start a new conversation to begin chatting with your AI assistant.
                    </p>
                    <Button onClick={createNewConversation}>
                      <Plus className="h-4 w-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Chat;