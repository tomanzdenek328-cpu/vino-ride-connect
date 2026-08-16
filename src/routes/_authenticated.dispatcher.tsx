import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveMap } from "@/components/LiveMap";
import { WalkieTalkie } from "@/components/WalkieTalkie";
import { ChatPanel } from "@/components/ChatPanel";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { createDriver, updateDriver, deleteDriver, resetDriverRides, deleteRide, getDriverEmail } from "@/lib/drivers.functions";

import { notifyNewOrder, saveDriverPushSubscription } from "@/lib/push.functions";
import { initPushNotifications, initLocalNotifications, isNative, showLocalNotification } from "@/lib/native";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import { toast } from "sonner";
import { LogOut, Plus, X, UserPlus, Map as MapIcon, Archive, Car, Trash2, MessageSquare, Mail, FileText } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { makeTrackingCode } from "@/lib/tracking";
import { createVehicle, updateVehicle, deleteVehicle } from "@/lib/vehicles.functions";
import logoVinneTaxi from "@/assets/logo-vinne-taxi-transparent.png";
import limoSide from "@/assets/limo-side-black.png";
import { SOSAlerts } from "@/components/SOSAlerts";
import { estimateRide } from "@/lib/customer.functions";
import { computeFare, isWeekend, FARE_MODE_LABELS, type FareMode, type TariffFull } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/dispatcher")({
  component: DispatcherPage,
});

interface Order {
  id: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination: string | null;
  scheduled_time: string | null;
  passengers: number;
  notes: string | null;
  customer_phone: string | null;
  status: string;
  assigned_driver_id: string | null;
  assigned_driver_ids: string[] | null;
  vehicle_type: string | null;
  created_at: string;
  released: boolean;
  priority: boolean;
  source?: string | null;
  estimated_price?: number | null;
  estimated_distance_km?: number | null;
  approval?: string | null;
  driver_arrived_at?: string | null;
}

/** Mapování typu auta v dispečinku na tarif v ceníku. */
const TARIFF_KEY: Record<"car" | "van" | "limo", string> = {
  car: "osobni",
  van: "dodavka",
  limo: "vip_limuzina",
};


// Sort by scheduled time ascending (earliest first); fall back to created_at.
function sortByTimeAsc(a: Order, b: Order): number {
  const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : new Date(a.created_at).getTime();
  const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : new Date(b.created_at).getTime();
  return ta - tb;
}


interface Driver {
  id: string;
  full_name: string;
  call_sign: string;
  online: boolean;
  busy: boolean;
  car_type: string;
}

interface Ride {
  id: string;
  driver_id: string;
  amount: number;
  payment_method: "cash" | "card" | "invoice";
  pickup_address: string | null;
  destination: string | null;
  completed_at: string;
}

const PM_LABEL = (m: string) => m === "cash" ? "HOTOVĚ" : m === "card" ? "KARTOU" : "FAKTURA/QR";
const PM_SHORT = (m: string) => m === "cash" ? "HOT" : m === "card" ? "KAR" : "FAK";


const STATUS_LABEL: Record<string, string> = {
  pending: "ČEKÁ",
  assigned: "PŘIŘAZENO",
  accepted: "PŘIJATO",
  in_progress: "JEDE",
  completed: "HOTOVO",
  cancelled: "ZRUŠENO",
};

// Skrytý řidič – vidí ho jen dispečer Torpédo
const HIDDEN_DRIVER_ID = "5ab5bc1d-a16e-4bfe-862e-61ecf8c0b2fb";
const ALLOWED_DISPATCHER_ID = "b7636c0d-5323-4bb4-b394-44f5736d6e0d";

/** Hlasité cinkání skleniček (Web Audio) – upozornění na zákaznickou objednávku. */
function playGlassClink() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    [0, 0.18, 0.36, 0.6, 0.78].forEach((t, i) => {
      [1, 2.7, 5.3].forEach((mult, h) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = (i % 2 === 0 ? 1180 : 1460) * mult;
        const start = ctx.currentTime + t;
        const peak = 0.9 / (h + 1);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(peak, start + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(g).connect(master);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {}
}

function DispatcherPage() {
  const { user, role, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showVehicles, setShowVehicles] = useState(false);
  const [showTariffs, setShowTariffs] = useState(false);

  const [callSign, setCallSign] = useState("DISP");
  const [driverDetail, setDriverDetail] = useState<Driver | null>(null);
  const [archiveOrderDetail, setArchiveOrderDetail] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  // ID zákaznických objednávek, které dispečer ještě nezobrazil (cinká, dokud je nezobrazí).
  const [unseenCustomer, setUnseenCustomer] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatThread, setActiveChatThread] = useState<string | null>(null);
  const chatNotif = useChatNotifications({
    userId: user?.id ?? null,
    role: "dispatcher",
    chatOpen,
    activeThread: activeChatThread,
  });
  const [walkieOpen, setWalkieOpen] = useState(false);

  const savePushSubFn = useServerFn(saveDriverPushSubscription);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("call_sign").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.call_sign) setCallSign(data.call_sign); });

    // Nativní APK: push + lokální notifikace
    if (isNative()) {
      initPushNotifications();
      initLocalNotifications();
    }

    // Web Push (PWA/prohlížeč) – aby upozornění došlo i při zavřené aplikaci.
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        const reg = await navigator.serviceWorker.register("/sw-push.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
        }
        const json: any = sub.toJSON();
        await savePushSubFn({
          data: {
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
            user_agent: navigator.userAgent.slice(0, 500),
          },
        });
      } catch (e) {
        console.warn("Push subscribe failed", e);
      }
    })();
  }, [user, savePushSubFn]);

  const loadDrivers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    let ids = (roles ?? []).map((r: any) => r.user_id);
    if (user?.id !== ALLOWED_DISPATCHER_ID) ids = ids.filter((id: string) => id !== HIDDEN_DRIVER_ID);
    if (!ids.length) { setDrivers([]); return; }
    const [{ data: profs }, { data: locs }, { data: vehs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,call_sign").in("id", ids),
      supabase.from("driver_locations").select("driver_id,online,busy,vehicle_id").in("driver_id", ids),
      supabase.from("vehicles").select("id,car_type,plate"),
    ]);
    const vehMap: Record<string, string> = {};
    (vehs ?? []).forEach((v: any) => { vehMap[v.id] = v.car_type || v.plate || ""; });
    const locMap: Record<string, { online: boolean; busy: boolean; vehicle_id: string | null }> = {};
    (locs ?? []).forEach((l: any) => { locMap[l.driver_id] = { online: l.online, busy: !!l.busy, vehicle_id: l.vehicle_id }; });
    setDrivers((profs ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, call_sign: p.call_sign,
      online: !!locMap[p.id]?.online,
      busy: !!locMap[p.id]?.busy,
      car_type: (locMap[p.id]?.vehicle_id && vehMap[locMap[p.id]!.vehicle_id!]) || "",
    })).sort((a, b) =>
      (a.call_sign || "").localeCompare(b.call_sign || "", "cs") ||
      (a.full_name || "").localeCompare(b.full_name || "", "cs") ||
      a.id.localeCompare(b.id)
    ));
  };

  // Zvukový signál + notifikace na novou zákaznickou objednávku.
  const seenCustomerRef = useRef<Set<string> | null>(null);
  const alertCustomerOrder = (o: Order) => {
    const title = "🧾 OBJEDNÁVKA OD ZÁKAZNÍKA";
    const body = `${o.pickup_address}${o.destination ? ` → ${o.destination}` : ""}`;
    toast.success(title, { description: body, duration: 20000 });
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch {}
    showLocalNotification(title, body);
    setUnseenCustomer((prev) => (prev.includes(o.id) ? prev : [...prev, o.id]));
    playGlassClink();
  };

  // Cinkání skleniček se opakuje, dokud dispečer objednávku nezobrazí.
  useEffect(() => {
    if (unseenCustomer.length === 0) return;
    const id = window.setInterval(() => playGlassClink(), 3500);
    return () => window.clearInterval(id);
  }, [unseenCustomer.length]);

  // Otevření detailu zakázky = "zobrazeno" → ztlumit cinkání.
  useEffect(() => {
    if (editOrder) setUnseenCustomer((prev) => prev.filter((id) => id !== editOrder.id));
  }, [editOrder]);

  const [customerOrdersOn, setCustomerOrdersOn] = useState(true);
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "customer_orders")
      .maybeSingle()
      .then(({ data }: any) => setCustomerOrdersOn((data?.value as any)?.enabled !== false));
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      const { data } = await supabase.from("orders").select("*");
      const rows = (data ?? []) as Order[];
      const customerIds = rows.filter((o) => o.source === "customer").map((o) => o.id);
      if (seenCustomerRef.current === null) {
        seenCustomerRef.current = new Set(customerIds);
      } else {
        rows
          .filter((o) => o.source === "customer" && !seenCustomerRef.current!.has(o.id))
          .forEach((o) => { seenCustomerRef.current!.add(o.id); alertCustomerOrder(o); });
      }
      setOrders(rows);
    };
    loadOrders(); loadDrivers();

    // Automatická aktualizace každých 5 sekund
    const poll = window.setInterval(() => { loadOrders(); loadDrivers(); }, 5000);

    const ch = supabase.channel("dispatch_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => loadDrivers())
      .subscribe();
    return () => { window.clearInterval(poll); supabase.removeChannel(ch); };
  }, []);

  // Upozornění: hodinu před plánovaným časem zakázky, která ještě není uvolněná.
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}
    const check = () => {
      const now = Date.now();
      orders.forEach((o) => {
        if (!o.scheduled_time || o.released) return;
        if (o.status === "completed" || o.status === "cancelled") return;
        const t = new Date(o.scheduled_time).getTime();
        const diff = t - now;
        // 0 < diff <= 60min => připomenout (jednou)
        if (diff > 0 && diff <= 60 * 60_000 && !notifiedRef.current.has(o.id)) {
          notifiedRef.current.add(o.id);
          const mins = Math.max(1, Math.round(diff / 60_000));
          const title = "⏰ UVOLNI ZAKÁZKU";
          const body = `Za ${mins} min: ${o.pickup_address}`;
          toast.warning(title, { description: body, duration: 15000 });
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(title, { body });
            }
          } catch {}
          try {
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
            if (Ctx) {
              const ctx = new Ctx();
              const o1 = ctx.createOscillator();
              const g = ctx.createGain();
              o1.type = "square"; o1.frequency.value = 880;
              g.gain.setValueAtTime(0.0001, ctx.currentTime);
              g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
              g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
              o1.connect(g).connect(ctx.destination);
              o1.start(); o1.stop(ctx.currentTime + 0.65);
              setTimeout(() => ctx.close().catch(() => {}), 1000);
            }
          } catch {}
        }
      });
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [orders]);



  if (loading) return null;
  if (role && role !== "dispatcher") return <Navigate to="/driver" />;

  const assignDrivers = async (orderId: string, driverIds: string[]) => {
    const clean = Array.from(new Set(driverIds.filter(Boolean))).slice(0, 4);
    const { error } = await supabase.from("orders")
      .update({
        assigned_driver_id: clean[0] ?? null,
        assigned_driver_ids: clean,
        status: clean.length ? "assigned" : "pending",
      })
      .eq("id", orderId);
    if (error) toast.error(error.message); else toast.success("▸ PŘIŘAZENO");
  };


  const cancelOrder = async (orderId: string) => {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  };

  const releaseOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ released: true }).eq("id", orderId);
    if (error) toast.error(error.message); else toast.success("▸ UVOLNĚNO PRO ŘIDIČE");
  };

  const lockOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ released: false }).eq("id", orderId);
    if (error) toast.error(error.message); else toast.success("▸ ZAKÁZKA UZAMČENA");
  };


  const setApproval = async (
    orderId: string,
    approval: "approved" | "rejected",
    scheduled?: string | null,
  ) => {
    // Předobjednávka (na později) zůstává zamčená a čeká na ruční uvolnění dispečerem.
    const isScheduled = !!scheduled && new Date(scheduled).getTime() > Date.now();
    const { error } = await supabase
      .from("orders")
      .update(
        approval === "approved"
          ? ({ approval: "approved", released: !isScheduled } as any)
          : ({ approval: "rejected", status: "cancelled" } as any),
      )
      .eq("id", orderId);
    if (error) toast.error(error.message);
    else toast.success(approval === "approved" ? "▸ OBJEDNÁVKA POVOLENA" : "▸ OBJEDNÁVKA ODMÍTNUTA");
  };

  const toggleCustomerOrders = async () => {
    const next = !customerOrdersOn;
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "customer_orders", value: { enabled: next } } as any, { onConflict: "key" });
    if (error) { toast.error(error.message); return; }
    setCustomerOrdersOn(next);
    toast.success(next ? "▸ PŘÍJEM OBJEDNÁVEK ZAPNUT" : "▸ PŘÍJEM OBJEDNÁVEK VYPNUT");
  };

  const togglePriority = async (orderId: string, next: boolean) => {
    const { error } = await supabase.from("orders").update({ priority: next }).eq("id", orderId);
    if (error) toast.error(error.message); else toast.success(next ? "▸ OZNAČENO JAKO URGENTNÍ" : "▸ PRIORITA ZRUŠENA");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SOSAlerts currentUserId={user?.id} isDispatcher={true} />
      <header className="border-b border-primary/40 px-3 pt-3 pb-2">
        <div className="flex justify-center -mx-3">
          <img
            src={logoVinneTaxi}
            alt="VINNÉ TAXI"
            className="h-10 sm:h-12 w-full object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl text-primary glow-text font-display truncate">▸ DISPEČINK · {callSign}</h1>
            <div className="text-[10px] text-muted-foreground">VINNÉ TAXI · {drivers.filter(d => d.online).length}/{drivers.length} ONLINE</div>
            <button onClick={() => supabase.auth.signOut()} className="mt-1 border border-primary/40 px-4 py-2 text-sm hover:border-primary flex items-center gap-1">
              <LogOut className="w-4 h-4" /> ODHLÁSIT
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={toggleCustomerOrders}
              className={`border px-3 py-2 text-sm flex items-center gap-1 ${
                customerOrdersOn
                  ? "border-primary text-primary"
                  : "border-destructive text-destructive animate-pulse"
              }`}
              title="Příjem objednávek ze zákaznické aplikace"
            >
              {customerOrdersOn ? "🟢 PŘÍJEM ZAP" : "🔴 PŘÍJEM VYP"}
            </button>
            <button onClick={() => setShowMap(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <MapIcon className="w-4 h-4" /> MAPA
            </button>
            <button onClick={() => setShowArchive(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <Archive className="w-4 h-4" /> ARCHIV
            </button>
            <button onClick={() => setShowVehicles(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <Car className="w-4 h-4" /> AUTA
            </button>
            <button onClick={() => setShowTariffs(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              💰 CENÍK
            </button>

            <button onClick={() => setShowDriverForm(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> ŘIDIČ
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className={`relative border-2 px-3 py-2 text-sm font-bold flex items-center gap-1 ${chatNotif.totalUnread > 0 ? "chat-blink-blue" : ""}`}
              style={
                chatNotif.totalUnread > 0
                  ? { borderColor: "#2563eb", backgroundColor: "#2563eb", color: "#ffffff" }
                  : { borderColor: "#16a34a", backgroundColor: "#16a34a", color: "#ffffff" }
              }
            >
              {chatNotif.totalUnread > 0 ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />} CHAT
              {chatNotif.totalUnread > 0 && (
                <span className="absolute -top-2 -right-2 bg-cyan-300 text-black text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-black">
                  {chatNotif.totalUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setWalkieOpen((v) => !v)}
              className="border-2 px-3 py-2 text-sm font-bold flex items-center gap-1"
              style={{ borderColor: "#2563eb", backgroundColor: "#2563eb", color: "#ffffff" }}
            >
              📻 VYSÍLAČKA
            </button>
          </div>
        </div>
      </header>


      <div className="flex-1 flex flex-col">



        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="border-b border-primary/40 p-2">
            <div className="text-[10px] text-muted-foreground mb-1">ŘIDIČI ({drivers.length})</div>
            {drivers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-1">Žádní řidiči. Klikni ŘIDIČ pro založení.</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDriverDetail(d)}
                    className={`text-[10px] px-2 py-1 border hover:bg-primary/10 ${
                      d.busy ? "border-amber-warn text-amber-warn" :
                      d.online ? "border-primary text-primary" :
                      "border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {d.online ? (d.busy ? "◐" : "●") : "○"} {d.call_sign} · {d.car_type || d.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-b border-primary/40 p-3 flex items-center justify-between">
            <h2 className="font-display text-primary">ZAKÁZKY ({orders.filter(o => o.status !== "completed" && o.status !== "cancelled").length})</h2>
            <button onClick={() => setShowForm(true)} className="border border-primary px-2 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1 glow">
              <Plus className="w-3 h-3" /> NOVÁ
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const active = orders
                .filter(o => o.status !== "completed" && o.status !== "cancelled")
                .sort(sortByTimeAsc);
              if (!active.length) return <div className="p-6 text-center text-muted-foreground text-xs">Žádné aktivní zakázky.</div>;
              return active.map((o) => {
              const isAssignedUnconfirmed = o.status === "assigned";
              const isPendingUnassigned = o.status === "pending" && !o.assigned_driver_id;
              const isAcceptedByDriver = o.status === "accepted" || o.status === "in_progress";
              const isCustomerOrder = o.source === "customer";
              const needsApproval = isCustomerOrder && o.approval === "pending";
              const cardClass = isCustomerOrder
                ? "border-2 border-purple-500 bg-purple-500/10"
                : !o.released
                ? "border-amber-warn/40 bg-amber-warn/5"
                : isAssignedUnconfirmed
                ? "border-2 border-orange-500 bg-orange-500/10 blink"
                : isPendingUnassigned
                ? "border-orange-500/70 bg-orange-500/5"
                : isAcceptedByDriver
                ? "border-2 border-blue-500 bg-blue-500/10"
                : "border-primary/20";
              return (
              <div key={o.id} className={`border-b p-3 text-sm ${cardClass}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {isCustomerOrder && (
                      <div className="text-[10px] font-bold tracking-widest text-purple-400">
                        🟣 OBJEDNÁVKA ZÁKAZNÍK
                      </div>
                    )}
                    <div className="text-primary font-bold truncate">▸ {o.pickup_address}</div>
                    {o.destination && <div className="text-muted-foreground truncate">→ {o.destination}</div>}
                    <div className="text-sm text-primary mt-1 font-medium">
                      {o.scheduled_time ? `⏱ ${new Date(o.scheduled_time).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "⏱ HNED"}
                      {" · "}👥 {o.passengers}
                      {o.vehicle_type ? (
                        o.vehicle_type === "limo" || o.vehicle_type === "vip_limuzina" ? (
                          <span className="inline-flex items-center gap-1 align-middle">
                            {" · "}
                            <img src={limoSide} alt="Limuzína" loading="lazy" width={1024} height={512}
                              className="h-3.5 w-auto shrink-0 object-contain drop-shadow" />
                            LIMUZÍNA
                          </span>
                        ) : o.vehicle_type === "vip_tesla" || o.vehicle_type === "tesla" ? (
                          <span className="inline-block ml-1 align-middle px-1.5 py-0.5 border border-cyan-300 text-cyan-200 bg-cyan-400/15 text-[10px] font-bold tracking-wide">
                            ⚡ VIP TESLA
                          </span>
                        ) : (
                          ` · ${
                            o.vehicle_type === "van" || o.vehicle_type === "dodavka"
                              ? "🚐 DODÁVKA"
                              : "🚗 OSOBNÍ"
                          }`
                        )
                      ) : ""}
                    </div>
                    {o.estimated_price != null && (
                      <div className="text-sm font-bold text-purple-300 mt-0.5">
                        💰 {Math.round(Number(o.estimated_price))} Kč
                        {o.estimated_distance_km != null ? ` · ${Number(o.estimated_distance_km).toFixed(1)} km` : ""}
                        <span className="text-[10px] text-muted-foreground">
                          {o.source === "customer" ? " (odhad zákazník)" : " (odhad)"}
                        </span>
                      </div>
                    )}
                    {o.driver_arrived_at && o.status !== "completed" && o.status !== "cancelled" && (
                      <div className="mt-1 inline-block text-[11px] font-bold px-2 py-0.5 border-2 border-blue-400 text-blue-200 bg-blue-500/20 blink">
                        🚕 ŘIDIČ JE U ZÁKAZNÍKA · {new Date(o.driver_arrived_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                    {o.notes && <div className="text-xs text-amber-warn truncate">⚠ {o.notes}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      🕒 VYTVOŘENO: {new Date(o.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
                    </div>


                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {o.priority && (
                      <span className="text-[10px] px-1.5 py-0.5 border border-destructive text-destructive font-bold blink">🚨 URGENT</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 border ${
                      isAcceptedByDriver ? "border-blue-500 text-blue-500" :
                      isAssignedUnconfirmed ? "border-orange-500 text-orange-500 blink" :
                      o.status === "pending" ? "border-orange-500 text-orange-500" :
                      "border-primary text-primary"
                    }`}>{STATUS_LABEL[o.status]}</span>
                    {!o.released && (
                      <span className="text-[10px] px-1.5 py-0.5 border border-amber-warn text-amber-warn">🔒 NEUVOLNĚNO</span>
                    )}
                  </div>
                </div>

                {needsApproval && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setApproval(o.id, "approved", o.scheduled_time)}
                      className="flex-1 border border-primary text-primary py-1.5 text-[11px] font-bold hover:bg-primary hover:text-primary-foreground"
                    >
                      ✔ POVOLIT
                    </button>
                    <button
                      onClick={() => setApproval(o.id, "rejected")}
                      className="flex-1 border border-destructive text-destructive py-1.5 text-[11px] font-bold hover:bg-destructive hover:text-white"
                    >
                      ✖ ODMÍTNOUT
                    </button>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setEditOrder(o)}
                    className="flex-1 border border-primary text-primary py-1.5 text-[11px] font-bold hover:bg-primary hover:text-primary-foreground"
                  >
                    ▸ DETAIL / UPRAVIT
                  </button>
                  <button
                    onClick={() => togglePriority(o.id, !o.priority)}
                    className={`flex-1 border py-1.5 text-[11px] font-bold ${
                      o.priority
                        ? "border-destructive text-destructive bg-destructive/10 urgent-flash"
                        : "border-destructive text-destructive hover:bg-destructive hover:text-white"
                    }`}
                  >
                    {o.priority ? "🚨 URGENT — ZRUŠIT" : "🚨 URGENT"}
                  </button>
                  {!o.released ? (
                    <button
                      onClick={() => releaseOrder(o.id)}
                      className="flex-1 border border-amber-warn text-amber-warn py-1.5 text-[11px] font-bold hover:bg-amber-warn hover:text-black"
                    >
                      🔓 UVOLNIT
                    </button>
                  ) : (
                    <button
                      onClick={() => lockOrder(o.id)}
                      className="flex-1 border border-amber-warn text-amber-warn py-1.5 text-[11px] font-bold hover:bg-amber-warn hover:text-black"
                    >
                      🔒 UZAMKNOUT
                    </button>
                  )}

                </div>
                <MultiDriverPicker
                  drivers={drivers}
                  value={(o.assigned_driver_ids && o.assigned_driver_ids.length ? o.assigned_driver_ids : (o.assigned_driver_id ? [o.assigned_driver_id] : []))}
                  onChange={(ids) => assignDrivers(o.id, ids)}
                  onCancel={() => cancelOrder(o.id)}
                />
              </div>
              );
              });

            })()}

          </div>
        </div>
      </div>

      {showMap && (
        <div className="fixed inset-0 z-[1500] bg-black flex flex-col">
          <div className="border-b border-primary/40 p-3 flex items-center justify-between">
            <h2 className="font-display text-primary glow-text">▸ MAPA · ŘIDIČI</h2>
            <button onClick={() => setShowMap(false)} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> ZAVŘÍT
            </button>
          </div>
          <div className="flex-1 min-h-0 p-2">
            <LiveMap showOrders showDriverList />
          </div>
        </div>
      )}

      {showArchive && (
        <div className="fixed inset-0 z-[1800] bg-black flex flex-col">
          <div className="border-b border-primary/40 p-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-primary glow-text">▸ ARCHIV JÍZD ({orders.filter(o => o.status === "completed" || o.status === "cancelled").length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const archived = orders.filter(o => o.status === "completed" || o.status === "cancelled");
                  if (archived.length === 0) { toast.message("Archiv je prázdný"); return; }
                  if (!confirm(`Opravdu vymazat ${archived.length} jízd z archivu? Tuto akci nelze vrátit.`)) return;
                  const ids = archived.map(o => o.id);
                  const { error } = await supabase.from("orders").delete().in("id", ids);
                  if (error) { toast.error(error.message); return; }
                  toast.success("▸ ARCHIV VYMAZÁN");
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 px-3 py-1 text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> VYMAZAT ARCHIV
              </button>
              <button onClick={() => setShowArchive(false)} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> ZAVŘÍT
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {orders.filter(o => o.status === "completed" || o.status === "cancelled").length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Archiv je prázdný.</div>
            ) : orders.filter(o => o.status === "completed" || o.status === "cancelled").map((o) => (
              <div key={o.id} onClick={() => setArchiveOrderDetail(o)} className="border-b border-primary/20 p-3 text-sm cursor-pointer hover:bg-primary/5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-primary truncate">▸ {o.pickup_address}</div>
                    {o.destination && <div className="text-muted-foreground truncate">→ {o.destination}</div>}
                    <div className="text-sm text-primary mt-1 font-medium">
                       {new Date(o.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
                       {" · "}👥 {o.passengers}
                     </div>
                    {o.estimated_price != null && (
                      <div className="text-sm font-bold text-purple-300 mt-0.5">💰 {Math.round(Number(o.estimated_price))} Kč</div>
                    )}
                    <div className="text-[10px] text-primary/60 mt-0.5">Klikni pro detail</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 border ${
                      o.status === "completed" ? "border-muted-foreground text-muted-foreground" :
                      "border-destructive text-destructive"
                    }`}>{STATUS_LABEL[o.status]}</span>
                    {o.status === "cancelled" && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Vrátit zakázku zpět do aktivních?")) return;
                          const { error } = await supabase.from("orders").update({
                            status: "pending",
                            assigned_driver_id: null,
                            assigned_driver_ids: [],
                            released: false,
                          }).eq("id", o.id);
                          if (error) { toast.error("Chyba: " + error.message); return; }
                          toast.success("▸ ZAKÁZKA VRÁCENA");
                        }}
                        className="text-[10px] px-2 py-1 border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        ↩ VRÁTIT
                      </button>
                    )}
                  </div>
                </div>
              </div>

            ))}
          </div>
        </div>
      )}

      {unseenCustomer.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 border-2 border-purple-400 bg-purple-950/90 backdrop-blur text-purple-100 text-xs font-bold blink">
          🥂 NOVÁ OBJEDNÁVKA OD ZÁKAZNÍKA ({unseenCustomer.length})
          <button
            onClick={() => setUnseenCustomer([])}
            title="Potvrdit upozornění (ztlumit zvuk)"
            className="px-2 py-1 border-2 border-green-400 text-green-300 font-black hover:bg-green-400 hover:text-black"
          >
            ✔ PŘIJMOUT
          </button>
          <button
            onClick={() => {
              const o = orders.find((x) => x.id === unseenCustomer[0]);
              if (o) setEditOrder(o);
              else setUnseenCustomer([]);
            }}
            className="px-2 py-1 border border-purple-300 hover:bg-purple-300 hover:text-black"
          >
            ZOBRAZIT
          </button>

        </div>
      )}

      {showForm && <NewOrderModal onClose={() => setShowForm(false)} userId={user!.id} />}
      {showDriverForm && <NewDriverModal onClose={() => setShowDriverForm(false)} onCreated={loadDrivers} />}
      {driverDetail && <DriverDetailModal driver={driverDetail} onClose={() => setDriverDetail(null)} onChanged={loadDrivers} />}
      {archiveOrderDetail && <ArchiveOrderDetailModal order={archiveOrderDetail} onClose={() => setArchiveOrderDetail(null)} />}
      {editOrder && <OrderEditModal order={editOrder} onClose={() => setEditOrder(null)} />}
      {showVehicles && <VehiclesModal onClose={() => setShowVehicles(false)} />}
      {showTariffs && <TariffsModal onClose={() => setShowTariffs(false)} />}


      {user && <WalkieTalkie userId={user.id} callSign={callSign} open={walkieOpen} onClose={() => setWalkieOpen(false)} />}
      {user && (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          currentUserId={user.id}
          currentUserName={callSign}
          viewerRole="dispatcher"
          unread={chatNotif.unread}
          onActiveThreadChange={setActiveChatThread}
          markRead={chatNotif.markRead}
        />
      )}
    </div>
  );
}

function NewOrderModal({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat?: number; lng?: number }>({});
  const [destination, setDestination] = useState("");
  const [destCoords, setDestCoords] = useState<{ lat?: number; lng?: number }>({});
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledTime, setScheduledTime] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [vehicleType, setVehicleType] = useState<"car" | "van" | "limo">("car");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const notifyNewOrderFn = useServerFn(notifyNewOrder);
  const estimateFn = useServerFn(estimateRide);

  const [km, setKm] = useState<number | null>(null);
  const [est, setEst] = useState<any>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [priceOverride, setPriceOverride] = useState("");

  const autoPrice: number | null =
    est?.options?.find((o: any) => o.vehicle_type === TARIFF_KEY[vehicleType])?.price ?? null;
  const parsedOverride = parseFloat(priceOverride.replace(",", "."));
  const finalPrice: number | null =
    priceOverride.trim() && isFinite(parsedOverride) ? parsedOverride : autoPrice;

  // Vzdálenost po silnici, jakmile jsou známé obě adresy.
  useEffect(() => {
    if (pickupCoords.lat == null || destCoords.lat == null) { setKm(null); setEst(null); return; }
    let cancelled = false;
    setCalcBusy(true);
    estimateFn({
      data: {
        pickup: { address: pickup, lat: pickupCoords.lat, lng: pickupCoords.lng! },
        destination: { address: destination, lat: destCoords.lat, lng: destCoords.lng! },
        when: when === "later" && scheduledTime ? new Date(scheduledTime).toISOString() : null,
      },
    })
      .then((r: any) => { if (!cancelled) { setKm(r?.km ?? null); setEst(r ?? null); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCalcBusy(false); });
    return () => { cancelled = true; };
  }, [pickupCoords.lat, pickupCoords.lng, destCoords.lat, destCoords.lng, when, scheduledTime, estimateFn]);






  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("orders").insert({
      pickup_address: pickup,
      pickup_lat: pickupCoords.lat ?? null,
      pickup_lng: pickupCoords.lng ?? null,
      destination: destination || null,
      destination_lat: destCoords.lat ?? null,
      destination_lng: destCoords.lng ?? null,
      scheduled_time: when === "later" && scheduledTime ? new Date(scheduledTime).toISOString() : null,
      passengers,
      vehicle_type: vehicleType,
      notes: notes || null,
      estimated_price: finalPrice ?? null,
      estimated_distance_km: km ?? null,


      customer_phone: customerPhone || null,
      created_by: userId,
      status: "pending",
      // Plánované zakázky se vytvářejí jako neuvolněné – dispečer je uvolní tlačítkem.
      released: when === "later" ? false : true,
      priority,
      tracking_code: makeTrackingCode(),
    }).select("id").maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ZAKÁZKA ODESLÁNA");
    onClose();

    // Push notifikace řidičům (přiřazený nebo všichni online u pending).
    if (inserted?.id && when === "now") {
      notifyNewOrderFn({ data: { order_id: inserted.id } }).catch((e) => console.warn("notify failed", e));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-black border border-primary glow p-5 max-w-md w-full space-y-3 my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ NOVÁ ZAKÁZKA</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <AddressAutocomplete
          label="ODKUD (adresa vyzvednutí) *"
          value={pickup}
          onChange={(v) => { setPickup(v); setPickupCoords({}); }}
          onSelect={(p) => { setPickup(p.address); setPickupCoords({ lat: p.lat, lng: p.lng }); }}
          required
        />
        <AddressAutocomplete
          label="KAM (cíl)"
          value={destination}
          onChange={(v) => { setDestination(v); setDestCoords({}); }}
          onSelect={(p) => { setDestination(p.address); setDestCoords({ lat: p.lat, lng: p.lng }); }}
        />


        <div>
          <div className="text-[10px] text-muted-foreground mb-1">ČAS</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {(["now", "later"] as const).map((w) => (
              <button key={w} type="button" onClick={() => setWhen(w)}
                className={`border py-1.5 text-xs ${when === w ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {w === "now" ? "▸ HNED" : "▸ NAPLÁNOVAT"}
              </button>
            ))}
          </div>
          {when === "later" && (
            <input type="datetime-local" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required
              className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm" />
          )}
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">TYP AUTA</div>
          <div className="grid grid-cols-3 gap-2">
            {([["car", "🚗 OSOBNÍ"], ["van", "🚐 DODÁVKA"], ["limo", "LIMUZÍNA"]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setVehicleType(v)}
                className={`border py-1.5 px-1 text-[11px] leading-none flex items-center justify-center gap-1 whitespace-nowrap ${vehicleType === v ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {v === "limo" && (
                  <img src={limoSide} alt="" loading="lazy" width={1024} height={512} className="h-3.5 w-auto shrink-0 object-contain" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">POČET OSOB ({passengers})</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPassengers(Math.max(1, passengers - 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">−</button>
            <input
              type="number" min={1} max={30} value={passengers}
              onChange={(e) => setPassengers(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-input border border-primary/40 px-2 py-2 text-primary text-center text-lg"
            />
            <button type="button" onClick={() => setPassengers(Math.min(30, passengers + 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">+</button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Max. 30 osob</div>
        </div>

        <div className="border border-primary/40 p-2 bg-primary/5">
          <div className="text-[10px] text-muted-foreground mb-1">CENA (stejný výpočet jako v aplikaci pro zákazníka)</div>
          {calcBusy ? (
            <div className="text-xs text-muted-foreground">▸ POČÍTÁM CENU...</div>
          ) : autoPrice != null ? (
            <div className="text-primary font-display text-lg">
              💰 {Math.round(autoPrice)} Kč
              {km != null && <span className="text-[11px] text-muted-foreground"> · {km.toFixed(1)} km</span>}
              {est?.weekend && <span className="text-[11px] text-amber-warn"> · VÍKEND</span>}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Zadej adresu vyzvednutí i cíl (výběr z našeptávače).</div>
          )}
          {est?.options?.find((o: any) => o.vehicle_type === TARIFF_KEY[vehicleType])?.fare_note && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {est.options.find((o: any) => o.vehicle_type === TARIFF_KEY[vehicleType]).fare_note}
            </div>
          )}
          <input
            type="number" inputMode="decimal" min={0} step={10}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
            placeholder="Vlastní cena (Kč) – nepovinné"
            className="mt-2 w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
        </div>


        <div>
          <div className="text-[10px] text-muted-foreground mb-1">TELEFON ZÁKAZNÍKA (nepovinné)</div>
          <input
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+420 ... (volitelné)"
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
        </div>


        <In label="POZNÁMKA (nepovinné)" value={notes} onChange={setNotes} />

        <button
          type="button"
          onClick={() => setPriority((v) => !v)}
          className={`w-full border py-2 text-xs font-bold ${
            priority
              ? "border-destructive bg-destructive text-white blink"
              : "border-destructive/60 text-destructive hover:bg-destructive/10"
          }`}
        >
          {priority ? "🚨 URGENTNÍ – KLIKNI PRO ZRUŠENÍ" : "🚨 OZNAČIT JAKO URGENTNÍ / PRIORITNÍ"}
        </button>

        <button disabled={submitting} className="w-full border border-primary text-primary py-2 hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
          {submitting ? "▸ ODESÍLÁM..." : "▸ ODESLAT"}
        </button>
      </form>
    </div>
  );
}

function NewDriverModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createDriverFn = useServerFn(createDriver);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [callSign, setCallSign] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createDriverFn({ data: { email, password, full_name: fullName, call_sign: callSign } });
      toast.success(`▸ ŘIDIČ ${callSign} ZALOŽEN`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba při zakládání řidiče");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-black border border-primary glow p-5 max-w-md w-full space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ NOVÝ ŘIDIČ</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <In label="CELÉ JMÉNO *" value={fullName} onChange={setFullName} required />
        <In label="VOLACÍ ZNAK (např. ALFA-3) *" value={callSign} onChange={setCallSign} required />
        <In label="EMAIL *" value={email} onChange={setEmail} required />
        <In label="HESLO (min. 6) *" value={password} onChange={setPassword} required />
        <div className="text-[10px] text-muted-foreground">
          Tyto přihlašovací údaje předej řidiči. Heslo si později může změnit.
        </div>
        <button disabled={submitting} className="w-full border border-primary text-primary py-2 hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
          {submitting ? "▸ ZAKLÁDÁM..." : "▸ ZALOŽIT ŘIDIČE"}
        </button>
      </form>
    </div>
  );
}

function MultiDriverPicker({ drivers, value, onChange, onCancel }: {
  drivers: Driver[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const slots = [0, 1, 2, 3];
  const setAt = (idx: number, id: string) => {
    const next = [...value];
    if (id) next[idx] = id; else next.splice(idx, 1);
    onChange(next.filter(Boolean));
  };
  return (
    <div className="mt-2 space-y-1">
      {slots.map((i) => {
        const current = value[i] ?? "";
        if (i > 0 && !value[i - 1]) return null;
        return (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-[10px] text-muted-foreground w-8">#{i + 1}</span>
            <select
              value={current}
              onChange={(e) => setAt(i, e.target.value)}
              className="flex-1 bg-input border border-primary/40 text-xs px-2 py-1 text-primary"
            >
              <option value="">— {i === 0 ? "vyber řidiče" : "další auto (volitelné)"} —</option>
              {drivers
                .filter((d) => !value.includes(d.id) || d.id === current)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.call_sign} · {d.car_type || d.full_name} {d.online ? "●" : "○"}
                  </option>
                ))}
            </select>
            {i === 0 && (
              <button onClick={onCancel} className="text-destructive hover:text-red-400 p-1" title="Zrušit zakázku">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
      {value.length > 0 && (
        <div className="text-[10px] text-primary/70">▸ Přiřazeno {value.length} / 4 aut</div>
      )}
    </div>
  );
}

function In({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {

  return (
    <label className="block">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none" />
    </label>
  );
}

type Payout = { id: string; amount: number; reason: string; created_at: string };

function DriverDetailModal({ driver, onClose, onChanged }: { driver: Driver; onClose: () => void; onChanged: () => void }) {
  const updateDriverFn = useServerFn(updateDriver);
  const deleteDriverFn = useServerFn(deleteDriver);
  const resetDriverRidesFn = useServerFn(resetDriverRides);
  const deleteRideFn = useServerFn(deleteRide);
  const getDriverEmailFn = useServerFn(getDriverEmail);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(driver.full_name);
  const [callSign, setCallSign] = useState(driver.call_sign);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");


  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("rides")
        .select("id,driver_id,amount,payment_method,pickup_address,destination,completed_at")
        .eq("driver_id", driver.id)
        .order("completed_at", { ascending: false }),
      supabase.from("cash_payouts")
        .select("id,amount,reason,created_at")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false }),
    ]).then(([r, p]) => {
      setRides((r.data ?? []) as Ride[]);
      setPayouts((p.data ?? []) as Payout[]);
      setLoading(false);
    });
  }, [driver.id, refreshKey]);

  const cashRaw = rides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Number(r.amount), 0);
  const card = rides.filter(r => r.payment_method === "card").reduce((s, r) => s + Number(r.amount), 0);
  const invoice = rides.filter(r => r.payment_method === "invoice").reduce((s, r) => s + Number(r.amount), 0);
  const payoutsTotal = payouts.reduce((s, p) => s + Number(p.amount), 0);
  const cash = cashRaw - payoutsTotal;
  const total = cashRaw + card + invoice - payoutsTotal;

  const saveEdit = async () => {
    setBusy(true);
    try {
      await updateDriverFn({ data: {
        driver_id: driver.id,
        full_name: fullName !== driver.full_name ? fullName : undefined,
        call_sign: callSign !== driver.call_sign ? callSign : undefined,
        password: password ? password : undefined,
      }});
      toast.success("▸ ULOŽENO");
      setPassword("");
      setEditing(false);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
    finally { setBusy(false); }
  };

  const doReset = async () => {
    if (!confirm(`Opravdu vynulovat tržby a smazat všechny jízdy řidiče ${driver.call_sign}?`)) return;
    setBusy(true);
    try {
      await resetDriverRidesFn({ data: { driver_id: driver.id } });
      await supabase.from("cash_payouts").delete().eq("driver_id", driver.id);
      toast.success("▸ TRŽBY VYNULOVÁNY");
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!confirm(`SMAZAT řidiče ${driver.call_sign} (${driver.full_name})? Akce je nevratná.`)) return;
    setBusy(true);
    try {
      await deleteDriverFn({ data: { driver_id: driver.id } });
      toast.success("▸ ŘIDIČ SMAZÁN");
      onChanged();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Chyba"); setBusy(false); }
  };

  const addPayout = async () => {
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) { toast.error("Zadej částku"); return; }
    const reason = payoutReason.trim();
    if (!reason) { toast.error("Zadej důvod"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("cash_payouts").insert({
      driver_id: driver.id, amount: amt, reason, created_by: user?.id as string,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ VÝDEJ ZAPSÁN");
    setPayoutAmount(""); setPayoutReason(""); setPayoutOpen(false);
    setRefreshKey(k => k + 1);
  };

  const deletePayout = async (id: string) => {
    if (!confirm("Smazat výdej hotovosti?")) return;
    const { error } = await supabase.from("cash_payouts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ VÝDEJ SMAZÁN");
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="fixed inset-0 bg-black z-[1900] flex flex-col">
      <div className="border-b border-primary/40 p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-primary glow-text truncate">▸ {driver.call_sign} · {driver.full_name}</h2>
          <div className="text-[10px] text-muted-foreground">
            {driver.online ? (driver.busy ? "◐ ONLINE · OBSAZENO" : "● ONLINE · VOLNÝ") : "○ OFFLINE"}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={async () => {
              const next = !driver.online;
              if (!confirm(next ? "Zapnout řidiči stav ONLINE?" : "Vypnout řidiči stav (OFFLINE)?")) return;
              const { error } = await supabase
                .from("driver_locations")
                .update({ online: next, busy: next ? driver.busy : false })
                .eq("driver_id", driver.id);
              if (error) { toast.error(error.message); return; }
              toast.success(next ? "▸ ŘIDIČ ONLINE" : "▸ ŘIDIČ OFFLINE");
            }}
            className={`border px-2 py-1 text-[10px] ${driver.online ? "border-destructive text-destructive hover:bg-destructive/10" : "border-primary text-primary hover:bg-primary/10"}`}
          >
            {driver.online ? "VYPNOUT" : "ZAPNOUT"}
          </button>
          <button onClick={onClose} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> ZAVŘÍT
          </button>
        </div>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-primary/40">
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">HOTOVĚ</div>
          <div className="text-base text-primary font-display">{cash.toFixed(0)} Kč</div>
          {payoutsTotal > 0 && (
            <div className="text-[9px] text-amber-warn">−{payoutsTotal.toFixed(0)} výdej</div>
          )}
        </div>
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">KARTOU</div>
          <div className="text-base text-primary font-display">{card.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">FAKTURA/QR</div>
          <div className="text-base text-primary font-display">{invoice.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary p-2 glow">
          <div className="text-[10px] text-muted-foreground">CELKEM ({rides.length})</div>
          <div className="text-base text-primary font-display">{total.toFixed(0)} Kč</div>
        </div>
      </div>

      <div className="px-3 pt-3 border-b border-primary/40 pb-3">
        <button onClick={() => setPayoutOpen(o => !o)}
          className="w-full border border-amber-warn text-amber-warn p-2 text-xs hover:bg-amber-warn/10 flex items-center justify-between">
          <span>▸ VÝDEJ HOTOVOSTI {payoutsTotal > 0 && `(−${payoutsTotal.toFixed(0)} Kč)`}</span>
          <span>{payoutOpen ? "▲" : "▼"}</span>
        </button>
        {payoutOpen && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <In label="ČÁSTKA (Kč)" value={payoutAmount} onChange={setPayoutAmount} />
              <In label="DŮVOD" value={payoutReason} onChange={setPayoutReason} />
            </div>
            <button onClick={addPayout} disabled={busy}
              className="w-full border border-amber-warn bg-amber-warn/10 text-amber-warn px-3 py-1.5 text-xs hover:bg-amber-warn/20 disabled:opacity-50">
              ▸ PŘIDAT VÝDEJ
            </button>
            {payouts.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-auto">
                {payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border border-amber-warn/40 p-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-amber-warn font-display">−{Number(p.amount).toFixed(0)} Kč</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.reason}</div>
                      <div className="text-[9px] text-muted-foreground">{new Date(p.created_at).toLocaleString("cs-CZ")}</div>
                    </div>
                    <button onClick={() => deletePayout(p.id)}
                      className="text-destructive border border-destructive/60 px-2 py-1 hover:bg-destructive/10">
                      SMAZAT
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-b border-primary/40 space-y-2">
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => {
                setEditing(true);
                if (!email) {
                  setEmailLoading(true);
                  try {
                    const res = await getDriverEmailFn({ data: { driver_id: driver.id } });
                    setEmail(res.email);
                  } catch (e: any) { toast.error(e?.message ?? "Nelze načíst email"); }
                  finally { setEmailLoading(false); }
                }
              }} disabled={busy}
              className="border border-primary/60 text-primary px-3 py-1.5 text-xs hover:bg-primary/10 disabled:opacity-50">
              ▸ UPRAVIT / ZMĚNIT HESLO
            </button>

            <button
              onClick={() => {
                const lines: string[] = [];
                lines.push(`🚖 VINNÉ TAXI – ${driver.call_sign} (${driver.full_name})`);
                lines.push(`Datum: ${new Date().toLocaleString("cs-CZ")}`);
                lines.push(`Jízd: ${rides.length}`);
                lines.push(`Hotově: ${cashRaw.toFixed(0)} Kč · Kartou: ${card.toFixed(0)} Kč · Faktura/QR: ${invoice.toFixed(0)} Kč`);
                if (payoutsTotal > 0) lines.push(`Výdej hotovosti: −${payoutsTotal.toFixed(0)} Kč`);
                lines.push(`CELKEM: ${total.toFixed(0)} Kč`);
                lines.push("");
                lines.push("— JÍZDY —");
                rides.forEach((r, i) => {
                  const dt = new Date(r.completed_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
                  const route = `${r.pickup_address ?? "—"}${r.destination ? " → " + r.destination : ""}`;
                  lines.push(`${i + 1}. ${dt} · ${Number(r.amount).toFixed(0)} Kč ${PM_SHORT(r.payment_method)} · ${route}`);
                });
                if (payouts.length) {
                  lines.push("");
                  lines.push("— VÝDEJE HOTOVOSTI —");
                  payouts.forEach((p, i) => {
                    const dt = new Date(p.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
                    lines.push(`${i + 1}. ${dt} · −${Number(p.amount).toFixed(0)} Kč · ${p.reason || ""}`);
                  });
                }
                const text = lines.join("\n");
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank");
              }}
              disabled={busy || rides.length === 0}
              className="border border-green-500 text-green-500 px-3 py-1.5 text-xs hover:bg-green-500/10 disabled:opacity-50"
            >
              ▸ SDÍLET WHATSAPP
            </button>
            <button onClick={doReset} disabled={busy}
              className="border border-amber-warn text-amber-warn px-3 py-1.5 text-xs hover:bg-amber-warn/10 disabled:opacity-50">
              ▸ VYNULOVAT TRŽBY
            </button>

            <button onClick={doDelete} disabled={busy}
              className="border border-destructive text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50 ml-auto">
              ▸ SMAZAT ŘIDIČE
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="border border-primary/40 bg-primary/5 p-2">
              <div className="text-[10px] text-muted-foreground">PŘIHLAŠOVACÍ EMAIL</div>
              <div className="text-sm text-primary font-mono break-all">
                {emailLoading ? "Načítám..." : (email ?? "—")}
              </div>
            </div>
            <div className="border border-amber-warn/40 bg-amber-warn/5 p-2 text-[10px] text-amber-warn">
              ⚠ Stávající heslo nelze zobrazit (je zašifrované). Pokud ho řidič zapomněl, nastav nové níže a předej mu ho.
            </div>
            <In label="CELÉ JMÉNO" value={fullName} onChange={setFullName} />
            <In label="VOLACÍ ZNAK" value={callSign} onChange={setCallSign} />
            <In label="NOVÉ HESLO (nech prázdné = neměnit, min. 6)" value={password} onChange={setPassword} />

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={busy}
                className="flex-1 border border-primary text-primary py-1.5 text-xs hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                {busy ? "▸ UKLÁDÁM..." : "▸ ULOŽIT"}
              </button>
              <button onClick={() => { setEditing(false); setPassword(""); setFullName(driver.full_name); setCallSign(driver.call_sign); }} disabled={busy}
                className="border border-muted-foreground text-muted-foreground px-3 py-1.5 text-xs hover:bg-muted/20">
                ZRUŠIT
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-6 text-center text-muted-foreground text-xs">Načítám...</div>}
        {!loading && rides.length === 0 && <div className="p-6 text-center text-muted-foreground text-xs">Žádné jízdy.</div>}
        {rides.map((r) => (
          <div key={r.id} className="border-b border-primary/20 p-3 text-sm flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-primary truncate">▸ {r.pickup_address ?? "—"}</div>
              {r.destination && <div className="text-xs text-muted-foreground truncate">→ {r.destination}</div>}
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.completed_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <div className="text-primary font-display">{Number(r.amount).toFixed(0)} Kč</div>
              <div className={`text-[10px] ${r.payment_method === "cash" ? "text-amber-warn" : "text-primary"}`}>
                {PM_LABEL(r.payment_method)}
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`Smazat tuto jízdu (${Number(r.amount).toFixed(0)} Kč)?`)) return;
                  try {
                    await deleteRideFn({ data: { ride_id: r.id } });
                    toast.success("▸ JÍZDA SMAZÁNA");
                    setRefreshKey(k => k + 1);
                  } catch (e: any) { toast.error(e?.message ?? "Chyba"); }
                }}
                disabled={busy}
                className="border border-destructive text-destructive px-2 py-0.5 text-[10px] hover:bg-destructive/10 disabled:opacity-50"
              >
                ▸ SMAZAT
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchiveOrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (order.assigned_driver_id) {
        const { data: d } = await supabase.from("profiles").select("full_name,call_sign").eq("id", order.assigned_driver_id).maybeSingle();
        setDriver(d);
      }
      const { data: r } = await supabase.from("rides").select("*").eq("order_id", order.id).maybeSingle();
      setRide(r);
      setLoading(false);
    };
    load();
  }, [order.id, order.assigned_driver_id]);

  return (
    <div className="fixed inset-0 z-[1900] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-black border border-primary glow p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-primary font-display text-lg">▸ DETAIL ZAKÁZKY</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="text-center text-muted-foreground text-xs">Načítám...</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] text-muted-foreground">ODKUD</div>
              <div className="text-primary font-bold">{order.pickup_address}</div>
            </div>
            {order.destination && (
              <div>
                <div className="text-[10px] text-muted-foreground">KAM</div>
                <div className="text-primary">{order.destination}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground">VYTVÁŘENO</div>
                <div className="text-primary">{new Date(order.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">STATUS</div>
                <div className="text-primary">{STATUS_LABEL[order.status]}</div>
              </div>
            </div>
            {driver ? (
              <div>
                <div className="text-[10px] text-muted-foreground">ŘIDIČ</div>
                <div className="text-primary">{driver.call_sign} · {driver.full_name}</div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] text-muted-foreground">ŘIDIČ</div>
                <div className="text-muted-foreground">Nepřiřazen</div>
              </div>
            )}
            {ride ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground">DOKONČENO</div>
                    <div className="text-primary">{new Date(ride.completed_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">ČÁSTKA</div>
                    <div className="text-primary font-display">{Number(ride.amount).toFixed(0)} Kč</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">PLATBA</div>
                  <div className={ride.payment_method === "cash" ? "text-amber-warn" : "text-primary"}>
                    {PM_LABEL(ride.payment_method)}
                  </div>
                </div>
              </>
            ) : order.status === "cancelled" ? (
              <div className="text-destructive text-xs">Zakázka byla zrušena — bez jízdy.</div>
            ) : (
              <div className="text-muted-foreground text-xs">Jízda nebyla zaznamenána.</div>
            )}
            {order.customer_phone && (
              <div>
                <div className="text-[10px] text-muted-foreground">TELEFON ZÁKAZNÍKA</div>
                <a href={`tel:${order.customer_phone}`} className="text-primary underline">{order.customer_phone}</a>
              </div>
            )}
            {order.notes && (
              <div>
                <div className="text-[10px] text-muted-foreground">POZNÁMKA</div>
                <div className="text-amber-warn text-xs">{order.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderEditModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [pickup, setPickup] = useState(order.pickup_address);
  const [pickupCoords, setPickupCoords] = useState<{ lat?: number | null; lng?: number | null }>({ lat: order.pickup_lat, lng: order.pickup_lng });
  const [destination, setDestination] = useState(order.destination ?? "");
  const [destCoords, setDestCoords] = useState<{ lat?: number | null; lng?: number | null }>({});
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [scheduledTime, setScheduledTime] = useState(toLocal(order.scheduled_time));
  const [passengers, setPassengers] = useState(order.passengers);
  const [vehicleType, setVehicleType] = useState<"car" | "van" | "limo">((order.vehicle_type as any) || "car");
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [price, setPrice] = useState(order.estimated_price != null ? String(Math.round(Number(order.estimated_price))) : "");
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const parsedPrice = parseFloat(price.replace(",", "."));
    const { error } = await supabase.from("orders").update({
      pickup_address: pickup,
      pickup_lat: pickupCoords.lat ?? null,
      pickup_lng: pickupCoords.lng ?? null,
      destination: destination || null,
      destination_lat: destCoords.lat ?? null,
      destination_lng: destCoords.lng ?? null,
      scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
      passengers,
      vehicle_type: vehicleType,
      customer_phone: customerPhone || null,
      notes: notes || null,
      estimated_price: price.trim() && isFinite(parsedPrice) ? parsedPrice : null,
    }).eq("id", order.id);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ZAKÁZKA UPRAVENA");
    onClose();
  };

  const removeOrder = async () => {
    if (!confirm("Smazat zakázku?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ZAKÁZKA SMAZÁNA");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <form onSubmit={save} className="bg-black border border-primary glow p-5 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ DETAIL / UPRAVIT</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>

        <div className="text-[10px] text-muted-foreground">
          STATUS: <span className="text-primary">{STATUS_LABEL[order.status]}</span>
          {" · "}VYTVOŘENO: <span className="text-primary">{new Date(order.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>

        {order.driver_arrived_at && (
          <div className="text-[11px] font-bold px-2 py-1 border-2 border-blue-400 text-blue-200 bg-blue-500/20">
            🚕 ŘIDIČ JE U ZÁKAZNÍKA · {new Date(order.driver_arrived_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">CENA (Kč) – lze upravit</div>
          <input
            type="number" inputMode="decimal" min={0} step={10}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="např. 450"
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
        </div>



        <AddressAutocomplete
          label="ODKUD (adresa vyzvednutí) *"
          value={pickup}
          onChange={(v) => { setPickup(v); setPickupCoords({}); }}
          onSelect={(p) => { setPickup(p.address); setPickupCoords({ lat: p.lat, lng: p.lng }); }}
          required
        />
        <AddressAutocomplete
          label="KAM (cíl)"
          value={destination}
          onChange={(v) => { setDestination(v); setDestCoords({}); }}
          onSelect={(p) => { setDestination(p.address); setDestCoords({ lat: p.lat, lng: p.lng }); }}
        />

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">DATUM A ČAS (prázdné = HNED)</div>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">TYP AUTA</div>
          <div className="grid grid-cols-3 gap-2">
            {([["car", "🚗 OSOBNÍ"], ["van", "🚐 DODÁVKA"], ["limo", "LIMUZÍNA"]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setVehicleType(v)}
                className={`border py-1.5 px-1 text-[11px] leading-none flex items-center justify-center gap-1 whitespace-nowrap ${vehicleType === v ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {v === "limo" && (
                  <img src={limoSide} alt="" loading="lazy" width={1024} height={512} className="h-3.5 w-auto shrink-0 object-contain" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">POČET OSOB ({passengers})</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPassengers(Math.max(1, passengers - 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">−</button>
            <input
              type="number" min={1} max={30} value={passengers}
              onChange={(e) => setPassengers(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-input border border-primary/40 px-2 py-2 text-primary text-center text-lg"
            />
            <button type="button" onClick={() => setPassengers(Math.min(30, passengers + 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">+</button>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">TELEFON ZÁKAZNÍKA</div>
          <input
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+420 ..."
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="text-[11px] text-primary underline mt-1 inline-block">📞 Zavolat {order.customer_phone}</a>
          )}
        </div>

        <In label="POZNÁMKA" value={notes} onChange={setNotes} />

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={removeOrder} className="flex-1 border border-destructive text-destructive py-2 text-xs hover:bg-destructive hover:text-white flex items-center justify-center gap-1">
            <Trash2 className="w-4 h-4" /> SMAZAT
          </button>
          <button disabled={saving} className="flex-[2] border border-primary text-primary py-2 hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
            {saving ? "▸ UKLÁDÁM..." : "▸ ULOŽIT ZMĚNY"}
          </button>
        </div>
      </form>
    </div>
  );
}


interface Vehicle {
  id: string;
  plate: string;
  car_type: string;
  notes: string | null;
  active: boolean;
  photo_url: string | null;
}

function VehiclesModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Vehicle[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [plate, setPlate] = useState("");
  const [carType, setCarType] = useState("");
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createVehicle);
  const updateFn = useServerFn(updateVehicle);
  const deleteFn = useServerFn(deleteVehicle);

  const load = async () => {
    const { data } = await supabase.from("vehicles").select("*").order("plate");
    const rows = (data ?? []) as Vehicle[];
    setList(rows);
    const paths = rows.map((r) => r.photo_url).filter((p): p is string => !!p && !p.startsWith("http"));
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("vehicle-photos").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s: any) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setPreviews(map);
    } else setPreviews({});
  };
  useEffect(() => { load(); }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setBusy(true);
    try {
      await createFn({ data: { plate, car_type: carType, notes: null } });
      setPlate(""); setCarType("");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba");
    } finally { setBusy(false); }
  };

  const uploadPhoto = async (v: Vehicle, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Fotka je moc velká (max 5 MB)."); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${v.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("vehicle-photos").upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      await updateFn({ data: { id: v.id, photo_url: path } });
      toast.success("Fotka nahrána");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba při nahrávání");
    } finally { setBusy(false); }
  };

  const removePhoto = async (v: Vehicle) => {
    try {
      if (v.photo_url && !v.photo_url.startsWith("http")) {
        await supabase.storage.from("vehicle-photos").remove([v.photo_url]);
      }
      await updateFn({ data: { id: v.id, photo_url: null } });
      await load();
    } catch (err: any) { toast.error(err?.message ?? "Chyba"); }
  };

  const toggleActive = async (v: Vehicle) => {
    try { await updateFn({ data: { id: v.id, active: !v.active } }); await load(); }
    catch (err: any) { toast.error(err?.message ?? "Chyba"); }
  };
  const remove = async (v: Vehicle) => {
    if (!confirm(`Smazat auto ${v.plate}?`)) return;
    try { await deleteFn({ data: { id: v.id } }); await load(); }
    catch (err: any) { toast.error(err?.message ?? "Chyba"); }
  };
  const editType = async (v: Vehicle) => {
    const newType = prompt("Typ auta:", v.car_type);
    if (newType == null) return;
    try { await updateFn({ data: { id: v.id, car_type: newType } }); await load(); }
    catch (err: any) { toast.error(err?.message ?? "Chyba"); }
  };
  const editPlate = async (v: Vehicle) => {
    const newPlate = prompt("SPZ:", v.plate);
    if (!newPlate) return;
    try { await updateFn({ data: { id: v.id, plate: newPlate } }); await load(); }
    catch (err: any) { toast.error(err?.message ?? "Chyba"); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <div className="bg-black border border-primary glow p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ SEZNAM AUT ({list.length})</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={add} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end border border-primary/30 p-2">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">SPZ *</div>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} required
              className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm uppercase" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">TYP AUTA</div>
            <input value={carType} onChange={(e) => setCarType(e.target.value)} placeholder="Octavia, Transit…"
              className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm" />
          </div>
          <button disabled={busy} type="submit"
            className="border border-primary bg-primary text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-40 flex items-center gap-1">
            <Plus className="w-3 h-3" /> PŘIDAT
          </button>
        </form>
        <div className="divide-y divide-primary/20">
          {list.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">Žádná auta.</div>}
          {list.map((v) => (
            <div key={v.id} className="py-2 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <button onClick={() => editPlate(v)} className={`font-bold ${v.active ? "text-primary" : "text-muted-foreground line-through"}`}>
                    {v.plate}
                  </button>
                  <button onClick={() => editType(v)} className="ml-2 text-xs text-muted-foreground hover:text-primary">
                    {v.car_type || "— typ —"}
                  </button>
                </div>
                <button onClick={() => toggleActive(v)}
                  className={`text-[10px] px-2 py-1 border ${v.active ? "border-primary text-primary" : "border-muted-foreground text-muted-foreground"}`}>
                  {v.active ? "AKTIVNÍ" : "VYŘAZENO"}
                </button>
                <button onClick={() => remove(v)} className="text-amber-warn hover:text-red-500 p-1" aria-label="Smazat">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {v.photo_url ? (
                  <img
                    src={v.photo_url.startsWith("http") ? v.photo_url : previews[v.photo_url]}
                    alt={`Auto ${v.plate}`}
                    className="w-24 h-16 object-cover border border-primary/40"
                  />
                ) : (
                  <div className="w-24 h-16 border border-dashed border-primary/30 flex items-center justify-center text-[10px] text-muted-foreground">
                    BEZ FOTKY
                  </div>
                )}
                <label className="border border-primary/40 px-2 py-1.5 text-[11px] text-primary cursor-pointer hover:border-primary">
                  📷 NAHRÁT FOTKU
                  <input type="file" accept="image/*" className="hidden" disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(v, f); e.target.value = ""; }} />
                </label>
                {v.photo_url && (
                  <button onClick={() => removePhoto(v)} className="text-[11px] text-muted-foreground hover:text-red-500">
                    ODEBRAT
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TariffRow {
  id: string;
  vehicle_type: string;
  label: string;
  base_fare: number;
  per_km: number;
  capacity: number;
  sort_order: number;
  weekend_base_fare: number;
  weekend_per_km: number;
  short_km_limit: number;
  short_base_fare: number;
  short_per_km: number;
  short_base_fare_weekend: number;
  short_per_km_weekend: number;
  mikulov_flat: number;
  mikulov_flat_weekend: number;
  hustopece_flat: number;
  hustopece_flat_weekend: number;
}

const NUM_FIELDS: { key: keyof TariffRow; label: string }[][] = [
  [
    { key: "base_fare", label: "NÁSTUPNÍ TÝDEN" },
    { key: "per_km", label: "Kč/KM TÝDEN" },
  ],
  [
    { key: "weekend_base_fare", label: "NÁSTUPNÍ VÍKEND" },
    { key: "weekend_per_km", label: "Kč/KM VÍKEND" },
  ],
  [
    { key: "short_km_limit", label: "LIMIT KRÁTKÉ (km)" },
    { key: "capacity", label: "MÍST" },
  ],
  [
    { key: "short_base_fare", label: "KRÁTKÁ – NÁSTUPNÍ TÝDEN" },
    { key: "short_per_km", label: "KRÁTKÁ – Kč/KM TÝDEN" },
  ],
  [
    { key: "short_base_fare_weekend", label: "KRÁTKÁ – NÁSTUPNÍ VÍKEND" },
    { key: "short_per_km_weekend", label: "KRÁTKÁ – Kč/KM VÍKEND" },
  ],
  [
    { key: "mikulov_flat", label: "MIKULOV – TÝDEN" },
    { key: "mikulov_flat_weekend", label: "MIKULOV – VÍKEND" },
  ],
  [
    { key: "hustopece_flat", label: "HUSTOPEČE – TÝDEN" },
    { key: "hustopece_flat_weekend", label: "HUSTOPEČE – VÍKEND" },
  ],
];

function TariffsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<TariffRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("tariffs").select("*").order("sort_order");
    setList((data ?? []) as TariffRow[]);
  };
  useEffect(() => { load(); }, []);

  const setField = (id: string, field: keyof TariffRow, value: string) => {
    setList((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: field === "label" ? value : Number(value) } as TariffRow : t)));
  };

  const save = async () => {
    setBusy(true);
    try {
      for (const t of list) {
        const { error } = await supabase
          .from("tariffs")
          .update({
            label: t.label,
            base_fare: t.base_fare,
            per_km: t.per_km,
            capacity: t.capacity,
            weekend_base_fare: t.weekend_base_fare,
            weekend_per_km: t.weekend_per_km,
            short_km_limit: t.short_km_limit,
            short_base_fare: t.short_base_fare,
            short_per_km: t.short_per_km,
            short_base_fare_weekend: t.short_base_fare_weekend,
            short_per_km_weekend: t.short_per_km_weekend,
            mikulov_flat: t.mikulov_flat,
            mikulov_flat_weekend: t.mikulov_flat_weekend,
            hustopece_flat: t.hustopece_flat,
            hustopece_flat_weekend: t.hustopece_flat_weekend,
          })
          .eq("id", t.id);
        if (error) throw new Error(error.message);
      }
      toast.success("Ceník uložen");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Chyba při ukládání");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <div className="bg-black border border-primary glow p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ CENÍK PRO ZÁKAZNÍKY</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-[10px] text-muted-foreground leading-relaxed">
          Pořadí výpočtu: smluvní jízdné (Mikulov / Hustopeče – když je start i cíl ve stejném městě) → jízda do
          limitu km → nástupní sazba + Kč/km. Po–Pá se počítá týdenní tarif, So–Ne víkendový. Nula = pravidlo se
          nepoužije. Projeví se hned u zákazníka.
        </div>
        {list.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">Žádné sazby.</div>}
        {list.map((t) => (
          <div key={t.id} className="border border-primary/30 p-2 space-y-2">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">NÁZEV ({t.vehicle_type})</div>
              <input value={t.label} onChange={(e) => setField(t.id, "label", e.target.value)}
                className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm" />
            </div>
            {NUM_FIELDS.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                {row.map((f) => (
                  <div key={String(f.key)}>
                    <div className="text-[10px] text-muted-foreground mb-1">{f.label}</div>
                    <input type="number" inputMode="decimal" value={Number(t[f.key] ?? 0)}
                      onChange={(e) => setField(t.id, f.key, e.target.value)}
                      className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        <button onClick={save} disabled={busy}
          className="w-full border border-primary bg-primary text-primary-foreground py-2 text-sm font-bold disabled:opacity-40">
          ULOŽIT CENÍK
        </button>
      </div>
    </div>
  );
}


