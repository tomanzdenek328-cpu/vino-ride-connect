import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LiveMap } from "@/components/LiveMap";
import { WalkieTalkie } from "@/components/WalkieTalkie";
import { createDriver, updateDriver, deleteDriver, resetDriverRides } from "@/lib/drivers.functions";
import { autoAssignOrder } from "@/lib/auto-assign.functions";
import { toast } from "sonner";
import { LogOut, Plus, X, UserPlus, Map as MapIcon, Archive, Car, Trash2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { createVehicle, updateVehicle, deleteVehicle } from "@/lib/vehicles.functions";
import logoVinneTaxi from "@/assets/logo-vinne-taxi.png";

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
  payment_method: "cash" | "card";
  pickup_address: string | null;
  destination: string | null;
  completed_at: string;
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
  const [showMap, setShowMap] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showVehicles, setShowVehicles] = useState(false);
  const [callSign, setCallSign] = useState("DISP");
  const [driverDetail, setDriverDetail] = useState<Driver | null>(null);
  const [archiveOrderDetail, setArchiveOrderDetail] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("call_sign").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.call_sign) setCallSign(data.call_sign); });
  }, [user]);

  const loadDrivers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    const ids = (roles ?? []).map((r: any) => r.user_id);
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-primary/40 px-3 pt-3 pb-2">
        <div className="flex justify-center -mx-3">
          <img
            src={logoVinneTaxi}
            alt="VINNÉ TAXI"
            className="h-36 sm:h-48 w-full object-contain"
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
            <button onClick={() => setShowMap(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <MapIcon className="w-4 h-4" /> MAPA
            </button>
            <button onClick={() => setShowArchive(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <Archive className="w-4 h-4" /> ARCHIV
            </button>
            <button onClick={() => setShowVehicles(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <Car className="w-4 h-4" /> AUTA
            </button>
            <button onClick={() => setShowDriverForm(true)} className="border border-primary/40 px-3 py-2 text-sm hover:border-primary flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> ŘIDIČ
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
              const active = orders.filter(o => o.status !== "completed" && o.status !== "cancelled");
              if (!active.length) return <div className="p-6 text-center text-muted-foreground text-xs">Žádné aktivní zakázky.</div>;
              return active.map((o) => (
              <div key={o.id} className="border-b border-primary/20 p-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-primary font-bold truncate">▸ {o.pickup_address}</div>
                    {o.destination && <div className="text-xs text-muted-foreground truncate">→ {o.destination}</div>}
                    <div className="text-sm text-primary mt-1 font-medium">
                      {o.scheduled_time ? `⏱ ${new Date(o.scheduled_time).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}` : "⏱ HNED"}
                      {" · "}👥 {o.passengers}
                      {o.vehicle_type ? ` · ${o.vehicle_type === "van" ? "🚐 DODÁVKA" : "🚗 OSOBNÍ"}` : ""}
                    </div>
                    {o.notes && <div className="text-xs text-amber-warn truncate">⚠ {o.notes}</div>}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 border ${
                    o.status === "pending" ? "border-amber-warn text-amber-warn" :
                    "border-primary text-primary"
                  }`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <MultiDriverPicker
                  drivers={drivers}
                  value={(o.assigned_driver_ids && o.assigned_driver_ids.length ? o.assigned_driver_ids : (o.assigned_driver_id ? [o.assigned_driver_id] : []))}
                  onChange={(ids) => assignDrivers(o.id, ids)}
                  onCancel={() => cancelOrder(o.id)}
                />
              </div>
              ));
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
          <div className="flex-1">
            <LiveMap showOrders />
          </div>
        </div>
      )}

      {showArchive && (
        <div className="fixed inset-0 z-[1800] bg-black flex flex-col">
          <div className="border-b border-primary/40 p-3 flex items-center justify-between">
            <h2 className="font-display text-primary glow-text">▸ ARCHIV JÍZD ({orders.filter(o => o.status === "completed" || o.status === "cancelled").length})</h2>
            <button onClick={() => setShowArchive(false)} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> ZAVŘÍT
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {orders.filter(o => o.status === "completed" || o.status === "cancelled").length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Archiv je prázdný.</div>
            ) : orders.filter(o => o.status === "completed" || o.status === "cancelled").map((o) => (
              <div key={o.id} onClick={() => setArchiveOrderDetail(o)} className="border-b border-primary/20 p-3 text-sm cursor-pointer hover:bg-primary/5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-primary truncate">▸ {o.pickup_address}</div>
                    {o.destination && <div className="text-xs text-muted-foreground truncate">→ {o.destination}</div>}
                    <div className="text-sm text-primary mt-1 font-medium">
                       {new Date(o.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
                       {" · "}👥 {o.passengers}
                     </div>
                    <div className="text-[10px] text-primary/60 mt-0.5">Klikni pro detail</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 border ${
                    o.status === "completed" ? "border-muted-foreground text-muted-foreground" :
                    "border-destructive text-destructive"
                  }`}>{STATUS_LABEL[o.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <NewOrderModal onClose={() => setShowForm(false)} userId={user!.id} />}
      {showDriverForm && <NewDriverModal onClose={() => setShowDriverForm(false)} onCreated={loadDrivers} />}
      {driverDetail && <DriverDetailModal driver={driverDetail} onClose={() => setDriverDetail(null)} onChanged={loadDrivers} />}
      {archiveOrderDetail && <ArchiveOrderDetailModal order={archiveOrderDetail} onClose={() => setArchiveOrderDetail(null)} />}
      {showVehicles && <VehiclesModal onClose={() => setShowVehicles(false)} />}

      {user && <WalkieTalkie userId={user.id} callSign={callSign} />}
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
  const [vehicleType, setVehicleType] = useState<"car" | "van">("car");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoAssignFn = useServerFn(autoAssignOrder);


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
      notes: notes || null,
      customer_phone: customerPhone || null,
      created_by: userId,
      status: "pending",
    }).select("id").maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ZAKÁZKA ODESLÁNA");
    onClose();
    // Auto-assign nearest driver for immediate rides with known pickup.
    if (inserted?.id && when === "now" && pickupCoords.lat != null && pickupCoords.lng != null) {
      try {
        const res = await autoAssignFn({ data: { order_id: inserted.id } });
        if (res?.ok) toast.success("▸ AUTOMATICKY PŘIDĚLENO");
        else if (res?.reason === "no_drivers") toast.message("▸ Žádný volný řidič – zakázka čeká");
      } catch (err: any) {
        toast.error(err?.message ?? "Auto-přidělení selhalo");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[2000] flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-black border border-primary glow p-5 max-w-md w-full space-y-3">
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

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">TELEFON ZÁKAZNÍKA *</div>
          <input
            type="tel"
            inputMode="tel"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+420 ..."
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm"
          />
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

function DriverDetailModal({ driver, onClose, onChanged }: { driver: Driver; onClose: () => void; onChanged: () => void }) {
  const updateDriverFn = useServerFn(updateDriver);
  const deleteDriverFn = useServerFn(deleteDriver);
  const resetDriverRidesFn = useServerFn(resetDriverRides);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(driver.full_name);
  const [callSign, setCallSign] = useState(driver.call_sign);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase.from("rides")
      .select("id,driver_id,amount,payment_method,pickup_address,destination,completed_at")
      .eq("driver_id", driver.id)
      .order("completed_at", { ascending: false })
      .then(({ data }) => { setRides((data ?? []) as Ride[]); setLoading(false); });
  }, [driver.id, refreshKey]);

  const cash = rides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Number(r.amount), 0);
  const card = rides.filter(r => r.payment_method === "card").reduce((s, r) => s + Number(r.amount), 0);

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

  return (
    <div className="fixed inset-0 bg-black z-[1900] flex flex-col">
      <div className="border-b border-primary/40 p-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-primary glow-text">▸ {driver.call_sign} · {driver.full_name}</h2>
          <div className="text-[10px] text-muted-foreground">
            {driver.online ? (driver.busy ? "◐ ONLINE · OBSAZENO" : "● ONLINE · VOLNÝ") : "○ OFFLINE"}
          </div>
        </div>
        <button onClick={onClose} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
          <X className="w-3 h-3" /> ZAVŘÍT
        </button>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2 border-b border-primary/40">
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">HOTOVĚ</div>
          <div className="text-lg text-primary font-display">{cash.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary/60 p-2">
          <div className="text-[10px] text-muted-foreground">KARTOU</div>
          <div className="text-lg text-primary font-display">{card.toFixed(0)} Kč</div>
        </div>
        <div className="border border-primary p-2 glow">
          <div className="text-[10px] text-muted-foreground">CELKEM ({rides.length})</div>
          <div className="text-lg text-primary font-display">{(cash + card).toFixed(0)} Kč</div>
        </div>
      </div>

      <div className="p-3 border-b border-primary/40 space-y-2">
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} disabled={busy}
              className="border border-primary/60 text-primary px-3 py-1.5 text-xs hover:bg-primary/10 disabled:opacity-50">
              ▸ UPRAVIT / ZMĚNIT HESLO
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
                    {ride.payment_method === "cash" ? "HOTOVĚ" : "KARTOU"}
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

interface Vehicle {
  id: string;
  plate: string;
  car_type: string;
  notes: string | null;
  active: boolean;
}

function VehiclesModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Vehicle[]>([]);
  const [plate, setPlate] = useState("");
  const [carType, setCarType] = useState("");
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createVehicle);
  const updateFn = useServerFn(updateVehicle);
  const deleteFn = useServerFn(deleteVehicle);

  const load = async () => {
    const { data } = await supabase.from("vehicles").select("*").order("plate");
    setList((data ?? []) as Vehicle[]);
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
            <div key={v.id} className="flex items-center gap-2 py-2 text-sm">
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
          ))}
        </div>
      </div>
    </div>
  );
}
