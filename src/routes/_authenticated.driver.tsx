import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveMap } from "@/components/LiveMap";
import { WalkieTalkie } from "@/components/WalkieTalkie";
import { toast } from "sonner";
import { LogOut, Power, Navigation } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverPage,
});

interface Order {
  id: string;
  pickup_address: string;
  destination: string | null;
  scheduled_time: string | null;
  passengers: number;
  notes: string | null;
  status: string;
  assigned_driver_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ČEKÁ", assigned: "PŘIŘAZENO", accepted: "PŘIJATO",
  in_progress: "JEDE", completed: "HOTOVO", cancelled: "ZRUŠENO",
};

function DriverPage() {
  const { user, role, loading } = useAuth();
  const [online, setOnline] = useState(false);
  const [callSign, setCallSign] = useState("—");
  const [orders, setOrders] = useState<Order[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("call_sign").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.call_sign) setCallSign(data.call_sign); });
    supabase.from("driver_locations").select("online").eq("driver_id", user.id).maybeSingle()
      .then(({ data }) => setOnline(!!data?.online));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("orders")
        .select("*")
        .or(`assigned_driver_id.eq.${user.id},status.eq.pending`)
        .order("created_at", { ascending: false });
      setOrders((data ?? []) as Order[]);
    };
    load();
    const ch = supabase.channel("driver_orders_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Geolocation streaming
  useEffect(() => {
    if (!user || !online) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) { toast.error("Geolokace není dostupná"); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < 4000) return;
        lastSentRef.current = now;
        await supabase.from("driver_locations").upsert({
          driver_id: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          online: true,
        });
      },
      (err) => { console.error(err); toast.error("Nelze získat polohu"); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [user, online]);

  const toggleOnline = async () => {
    if (!user) return;
    const next = !online;
    setOnline(next);
    await supabase.from("driver_locations").upsert({ driver_id: user.id, online: next });
    toast.success(next ? "▸ ONLINE" : "▸ OFFLINE");
  };

  const setOrderStatus = async (id: string, status: "accepted" | "in_progress" | "completed") => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const acceptPending = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("orders")
      .update({ assigned_driver_id: user.id, status: "accepted" })
      .eq("id", id).eq("status", "pending");
    if (error) toast.error(error.message); else toast.success("▸ ZAKÁZKA TVOJE");
  };

  if (loading) return null;
  if (role && role !== "driver") return <Navigate to="/dispatcher" />;

  const myOrders = orders.filter((o) => o.assigned_driver_id === user?.id && o.status !== "completed" && o.status !== "cancelled");
  const pending = orders.filter((o) => o.status === "pending" && !o.assigned_driver_id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-primary/40 p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg text-primary glow-text font-display truncate">▸ {callSign}</h1>
          <div className="text-[10px] text-muted-foreground">VINNÉ TAXI · ŘIDIČ</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleOnline}
            className={`border px-3 py-1.5 text-xs flex items-center gap-1 ${
              online ? "border-primary bg-primary text-primary-foreground glow" : "border-muted-foreground text-muted-foreground"
            }`}>
            <Power className="w-3 h-3" /> {online ? "ONLINE" : "OFFLINE"}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="border border-primary/40 px-2 py-1.5 text-xs hover:border-primary">
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="h-[40vh] border-b border-primary/40 relative">
        <LiveMap showOrders followDriverId={user?.id} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
        {myOrders.length > 0 && (
          <section>
            <h2 className="font-display text-primary text-sm mb-2">▸ MOJE JÍZDA</h2>
            {myOrders.map((o) => (
              <div key={o.id} className="border border-primary p-3 mb-2 glow">
                <div className="text-primary font-bold">▸ {o.pickup_address}</div>
                {o.destination && <div className="text-xs text-muted-foreground">→ {o.destination}</div>}
                {o.customer_name && <div className="text-xs mt-1">{o.customer_name} {o.customer_phone && `· ${o.customer_phone}`}</div>}
                {o.notes && <div className="text-xs text-amber-warn mt-1">⚠ {o.notes}</div>}
                <div className="text-[10px] mt-1">STAV: {STATUS_LABEL[o.status]}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {o.status === "assigned" && (
                    <button onClick={() => setOrderStatus(o.id, "accepted")} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground">▸ PŘIJMOUT</button>
                  )}
                  {(o.status === "accepted" || o.status === "assigned") && (
                    <button onClick={() => setOrderStatus(o.id, "in_progress")} className="border border-amber-warn text-amber-warn px-3 py-1 text-xs">▸ JEDU</button>
                  )}
                  {o.status === "in_progress" && (
                    <button onClick={() => setOrderStatus(o.id, "completed")} className="border border-primary px-3 py-1 text-xs bg-primary text-primary-foreground">▸ DOKONČIT</button>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="font-display text-primary text-sm mb-2">▸ VOLNÉ ZAKÁZKY ({pending.length})</h2>
          {pending.map((o) => (
            <div key={o.id} className="border border-amber-warn/60 p-3 mb-2">
              <div className="text-amber-warn font-bold">▸ {o.pickup_address}</div>
              {o.destination && <div className="text-xs text-muted-foreground">→ {o.destination}</div>}
              {o.notes && <div className="text-xs mt-1">⚠ {o.notes}</div>}
              <button onClick={() => acceptPending(o.id)} disabled={!online}
                className="mt-2 w-full border border-amber-warn text-amber-warn py-1.5 text-xs hover:bg-amber-warn hover:text-black disabled:opacity-40">
                ▸ VZÍT
              </button>
            </div>
          ))}
          {!pending.length && <div className="text-xs text-muted-foreground text-center p-4">Žádné volné zakázky.</div>}
        </section>
      </div>

      {user && <WalkieTalkie userId={user.id} callSign={callSign} />}
    </div>
  );
}
