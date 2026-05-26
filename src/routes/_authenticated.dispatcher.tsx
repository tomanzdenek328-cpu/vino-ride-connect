import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveMap } from "@/components/LiveMap";
import { WalkieTalkie } from "@/components/WalkieTalkie";
import { createDriver } from "@/lib/drivers.functions";
import { toast } from "sonner";
import { LogOut, Plus, X, UserPlus, Map as MapIcon } from "lucide-react";

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
  status: string;
  assigned_driver_id: string | null;
  created_at: string;
}

interface Driver {
  id: string;
  full_name: string;
  call_sign: string;
  online: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ČEKÁ",
  assigned: "PŘIŘAZENO",
  accepted: "PŘIJATO",
  in_progress: "JEDE",
  completed: "HOTOVO",
  cancelled: "ZRUŠENO",
};

function DispatcherPage() {
  const { user, role, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [callSign, setCallSign] = useState("DISP");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("call_sign").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.call_sign) setCallSign(data.call_sign); });
  }, [user]);

  const loadDrivers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) { setDrivers([]); return; }
    const [{ data: profs }, { data: locs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,call_sign").in("id", ids),
      supabase.from("driver_locations").select("driver_id,online").in("driver_id", ids),
    ]);
    const onlineMap: Record<string, boolean> = {};
    (locs ?? []).forEach((l: any) => { onlineMap[l.driver_id] = l.online; });
    setDrivers((profs ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, call_sign: p.call_sign,
      online: !!onlineMap[p.id],
    })));
  };

  useEffect(() => {
    const loadOrders = async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders((data ?? []) as Order[]);
    };
    loadOrders(); loadDrivers();

    const ch = supabase.channel("dispatch_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => loadDrivers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) return null;
  if (role && role !== "dispatcher") return <Navigate to="/driver" />;

  const assignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase.from("orders")
      .update({ assigned_driver_id: driverId, status: "assigned" })
      .eq("id", orderId);
    if (error) toast.error(error.message); else toast.success("▸ PŘIŘAZENO");
  };

  const cancelOrder = async (orderId: string) => {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-primary/40 p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl text-primary glow-text font-display truncate">▸ DISPEČINK · {callSign}</h1>
          <div className="text-[10px] text-muted-foreground">VINNÉ TAXI · {drivers.filter(d => d.online).length}/{drivers.length} ONLINE</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDriverForm(true)} className="border border-primary/40 px-2 py-1 text-xs hover:border-primary flex items-center gap-1">
            <UserPlus className="w-3 h-3" /> ŘIDIČ
          </button>
          <button onClick={() => supabase.auth.signOut()} className="border border-primary/40 px-2 py-1 text-xs hover:border-primary flex items-center gap-1">
            <LogOut className="w-3 h-3" /> ODHL.
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="relative border-r border-primary/40 h-[35vh] lg:h-auto lg:min-h-0">
          <LiveMap showOrders />
        </div>


        <div className="flex flex-col max-h-[65vh] lg:max-h-none overflow-hidden">
          <div className="border-b border-primary/40 p-2">
            <div className="text-[10px] text-muted-foreground mb-1">ŘIDIČI ({drivers.length})</div>
            {drivers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-1">Žádní řidiči. Klikni ŘIDIČ pro založení.</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {drivers.map((d) => (
                  <div key={d.id} className={`text-[10px] px-2 py-1 border ${d.online ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"}`}>
                    {d.online ? "●" : "○"} {d.call_sign} · {d.full_name}
                  </div>
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

            {orders.map((o) => (
              <div key={o.id} className="border-b border-primary/20 p-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-primary font-bold truncate">▸ {o.pickup_address}</div>
                    {o.destination && <div className="text-xs text-muted-foreground truncate">→ {o.destination}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {o.scheduled_time ? `⏱ ${new Date(o.scheduled_time).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "⏱ HNED"}
                      {" · "}👥 {o.passengers}
                    </div>
                    {o.notes && <div className="text-xs text-amber-warn truncate">⚠ {o.notes}</div>}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 border ${
                    o.status === "pending" ? "border-amber-warn text-amber-warn" :
                    o.status === "completed" ? "border-muted-foreground text-muted-foreground" :
                    o.status === "cancelled" ? "border-destructive text-destructive" :
                    "border-primary text-primary"
                  }`}>{STATUS_LABEL[o.status]}</span>
                </div>
                {o.status !== "completed" && o.status !== "cancelled" && (
                  <div className="mt-2 flex gap-2 items-center">
                    <select
                      value={o.assigned_driver_id ?? ""}
                      onChange={(e) => e.target.value && assignDriver(o.id, e.target.value)}
                      className="flex-1 bg-input border border-primary/40 text-xs px-2 py-1 text-primary"
                    >
                      <option value="">— vyber řidiče —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.call_sign} · {d.full_name} {d.online ? "●" : "○"}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => cancelOrder(o.id)} className="text-destructive hover:text-red-400 p-1" title="Zrušit">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!orders.length && (
              <div className="p-6 text-center text-muted-foreground text-xs">Žádné zakázky.</div>
            )}
          </div>
        </div>
      </div>

      {showForm && <NewOrderModal onClose={() => setShowForm(false)} userId={user!.id} />}
      {showDriverForm && <NewDriverModal onClose={() => setShowDriverForm(false)} onCreated={loadDrivers} />}
      {user && <WalkieTalkie userId={user.id} callSign={callSign} />}
    </div>
  );
}

function NewOrderModal({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledTime, setScheduledTime] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const geocode = async (q: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
    } catch {}
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const coords = await geocode(pickup);
    const { error } = await supabase.from("orders").insert({
      pickup_address: pickup,
      pickup_lat: coords?.lat ?? null,
      pickup_lng: coords?.lng ?? null,
      destination: destination || null,
      scheduled_time: when === "later" && scheduledTime ? new Date(scheduledTime).toISOString() : null,
      passengers,
      notes: notes || null,
      created_by: userId,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ZAKÁZKA ODESLÁNA");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-black border border-primary glow p-5 max-w-md w-full space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ NOVÁ ZAKÁZKA</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></button>
        </div>
        <In label="ODKUD (adresa vyzvednutí) *" value={pickup} onChange={setPickup} required />
        <In label="KAM (cíl)" value={destination} onChange={setDestination} />

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
          <div className="text-[10px] text-muted-foreground mb-1">POČET OSOB</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} type="button" onClick={() => setPassengers(n)}
                className={`flex-1 border py-1.5 text-xs ${passengers === n ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <In label="POZNÁMKA (nepovinné)" value={notes} onChange={setNotes} />

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

function In({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none" />
    </label>
  );
}
