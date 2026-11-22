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
    let currentUserId: string | null = null;
    let roleLoading = false;

    const loadRole = async (uid: string) => {
      if (roleLoading) return;
      roleLoading = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const [roles, access] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid).abortSignal(controller.signal),
          supabase.rpc("get_my_dispatch_access").abortSignal(controller.signal),
        ]);
        if (!mounted || currentUserId !== uid || roles.error || access.error) return;
        setRole(roles.data?.some(r => r.role === "dispatcher") ? "dispatcher" : roles.data?.some(r => r.role === "driver") ? "driver" : null);
        setDispatchAccess(access.data === "main" || access.data === "helper" ? access.data : null);
      } finally { clearTimeout(timeout); roleLoading = false; }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED" && event !== "INITIAL_SESSION")) return;
      const nextId = session?.user.id ?? null;
      if (nextId === currentUserId && event !== "USER_UPDATED") return;
      currentUserId = nextId;
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
      currentUserId = data.user?.id ?? null;
      setUser(previous => previous?.id === data.user?.id ? previous : data.user ?? null);
      if (data.user) await loadRole(data.user.id);
      if (mounted) setLoading(false);
    });
    const refresh = window.setInterval(() => {
      // Refresh permissions, not the User object: replacing it restarts GPS,
      // notification listeners and every account-dependent request in the APK.
      if (mounted && currentUserId) void loadRole(currentUserId);
    }, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(refresh);
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, dispatchAccess };
}
