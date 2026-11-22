import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setDriverDispatchAccess } from "@/lib/dispatch-access.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DriverRoleSettings({ driverId }: { driverId: string }) {
  const [helper, setHelper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const changeRole = useServerFn(setDriverDispatchAccess);
  useEffect(() => {
    let mounted = true;
    supabase.from("dispatcher_access").select("access").eq("user_id", driverId).maybeSingle().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { toast.error("Nepodařilo se načíst roli."); return; }
      setHelper(data?.access === "helper"); setLoading(false);
    });
    return () => { mounted = false; };
  }, [driverId]);
  async function save(next: boolean) {
    setBusy(true);
    try {
      await changeRole({ data: { driverId, helper: next } });
      setHelper(next);
      toast.success(next ? "Role změněna: pomocný dispečer" : "Role změněna: řidič");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Změna role selhala."); }
    finally { setBusy(false); }
  }
  return <section className="p-3 border-b border-primary/40">
    <h3 className="text-xs text-muted-foreground mb-2">ROLE ÚČTU</h3>
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant={helper ? "outline" : "default"} aria-pressed={!helper}
        disabled={loading || busy} onClick={() => save(false)}>ŘIDIČ</Button>
      <Button type="button" variant={helper ? "default" : "outline"} aria-pressed={helper}
        className="whitespace-normal h-auto min-h-9" disabled={loading || busy} onClick={() => save(true)}>POMOCNÝ DISPEČER</Button>
    </div>
  </section>;
}