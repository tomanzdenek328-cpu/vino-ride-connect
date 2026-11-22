import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { DispatchAccess } from "@/lib/dispatch-access";

export type AppRole = "dispatcher" | "driver";

export interface AuthState {
  user: User | null;
  role: AppRole | null;
  dispatchAccess: DispatchAccess;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatchAccess, setDispatchAccess] = useState<DispatchAccess>(null);

  useEffect(() => {
    let mounted = true;

    const loadRole = async (uid: string) => {
      const [roles, access] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.rpc("get_my_dispatch_access"),
      ]);
      if (!mounted) return;
      setRole(roles.data?.some(r => r.role === "dispatcher") ? "dispatcher" : roles.data?.some(r => r.role === "driver") ? "driver" : null);
      setDispatchAccess(access.data === "main" || access.data === "helper" ? access.data : null);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => loadRole(session.user.id), 0);
      } else {
        setRole(null);
        setDispatchAccess(null);
      }
    });

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      if (data.user) await loadRole(data.user.id);
      if (mounted) setLoading(false);
    });
    const refresh = window.setInterval(() => {
      supabase.auth.getUser().then(({ data }) => { if (mounted && data.user) void loadRole(data.user.id); });
    }, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(refresh);
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, dispatchAccess };
}

export async function signOut() {
  await supabase.auth.signOut();
}
