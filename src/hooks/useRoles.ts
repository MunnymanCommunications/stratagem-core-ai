import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        setError(error.message);
        setRoles([]);
      } else {
        setRoles((data || []).map((r: any) => r.role));
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const isAdmin = roles.includes('admin');
  const isModerator = roles.includes('moderator');

  return { roles, isAdmin, isModerator, loading, error };
};
