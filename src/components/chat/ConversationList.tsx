import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentConversation: string | null;
  onConversationSelect: (id: string) => void;
  onConversationDeleted: () => void;
}

const ConversationList = ({ 
  conversations, 
  currentConversation, 
  onConversationSelect,
  onConversationDeleted 
}: ConversationListProps) => {
  const [hoveredConversation, setHoveredConversation] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null);

  const deleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingConversation(conversationId);
    
    try {
      // Delete messages first
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Delete conversation
      const { error: conversationError } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) throw conversationError;

      toast.success('Conversation deleted successfully');
      onConversationDeleted();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingConversation(null);
    }
  };

  return (
    <div className="space-y-2 p-4">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onConversationSelect(conversation.id)}
          onMouseEnter={() => setHoveredConversation(conversation.id)}
          onMouseLeave={() => setHoveredConversation(null)}
          className={`relative p-3 rounded-lg cursor-pointer transition-colors group ${
            currentConversation === conversation.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{conversation.title}</p>
              <p className="text-xs opacity-70">
                {new Date(conversation.created_at).toLocaleDateString()}
              </p>
            </div>
            
            {(hoveredConversation === conversation.id || deletingConversation === conversation.id) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => deleteConversation(conversation.id, e)}
                disabled={deletingConversation === conversation.id}
                className="ml-2 h-6 w-6 p-0 opacity-70 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
      {conversations.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No conversations yet. Start a new one!
        </p>
      )}
    </div>
  );
};

export default ConversationList;