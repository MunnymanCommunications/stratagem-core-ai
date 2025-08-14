import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Users, FileText, MessageSquare, Activity, RefreshCw, Crown, Shield } from 'lucide-react';

interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  created_at: string;
  roles: string[];
  subscription_tier: string;
  max_documents: number;
  document_count: number;
  conversation_count: number;
  message_count: number;
  last_activity: string | null;
}

interface GlobalStats {
  total_users: number;
  total_admins: number;
  total_moderators: number;
  total_documents: number;
  total_conversations: number;
  total_messages: number;
  subscription_breakdown: {
    base: number;
    pro: number;
    enterprise: number;
  };
}

const UserAnalytics = () => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch user data with roles and stats
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          company,
          created_at
        `);

      if (usersError) throw usersError;

      // Get document counts per user
      const { data: docCounts, error: docError } = await supabase
        .from('user_documents')
        .select('user_id, id')
        .then(({ data, error }) => {
          if (error) throw error;
          const counts: Record<string, number> = {};
          data?.forEach(doc => {
            counts[doc.user_id] = (counts[doc.user_id] || 0) + 1;
          });
          return { data: counts, error: null };
        });

      if (docError) throw docError;

      // Get conversation counts per user
      const { data: convCounts, error: convError } = await supabase
        .from('chat_conversations')
        .select('user_id, id')
        .then(({ data, error }) => {
          if (error) throw error;
          const counts: Record<string, number> = {};
          data?.forEach(conv => {
            counts[conv.user_id] = (counts[conv.user_id] || 0) + 1;
          });
          return { data: counts, error: null };
        });

      if (convError) throw convError;

      // Get message counts per user
      const { data: msgCounts, error: msgError } = await supabase
        .from('chat_messages')
        .select('user_id, id, created_at')
        .then(({ data, error }) => {
          if (error) throw error;
          const counts: Record<string, number> = {};
          const lastActivity: Record<string, string> = {};
          data?.forEach(msg => {
            counts[msg.user_id] = (counts[msg.user_id] || 0) + 1;
            if (!lastActivity[msg.user_id] || msg.created_at > lastActivity[msg.user_id]) {
              lastActivity[msg.user_id] = msg.created_at;
            }
          });
          return { data: { counts, lastActivity }, error: null };
        });

      if (msgError) throw msgError;

      // Get roles for each user
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const userRoles: Record<string, string[]> = {};
      rolesData?.forEach(role => {
        if (!userRoles[role.user_id]) userRoles[role.user_id] = [];
        userRoles[role.user_id].push(role.role);
      });

      // Get subscriptions for each user
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, tier, max_documents');

      if (subscriptionsError) throw subscriptionsError;

      const userSubscriptions: Record<string, { tier: string; max_documents: number }> = {};
      subscriptionsData?.forEach(sub => {
        userSubscriptions[sub.user_id] = {
          tier: sub.tier,
          max_documents: sub.max_documents
        };
      });

      // Transform users data
      const transformedUsers: UserStats[] = usersData?.map(user => ({
        id: user.id,
        email: user.email || '',
        full_name: user.full_name,
        company: user.company,
        created_at: user.created_at,
        roles: userRoles[user.id] || [],
        subscription_tier: userSubscriptions[user.id]?.tier || 'base',
        max_documents: userSubscriptions[user.id]?.max_documents || 1,
        document_count: docCounts[user.id] || 0,
        conversation_count: convCounts[user.id] || 0,
        message_count: msgCounts.counts[user.id] || 0,
        last_activity: msgCounts.lastActivity[user.id] || null
      })) || [];

      setUsers(transformedUsers);

      // Calculate global stats
      const stats: GlobalStats = {
        total_users: transformedUsers.length,
        total_admins: transformedUsers.filter(u => u.roles.includes('admin')).length,
        total_moderators: transformedUsers.filter(u => u.roles.includes('moderator')).length,
        total_documents: Object.values(docCounts).reduce((sum, count) => sum + count, 0),
        total_conversations: Object.values(convCounts).reduce((sum, count) => sum + count, 0),
        total_messages: Object.values(msgCounts.counts).reduce((sum, count) => sum + count, 0),
        subscription_breakdown: {
          base: transformedUsers.filter(u => u.subscription_tier === 'base').length,
          pro: transformedUsers.filter(u => u.subscription_tier === 'pro').length,
          enterprise: transformedUsers.filter(u => u.subscription_tier === 'enterprise').length,
        }
      };

      setGlobalStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load user analytics');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('admin')) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (roles.includes('moderator')) return <Shield className="h-4 w-4 text-blue-500" />;
    return null;
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes('admin')) return <Badge className="bg-yellow-500 text-yellow-50">Admin</Badge>;
    if (roles.includes('moderator')) return <Badge variant="secondary">Moderator</Badge>;
    return <Badge variant="outline">User</Badge>;
  };

  const getSubscriptionBadge = (tier: string) => {
    const variants = {
      base: 'outline',
      pro: 'secondary',
      enterprise: 'default'
    } as const;
    return <Badge variant={variants[tier as keyof typeof variants] || 'outline'}>{tier}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{globalStats.total_users}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{globalStats.total_documents}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                  <p className="text-2xl font-bold">{globalStats.total_conversations}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages</p>
                  <p className="text-2xl font-bold">{globalStats.total_messages}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription Breakdown */}
      {globalStats && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{globalStats.subscription_breakdown.base}</p>
                <p className="text-sm text-muted-foreground">Base Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{globalStats.subscription_breakdown.pro}</p>
                <p className="text-sm text-muted-foreground">Pro Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{globalStats.subscription_breakdown.enterprise}</p>
                <p className="text-sm text-muted-foreground">Enterprise Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Details</CardTitle>
              <CardDescription>
                Detailed analytics for all platform users
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getRoleIcon(user.roles)}
                      <h4 className="font-medium">{user.full_name || user.email}</h4>
                      {getRoleBadge(user.roles)}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.company && (
                      <p className="text-sm text-muted-foreground">{user.company}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {getSubscriptionBadge(user.subscription_tier)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Documents</p>
                    <p className="font-medium">{user.document_count}/{user.max_documents}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conversations</p>
                    <p className="font-medium">{user.conversation_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Messages</p>
                    <p className="font-medium">{user.message_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Activity</p>
                    <p className="font-medium">
                      {user.last_activity 
                        ? new Date(user.last_activity).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 text-xs text-muted-foreground">
                  Joined: {new Date(user.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserAnalytics;