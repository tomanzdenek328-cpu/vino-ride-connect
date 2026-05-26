import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveMap } from "@/components/LiveMap";
import { WalkieTalkie } from "@/components/WalkieTalkie";
import { toast } from "sonner";
import { LogOut, Power, Navigation, Map as MapIcon, X, Wallet, CreditCard, Banknote } from "lucide-react";
import logoVinneTaxi from "@/assets/logo-vinne-taxi.png";


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

interface Ride {
  id: string;
  amount: number;
  payment_method: "cash" | "card";
  pickup_address: string | null;
  destination: string | null;
  completed_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ČEKÁ", assigned: "PŘIŘAZENO", accepted: "PŘIJATO",
  in_progress: "JEDE", completed: "HOTOVO", cancelled: "ZRUŠENO",
};

// Cinkot sklenicek – syntetizováno přes Web Audio API
function playClink() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Dva krátké jasné tóny imitující ťuknutí skla
    const tones = [
      { f: 2400, t: 0 },
      { f: 1800, t: 0.06 },
      { f: 3200, t: 0.12 },
    ];
    tones.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.35, now + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.55);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch (e) {
    console.warn("playClink failed", e);
  }
}

function DriverPage() {
  const { user, role, loading } = useAuth();
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [callSign, setCallSign] = useState("—");
  const [orders, setOrders] = useState<Order[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [showRides, setShowRides] = useState(false);
  const [completing, setCompleting] = useState<Order | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("call_sign").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.call_sign) setCallSign(data.call_sign); });
    supabase.from("driver_locations").select("online,busy").eq("driver_id", user.id).maybeSingle()
      .then(({ data }) => { setOnline(!!data?.online); setBusy(!!data?.busy); });
    // Vyžádej povolení desktop notifikací
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}
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
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const row: any = payload.new;
        if (payload.eventType === "INSERT" && row?.status === "pending") {
          playClink();
          toast.success("▸ NOVÁ ZAKÁZKA", {
            description: row.pickup_address ?? "Nová jízda čeká",
            duration: 8000,
          });
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("▸ NOVÁ ZAKÁZKA", { body: row.pickup_address ?? "Nová jízda čeká" });
            }
          } catch {}
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const loadRides = async () => {
    if (!user) return;
    const { data } = await supabase.from("rides")
      .select("id,amount,payment_method,pickup_address,destination,completed_at")
      .eq("driver_id", user.id)
      .order("completed_at", { ascending: false });
    setRides((data ?? []) as Ride[]);
  };

  useEffect(() => { loadRides(); }, [user]);

  // Geolocation streaming + Wake Lock to keep tracking when screen would otherwise sleep
  useEffect(() => {
    if (!user) return;

    const stopWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const startWatch = () => {
      if (!navigator.geolocation) { toast.error("Geolokace není dostupná"); return; }
      stopWatch();
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
        (err) => { console.error(err); },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
      );
    };

    const requestWakeLock = async () => {
      try {
        // @ts-ignore - wakeLock not in all TS libs
        if (navigator.wakeLock?.request) {
          // @ts-ignore
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current?.addEventListener?.("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch (e) {
        console.warn("WakeLock selhal", e);
      }
    };

    const releaseWakeLock = async () => {
      try { await wakeLockRef.current?.release?.(); } catch {}
      wakeLockRef.current = null;
    };

    if (!online) {
      stopWatch();
      releaseWakeLock();
      return;
    }

    startWatch();
    requestWakeLock();

    // When the tab/screen returns from background, re-acquire wake lock
    // and restart the geolocation watcher (browsers often pause it when hidden).
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!wakeLockRef.current) requestWakeLock();
        startWatch();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    // Periodic ping: re-send last known location and keep the row alive even
    // if watchPosition is throttled in the background.
    const keepAlive = window.setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          lastSentRef.current = Date.now();
          await supabase.from("driver_locations").upsert({
            driver_id: user.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            online: true,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    }, 15000);

    return () => {
      stopWatch();
      releaseWakeLock();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.clearInterval(keepAlive);
    };
  }, [user, online]);

  const toggleOnline = async () => {
    if (!user) return;
    const next = !online;
    setOnline(next);
    await supabase.from("driver_locations").upsert({ driver_id: user.id, online: next });
    toast.success(next ? "▸ ONLINE" : "▸ OFFLINE");
  };

  const toggleBusy = async () => {
    if (!user) return;
    const next = !busy;
    setBusy(next);
    await supabase.from("driver_locations").upsert({ driver_id: user.id, busy: next, online });
    toast.success(next ? "▸ OBSAZENO" : "▸ VOLNÝ");
  };

  const setBusyAuto = async (next: boolean) => {
    if (!user) return;
    setBusy(next);
    await supabase.from("driver_locations").upsert({ driver_id: user.id, busy: next, online });
  };

  const setOrderStatus = async (id: string, status: "accepted" | "in_progress") => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "accepted") await setBusyAuto(true);
  };

  const acceptPending = async (id: string) => {
    if (!user) return;
    const { data, error } = await supabase.from("orders")
      .update({ assigned_driver_id: user.id, status: "accepted" })
      .eq("id", id).eq("status", "pending")
      .select();
    if (error) { toast.error(error.message); return; }
    if (!data || !data.length) { toast.error("Zakázku už vzal někdo jiný"); return; }
    toast.success("▸ ZAKÁZKA TVOJE");
    await setBusyAuto(true);
  };

  const submitCompletion = async (amount: number, method: "cash" | "card") => {
    if (!user || !completing) return;
    const o = completing;
    const { error: insErr } = await supabase.from("rides").insert({
      order_id: o.id,
      driver_id: user.id,
      amount,
      payment_method: method,
      pickup_address: o.pickup_address,
      destination: o.destination,
    });
    if (insErr) { toast.error(insErr.message); return; }
    const { error: updErr } = await supabase.from("orders").update({ status: "completed" }).eq("id", o.id);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success(`▸ DOKONČENO · ${amount} Kč ${method === "cash" ? "HOTOVĚ" : "KARTOU"}`);
    setCompleting(null);
    await loadRides();
    // Auto-uvolnit, pokud nejsou další aktivní zakázky
    const stillActive = orders.some(x => x.id !== o.id && x.assigned_driver_id === user.id && x.status !== "completed" && x.status !== "cancelled");
    if (!stillActive) await setBusyAuto(false);
  };

  const totals = useMemo(() => {
    const cash = rides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Number(r.amount), 0);
    const card = rides.filter(r => r.payment_method === "card").reduce((s, r) => s + Number(r.amount), 0);
    return { cash, card, total: cash + card, count: rides.length };
  }, [rides]);

  if (loading) return null;
  if (role && role !== "driver") return <Navigate to="/dispatcher" />;

  const myOrders = orders.filter((o) => o.assigned_driver_id === user?.id && o.status !== "completed" && o.status !== "cancelled");
  const pending = orders.filter((o) => o.status === "pending" && !o.assigned_driver_id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-primary/40 px-3 pt-3 pb-4 relative">
        <button
          onClick={() => supabase.auth.signOut()}
          className="absolute top-2 right-2 border border-primary/40 px-2 py-1.5 text-xs hover:border-primary"
          aria-label="Odhlásit"
        >
          <LogOut className="w-3 h-3" />
        </button>
        <div className="flex justify-center">
          <img
            src={logoVinneTaxi}
            alt="VINNÉ TAXI"
            className="h-20 sm:h-24 w-auto object-contain"
          />
        </div>
        <div className="mt-2 text-center">
          <div className="text-xl text-primary glow-text font-display">▸ {callSign}</div>
          <div className="text-[10px] text-muted-foreground">VINNÉ TAXI · ŘIDIČ</div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <button onClick={toggleOnline}
            className={`border px-4 py-2 text-sm font-bold flex items-center gap-2 ${
              online ? "border-primary bg-primary text-primary-foreground glow" : "border-muted-foreground text-muted-foreground"
            }`}>
            <Power className="w-4 h-4" /> {online ? "ONLINE" : "OFFLINE"}
          </button>
          <button onClick={toggleBusy} disabled={!online}
            className={`border px-4 py-2 text-sm font-bold ${
              busy ? "border-amber-warn bg-amber-warn text-black" : "border-primary/60 text-primary"
            } disabled:opacity-40`}>
            {busy ? "OBSAZENO" : "VOLNÝ"}
          </button>
          <button onClick={() => setShowMap(true)}
            className="border border-primary/60 px-4 py-2 text-sm font-bold flex items-center gap-2 hover:border-primary hover:bg-primary/10">
            <MapIcon className="w-4 h-4" /> MAPA
          </button>
        </div>
        <div className="mt-2 flex justify-center">
          <button onClick={() => setShowRides(true)}
            className="border border-primary/60 px-5 py-2 text-sm font-bold flex items-center gap-2 hover:border-primary hover:bg-primary/10">
            <Wallet className="w-4 h-4" /> MOJE JÍZDY · {totals.total.toFixed(0)} Kč
          </button>
        </div>
      </header>


      {showMap && (
        <div className="fixed inset-0 z-[1500] bg-black flex flex-col">
          <div className="border-b border-primary/40 p-3 flex items-center justify-between">
            <div className="font-display text-primary text-sm">▸ MAPA</div>
            <button onClick={() => setShowMap(false)} className="border border-primary/60 px-2 py-1 text-xs hover:border-primary flex items-center gap-1">
              <X className="w-3 h-3" /> ZAVŘÍT
            </button>
          </div>
          <div className="flex-1 relative">
            <LiveMap showOrders followDriverId={user?.id} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
        {myOrders.length > 0 && (
          <section>
            <h2 className="font-display text-primary text-sm mb-2">▸ MOJE JÍZDA</h2>
            {myOrders.map((o) => (
              <div key={o.id} className="border border-primary p-3 mb-2 glow">
                <div className="text-primary font-bold">▸ {o.pickup_address}</div>
                {o.destination && <div className="text-xs text-muted-foreground">→ {o.destination}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {o.scheduled_time ? `⏱ ${new Date(o.scheduled_time).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "⏱ HNED"}
                  {" · "}👥 {o.passengers}
                </div>
                {o.notes && <div className="text-xs text-amber-warn mt-1">⚠ {o.notes}</div>}
                <div className="text-[10px] mt-1">STAV: {STATUS_LABEL[o.status]}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {o.status === "assigned" && (
                    <button onClick={() => setOrderStatus(o.id, "accepted")} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground">▸ PŘIJMOUT</button>
                  )}
                  {(o.status === "accepted" || o.status === "assigned") && (
                    <button onClick={() => setOrderStatus(o.id, "in_progress")} className="border border-amber-warn text-amber-warn px-3 py-1 text-xs">▸ JEDU</button>
                  )}
                  {(o.status === "accepted" || o.status === "in_progress" || o.status === "assigned") && (
                    <button onClick={() => setCompleting(o)} className="border border-primary px-3 py-1 text-xs bg-primary text-primary-foreground">▸ DOKONČIT</button>
                  )}
                  {o.status !== "in_progress" && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.pickup_address)}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> K ZÁKAZNÍKOVI
                    </a>
                  )}
                  {o.status === "in_progress" && o.destination && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.destination)}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto border border-amber-warn text-amber-warn px-3 py-1 text-xs hover:bg-amber-warn hover:text-black flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> DO CÍLE
                    </a>
                  )}
                  {o.status === "in_progress" && !o.destination && (
                    <span className="ml-auto text-[10px] text-muted-foreground self-center">Cíl nezadán</span>
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
              <div className="text-[10px] text-muted-foreground mt-1">
                {o.scheduled_time ? `⏱ ${new Date(o.scheduled_time).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "⏱ HNED"}
                {" · "}👥 {o.passengers}
              </div>
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

      {completing && (
        <CompleteRideModal
          order={completing}
          onClose={() => setCompleting(null)}
          onSubmit={submitCompletion}
        />
      )}

      {showRides && (
        <RidesModal rides={rides} totals={totals} onClose={() => setShowRides(false)} />
      )}

      {user && <WalkieTalkie userId={user.id} callSign={callSign} />}
    </div>
  );
}

function CompleteRideModal({ order, onClose, onSubmit }: {
  order: Order;
  onClose: () => void;
  onSubmit: (amount: number, method: "cash" | "card") => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount.replace(",", "."));
    if (!isFinite(n) || n < 0) { toast.error("Zadej platnou částku"); return; }
    setSubmitting(true);
    try { await onSubmit(n, method); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-black border border-primary glow p-5 max-w-sm w-full space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ DOKONČIT JÍZDU</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
          <div className="text-primary font-bold">▸ {order.pickup_address}</div>
          {order.destination && <div>→ {order.destination}</div>}
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">ČÁSTKA (Kč)</div>
          <input
            type="number" inputMode="decimal" step="1" min="0" autoFocus
            value={amount} onChange={(e) => setAmount(e.target.value)} required
            className="w-full bg-input border border-primary/40 px-3 py-3 text-primary text-2xl font-display focus:border-primary focus:outline-none"
            placeholder="0"
          />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">ZPŮSOB PLATBY</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod("cash")}
              className={`border py-3 text-sm flex items-center justify-center gap-2 ${
                method === "cash" ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"
              }`}>
              <Banknote className="w-4 h-4" /> HOTOVĚ
            </button>
            <button type="button" onClick={() => setMethod("card")}
              className={`border py-3 text-sm flex items-center justify-center gap-2 ${
                method === "card" ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"
              }`}>
              <CreditCard className="w-4 h-4" /> KARTOU
            </button>
          </div>
        </div>
        <button disabled={submitting} className="w-full border border-primary text-primary py-2.5 hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
          {submitting ? "▸ UKLÁDÁM..." : "▸ POTVRDIT A DOKONČIT"}
        </button>
      </form>
    </div>
  );
}

function RidesModal({ rides, totals, onClose }: {
  rides: Ride[];
  totals: { cash: number; card: number; total: number; count: number };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black z-[1800] flex flex-col">
      <div className="border-b border-primary/40 p-3 flex items-center justify-between">
        <h2 className="font-display text-primary glow-text">▸ MOJE JÍZDY ({totals.count})</h2>
        <button onClick={onClose} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
          <X className="w-3 h-3" /> ZAVŘÍT
        </button>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2 border-b border-primary/40">
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">HOTOVĚ</div>
          <div className="text-lg text-primary font-display">{totals.cash.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">KARTOU</div>
          <div className="text-lg text-primary font-display">{totals.card.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary p-2 glow">
          <div className="text-[10px] text-muted-foreground">CELKEM</div>
          <div className="text-lg text-primary font-display">{totals.total.toFixed(0)} Kč</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rides.length === 0 && <div className="p-6 text-center text-muted-foreground text-xs">Žádné jízdy.</div>}
        {rides.map((r) => (
          <div key={r.id} className="border-b border-primary/20 p-3 text-sm flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-primary truncate">▸ {r.pickup_address ?? "—"}</div>
              {r.destination && <div className="text-xs text-muted-foreground truncate">→ {r.destination}</div>}
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.completed_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-primary font-display">{Number(r.amount).toFixed(0)} Kč</div>
              <div className={`text-[10px] ${r.payment_method === "cash" ? "text-amber-warn" : "text-primary"}`}>
                {r.payment_method === "cash" ? "HOTOVĚ" : "KARTOU"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
