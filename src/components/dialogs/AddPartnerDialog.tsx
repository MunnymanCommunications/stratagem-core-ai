import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddPartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPartner: (partner: any) => void;
}

const AddPartnerDialog = ({ open, onOpenChange, onAddPartner }: AddPartnerDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    domain: '',
    tier: 'basic',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPartner = {
      id: Date.now(),
      name: formData.name,
      domain: formData.domain,
      status: 'Active',
      users: 0,
      customizations: formData.tier === 'premium' ? 'Full Branding' : 'Basic Branding',
      email: formData.email,
      company: formData.company,
      tier: formData.tier,
      description: formData.description,
    };

    onAddPartner(newPartner);
    onOpenChange(false);
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      company: '',
      domain: '',
      tier: 'basic',
      description: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Partner</DialogTitle>
          <DialogDescription>
            Add a new white-label partner to your platform
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Partner Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@company.com"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              placeholder="Company Name"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="domain">Custom Domain</Label>
            <Input
              id="domain"
              value={formData.domain}
              onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="partner.example.com"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="tier">Partnership Tier</Label>
            <Select 
              value={formData.tier} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, tier: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic - Limited Customization</SelectItem>
                <SelectItem value="premium">Premium - Full Branding</SelectItem>
                <SelectItem value="enterprise">Enterprise - Custom Features</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the partnership..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add Partner
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPartnerDialog;