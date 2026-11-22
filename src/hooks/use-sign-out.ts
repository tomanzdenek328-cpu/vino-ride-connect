import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { stopBackgroundGeolocation } from '@/lib/native';
import { toast } from 'sonner';

export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await stopBackgroundGeolocation();
      // End this device's session; do not log the driver out on other devices.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      toast.dismiss();
      await navigate({ to: '/login', replace: true });
    } catch {
      toast.error('Odhlášení se nepodařilo. Zkontrolujte připojení a zkuste to znovu.');
    } finally {
      setSigningOut(false);
    }
  };
  return { signOut, signingOut };
}