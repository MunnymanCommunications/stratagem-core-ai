import { Button } from '@/components/ui/button';
import { FileText, Receipt, Send } from 'lucide-react';

interface QuickActionsProps {
  onQuickAction: (action: string, prompt: string) => void;
}

const QuickActions = ({ onQuickAction }: QuickActionsProps) => {
  const quickActions = [
    {
      id: 'generate-proposal',
      label: 'Generate Proposal',
      icon: FileText,
      prompt: 'Generate a professional proposal based on our conversation. Use my uploaded proposal templates for formatting and include relevant services from my pricing document. Make sure to include project timeline, deliverables, and pricing.'
    },
    {
      id: 'generate-invoice',
      label: 'Generate Invoice',
      icon: Receipt,
      prompt: 'Generate an invoice based on the services we discussed. Use my company information and pricing document to create an accurate invoice with the correct pricing and branding.'
    }
  ];

  return (
    <div className="flex gap-2 mb-4">
      {quickActions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          onClick={() => onQuickAction(action.id, action.prompt)}
          className="bg-transparent border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors"
        >
          <action.icon className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;