import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import SEO from '@/components/seo/SEO';
import AddPartnerDialog from '@/components/dialogs/AddPartnerDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Globe, 
  Users, 
  Settings, 
  Upload,
  Eye,
  Code,
  Smartphone
} from 'lucide-react';

const WhiteLabel = () => {
  const [branding, setBranding] = useState({
    companyName: '',
    primaryColor: '#7c3aed',
    secondaryColor: '#a855f7',
    logo: '',
    favicon: '',
    customDomain: '',
    footerText: '',
  });

  const [partners, setPartners] = useState([
    {
      id: 1,
      name: 'Partner Corp',
      domain: 'partner.example.com',
      status: 'Active',
      users: 25,
      customizations: 'Full Branding'
    }
  ]);

  const [showAddPartner, setShowAddPartner] = useState(false);

  const handleAddPartner = (newPartner: any) => {
    setPartners(prev => [...prev, newPartner]);
  };

  return (
    <Layout>
      <SEO
        title="White‑Label Management — DesignR AI"
        description="Customize branding, domains, and partners for white‑label."
        canonical="/white-label"
      />
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">White-Label Management</h1>
          <p className="text-muted-foreground mt-2">
            Customize the platform for your partners and clients
          </p>
        </header>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="partners">Partners</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Brand Identity
                  </CardTitle>
                  <CardDescription>Customize the look and feel of your platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={branding.companyName}
                      onChange={(e) => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Your Company Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-16 h-10"
                        />
                        <Input
                          value={branding.primaryColor}
                          onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                          placeholder="#7c3aed"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={branding.secondaryColor}
                          onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="w-16 h-10"
                        />
                        <Input
                          value={branding.secondaryColor}
                          onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          placeholder="#a855f7"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Logo Upload</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload logo</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="footerText">Footer Text</Label>
                    <Textarea
                      id="footerText"
                      value={branding.footerText}
                      onChange={(e) => setBranding(prev => ({ ...prev, footerText: e.target.value }))}
                      placeholder="© 2024 Your Company. All rights reserved."
                      rows={3}
                    />
                  </div>

                  <Button className="w-full">Save Branding</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuration
                  </CardTitle>
                  <CardDescription>Platform settings and customizations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Feature Toggles</Label>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">AI Assistant</span>
                        <Badge variant="secondary">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Document Management</span>
                        <Badge variant="secondary">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Business Tools</span>
                        <Badge variant="secondary">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Analytics Dashboard</span>
                        <Badge variant="outline">Premium</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Subscription Limits</Label>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Base Tier Documents</span>
                        <Badge variant="secondary">1</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pro Tier Documents</span>
                        <Badge variant="secondary">5</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enterprise Features</span>
                        <Badge variant="outline">Custom</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>API Integration</Label>
                    <div className="space-y-2 mt-2">
                      <Input placeholder="API Endpoint URL" />
                      <Input placeholder="API Key" type="password" />
                      <Button variant="outline" className="w-full">Test Connection</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="partners" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Partner Management</h3>
                <p className="text-muted-foreground">Manage your white-label partners</p>
              </div>
              <Button onClick={() => setShowAddPartner(true)}>
                <Users className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Partners</CardTitle>
                <CardDescription>Your current white-label partnerships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {partners.map((partner) => (
                    <div key={partner.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <h4 className="font-medium">{partner.name}</h4>
                          <p className="text-sm text-muted-foreground">{partner.domain}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={partner.status === 'Active' ? 'default' : 'secondary'}>
                          {partner.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">{partner.users} users</p>
                          <p className="text-xs text-muted-foreground">{partner.customizations}</p>
                        </div>
                        <Button variant="outline" size="sm">Manage</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domains" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Custom Domains
                </CardTitle>
                <CardDescription>Manage custom domains for your white-label instances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customDomain">Custom Domain</Label>
                  <Input
                    id="customDomain"
                    value={branding.customDomain}
                    onChange={(e) => setBranding(prev => ({ ...prev, customDomain: e.target.value }))}
                    placeholder="app.yourcompany.com"
                  />
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">DNS Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <code className="bg-background px-2 py-1 rounded">CNAME</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <code className="bg-background px-2 py-1 rounded">app</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Value:</span>
                      <code className="bg-background px-2 py-1 rounded">designr-ai.vercel.app</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SSL Certificate</span>
                    <Badge variant="secondary">Auto-Generated</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Domain Status</span>
                    <Badge variant="outline">Not Configured</Badge>
                  </div>
                </div>

                <Button className="w-full">Verify Domain</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                <CardDescription>See how your white-label customizations look</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Button variant="outline" size="sm">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Mobile
                    </Button>
                    <Button variant="outline" size="sm">
                      <Code className="h-4 w-4 mr-2" />
                      Desktop
                    </Button>
                  </div>
                  
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 bg-muted/5">
                    <div className="max-w-md mx-auto bg-background rounded-lg shadow-lg overflow-hidden">
                      <div 
                        className="h-2" 
                        style={{ backgroundColor: branding.primaryColor }}
                      />
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-2">
                          {branding.companyName || 'Your Company'} AI Platform
                        </h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          Welcome to your customized AI assistant platform
                        </p>
                        <div className="space-y-2">
                          <div 
                            className="h-8 rounded text-white flex items-center justify-center text-sm"
                            style={{ backgroundColor: branding.primaryColor }}
                          >
                            Primary Button
                          </div>
                          <div 
                            className="h-8 rounded border text-sm flex items-center justify-center"
                            style={{ 
                              borderColor: branding.secondaryColor,
                              color: branding.secondaryColor
                            }}
                          >
                            Secondary Button
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                          {branding.footerText || '© 2024 Your Company. All rights reserved.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <AddPartnerDialog
          open={showAddPartner}
          onOpenChange={setShowAddPartner}
          onAddPartner={handleAddPartner}
        />
      </div>
    </Layout>
  );
};

export default WhiteLabel;