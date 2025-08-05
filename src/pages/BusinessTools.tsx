import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import InvoiceGenerator from '@/components/business/InvoiceGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Users, 
  DollarSign,
  Clock,
  Target,
  BarChart3
} from 'lucide-react';

const BusinessTools = () => {
  const [activeTab, setActiveTab] = useState('invoice');

  const tools = [
    {
      id: 'invoice',
      title: 'Invoice Generator',
      description: 'Create professional invoices with your branding',
      icon: FileText,
      color: 'bg-blue-500'
    },
    {
      id: 'calculator',
      title: 'Business Calculator',
      description: 'Calculate taxes, margins, and ROI',
      icon: Calculator,
      color: 'bg-green-500'
    },
    {
      id: 'scheduler',
      title: 'Meeting Scheduler',
      description: 'Schedule and manage client meetings',
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      id: 'analytics',
      title: 'Performance Tracker',
      description: 'Track business metrics and KPIs',
      icon: TrendingUp,
      color: 'bg-orange-500'
    }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Business Tools</h1>
          <p className="text-muted-foreground mt-2">
            Essential tools to streamline your business operations
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {tools.map((tool) => (
              <TabsTrigger key={tool.id} value={tool.id} className="flex items-center gap-2">
                <tool.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tool.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="invoice" className="space-y-6">
            <InvoiceGenerator />
          </TabsContent>

          <TabsContent value="calculator" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Profit Margin Calculator
                  </CardTitle>
                  <CardDescription>Calculate your profit margins and markup</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Cost Price</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Selling Price</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">0%</div>
                    <div className="text-sm text-muted-foreground">Profit Margin</div>
                  </div>
                  <Button className="w-full">Calculate</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Tax Calculator
                  </CardTitle>
                  <CardDescription>Calculate taxes and net income</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gross Income</label>
                    <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax Rate (%)</label>
                    <input type="number" className="w-full p-2 border rounded-md" placeholder="8.5" />
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">$0.00</div>
                    <div className="text-sm text-muted-foreground">Net Income</div>
                  </div>
                  <Button className="w-full">Calculate</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    ROI Calculator
                  </CardTitle>
                  <CardDescription>Calculate return on investment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Initial Investment</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Final Value</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">0%</div>
                    <div className="text-sm text-muted-foreground">Return on Investment</div>
                  </div>
                  <Button className="w-full">Calculate</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Break-Even Calculator
                  </CardTitle>
                  <CardDescription>Calculate break-even point</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fixed Costs</label>
                    <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Price per Unit</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Variable Cost per Unit</label>
                      <input type="number" className="w-full p-2 border rounded-md" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Units to Break Even</div>
                  </div>
                  <Button className="w-full">Calculate</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Meeting Scheduler
                </CardTitle>
                <CardDescription>Schedule and manage your client meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Full calendar integration and meeting scheduling features will be available soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground">+0% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">+0% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">$0.00 pending</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0%</div>
                  <p className="text-xs text-muted-foreground">Monthly growth</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Dashboard</CardTitle>
                <CardDescription>Track your business metrics and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
                  <p className="text-muted-foreground">
                    Detailed analytics and reporting features will be available once you start using the platform.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default BusinessTools;