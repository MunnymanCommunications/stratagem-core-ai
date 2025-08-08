import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Brain, Key, Users, FileText, Save, CreditCard } from 'lucide-react';
import GlobalDocumentUpload from '@/components/documents/GlobalDocumentUpload';

interface AdminSettings {
  id: string;
  ai_model: string;
  chat_completions_url: string;
  global_prompt: string;
  max_base_documents: number;
  max_pro_documents: number;
  max_enterprise_documents: number;
  price_base_cents: number;
  price_pro_cents: number;
  price_enterprise_cents: number;
  stripe_price_id_base: string | null;
  stripe_price_id_pro: string | null;
  stripe_price_id_enterprise: string | null;
  api_key_encrypted: string;
}

const Admin = () => {
const { user } = useAuth();
const [settings, setSettings] = useState<AdminSettings | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [apiKey, setApiKey] = useState('');
const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);

useEffect(() => {
  fetchSettings();
  fetchStripeStatus();
}, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // If no settings exist, create default ones
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
        } else {
          throw error;
        }
      } else {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      toast.error('Failed to load admin settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-config-status');
      if (error) throw error;
      setStripeConfigured(Boolean(data?.configured));
    } catch (error) {
      console.error('Error checking Stripe status:', error);
      toast.error('Failed to check Stripe configuration');
      setStripeConfigured(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .insert({
          ai_model: 'gpt-4o-mini',
          chat_completions_url: 'https://api.openai.com/v1/chat/completions',
          global_prompt: `You are a helpful AI assistant for DesignR AI Platform. You have access to the following user information:

- Company: {{company}}
- Name: {{full_name}}
- Email: {{email}}

You can reference uploaded documents to help with business tasks, generate invoices based on pricing documents, and provide assistance with various business operations. Always be professional and helpful.`,
          max_base_documents: 1,
          max_pro_documents: 5
        })
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error creating default settings:', error);
      toast.error('Failed to create default settings');
    }
  };

  const updateSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const updateData: any = {
        ai_model: settings.ai_model,
        chat_completions_url: settings.chat_completions_url,
        global_prompt: settings.global_prompt,
        max_base_documents: settings.max_base_documents,
        max_pro_documents: settings.max_pro_documents,
        max_enterprise_documents: settings.max_enterprise_documents,
        price_base_cents: settings.price_base_cents,
        price_pro_cents: settings.price_pro_cents,
        price_enterprise_cents: settings.price_enterprise_cents,
        stripe_price_id_base: settings.stripe_price_id_base,
        stripe_price_id_pro: settings.stripe_price_id_pro,
        stripe_price_id_enterprise: settings.stripe_price_id_enterprise,
      };

      // Only include API key if it's been changed
      if (apiKey.trim()) {
        updateData.api_key_encrypted = apiKey;
      }

      const { error } = await supabase
        .from('admin_settings')
        .update(updateData)
        .eq('id', settings.id);

      if (error) throw error;
      toast.success('Admin settings updated successfully');
      setApiKey(''); // Clear the API key field
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Loading Admin Settings...</h2>
          </div>
        </div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Failed to Load Settings</h2>
            <Button onClick={fetchSettings}>Retry</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure global platform settings and AI parameters
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Configuration
              </CardTitle>
              <CardDescription>
                Configure AI model and API settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="aiModel">AI Model</Label>
                <Select 
                  value={settings.ai_model} 
                  onValueChange={(value) => setSettings(prev => prev ? { ...prev, ai_model: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4O Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4O</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                    <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="chatUrl">Chat Completions URL</Label>
                <Input
                  id="chatUrl"
                  value={settings.chat_completions_url || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, chat_completions_url: e.target.value } : null)}
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter new API key (leave blank to keep current)"
                />
                {settings.api_key_encrypted && (
                  <p className="text-xs text-muted-foreground mt-1">
                    API key is currently configured
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Limits
              </CardTitle>
              <CardDescription>
                Configure document upload limits by subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="baseLimit">Base Tier Document Limit</Label>
                <Input
                  id="baseLimit"
                  type="number"
                  value={settings.max_base_documents}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, max_base_documents: parseInt(e.target.value) } : null)}
                  min="1"
                />
              </div>

              <div>
                <Label htmlFor="proLimit">Pro Tier Document Limit</Label>
                <Input
                  id="proLimit"
                  type="number"
                  value={settings.max_pro_documents}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, max_pro_documents: parseInt(e.target.value) } : null)}
                  min="1"
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Current Limits</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base Tier:</span>
                    <Badge variant="secondary">{settings.max_base_documents} documents</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Pro Tier:</span>
                    <Badge variant="secondary">{settings.max_pro_documents} documents</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Billing & Stripe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Stripe
              </CardTitle>
              <CardDescription>
                Set plan prices and configure Stripe integration status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priceBase">Basic Price (cents)</Label>
                  <Input
                    id="priceBase"
                    type="number"
                    value={settings.price_base_cents ?? 0}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, price_base_cents: parseInt(e.target.value || '0') } : null)}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="pricePro">Pro Price (cents)</Label>
                  <Input
                    id="pricePro"
                    type="number"
                    value={settings.price_pro_cents ?? 0}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, price_pro_cents: parseInt(e.target.value || '0') } : null)}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="priceEnt">Enterprise Price (cents)</Label>
                  <Input
                    id="priceEnt"
                    type="number"
                    value={settings.price_enterprise_cents ?? 0}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, price_enterprise_cents: parseInt(e.target.value || '0') } : null)}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="maxEntDocs">Enterprise Doc Limit</Label>
                  <Input
                    id="maxEntDocs"
                    type="number"
                    value={settings.max_enterprise_documents ?? 20}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, max_enterprise_documents: parseInt(e.target.value || '0') } : null)}
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="priceIdBase">Stripe Price ID (Basic)</Label>
                  <Input
                    id="priceIdBase"
                    value={settings.stripe_price_id_base || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, stripe_price_id_base: e.target.value } : null)}
                    placeholder="price_..."
                  />
                </div>
                <div>
                  <Label htmlFor="priceIdPro">Stripe Price ID (Pro)</Label>
                  <Input
                    id="priceIdPro"
                    value={settings.stripe_price_id_pro || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, stripe_price_id_pro: e.target.value } : null)}
                    placeholder="price_..."
                  />
                </div>
                <div>
                  <Label htmlFor="priceIdEnt">Stripe Price ID (Enterprise)</Label>
                  <Input
                    id="priceIdEnt"
                    value={settings.stripe_price_id_enterprise || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, stripe_price_id_enterprise: e.target.value } : null)}
                    placeholder="price_..."
                  />
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Stripe Secret</h4>
                    <p className="text-sm text-muted-foreground">Configured in Supabase Edge Function secrets</p>
                  </div>
                  <Badge variant={stripeConfigured ? 'secondary' : 'outline'}>
                    {stripeConfigured ? 'Configured' : 'Not Set'}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="outline" onClick={fetchStripeStatus}>Refresh Status</Button>
                  <a
                    className="underline text-sm self-center"
                    href={`https://supabase.com/dashboard/project/gzgncmpytstovexfazdw/settings/functions`}
                    target="_blank" rel="noreferrer"
                  >
                    Open Supabase Secrets
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Documents */}
        <GlobalDocumentUpload />

        {/* Global Prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Global AI Prompt
            </CardTitle>
            <CardDescription>
              Configure the global prompt that provides context to the AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="globalPrompt">System Prompt</Label>
              <Textarea
                id="globalPrompt"
                value={settings.global_prompt}
                onChange={(e) => setSettings(prev => prev ? { ...prev, global_prompt: e.target.value } : null)}
                rows={10}
                placeholder="Enter the global prompt that will be used for all AI interactions..."
              />
              <div className="mt-2 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Available variables:</p>
                <ul className="space-y-1">
                  <li><code className="bg-muted px-1 rounded">{'{{company}}'}</code> - User's company name</li>
                  <li><code className="bg-muted px-1 rounded">{'{{full_name}}'}</code> - User's full name</li>
                  <li><code className="bg-muted px-1 rounded">{'{{email}}'}</code> - User's email address</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={updateSettings} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Current system configuration and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Configuration Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">AI Model</span>
                    <Badge variant="secondary">{settings.ai_model}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">API Endpoint</span>
                    <Badge variant={settings.chat_completions_url ? 'secondary' : 'outline'}>
                      {settings.chat_completions_url ? 'Configured' : 'Not Set'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">API Key</span>
                    <Badge variant={settings.api_key_encrypted ? 'secondary' : 'outline'}>
                      {settings.api_key_encrypted ? 'Configured' : 'Not Set'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Stripe Secret</span>
                    <Badge variant={stripeConfigured ? 'secondary' : 'outline'}>
                      {stripeConfigured ? 'Configured' : 'Not Set'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Platform Limits</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Base Users</span>
                    <Badge variant="secondary">{settings.max_base_documents} docs max</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pro Users</span>
                    <Badge variant="secondary">{settings.max_pro_documents} docs max</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Global Prompt</span>
                    <Badge variant="secondary">
                      {settings.global_prompt.length} characters
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Admin;