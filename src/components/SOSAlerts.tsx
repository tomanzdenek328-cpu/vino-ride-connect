import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Siren, X, Navigation } from "lucide-react";
import { toast } from "sonner";

interface SOSRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  resolved_at: string | null;
}

interface Enriched extends SOSRow {
  call_sign: string;
  full_name: string;
  plate: string;
  car_type: string;
}

interface Props {
  currentUserId: string | undefined;
  isDispatcher: boolean;
}

// Hi-lo americká hasičská siréna přes Web Audio API – loop dokud aktivní
function useSiren(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      try { oscRef.current?.stop(); } catch {}
      try { ctxRef.current?.close(); } catch {}
      ctxRef.current = null; oscRef.current = null; gainRef.current = null;
      return;
    }
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 650;
      osc.connect(gain);
      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
      let hi = false;
      timerRef.current = window.setInterval(() => {
        hi = !hi;
        const f = hi ? 950 : 600;
        try { osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.04); } catch {}
      }, 550);
    } catch (e) { console.warn("siren failed", e); }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      try { oscRef.current?.stop(); } catch {}
      try { ctxRef.current?.close(); } catch {}
      ctxRef.current = null; oscRef.current = null; gainRef.current = null;
    };
  }, [active]);
}

export function SOSAlerts({ currentUserId, isDispatcher }: Props) {
  const [alerts, setAlerts] = useState<Enriched[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data: rows } = await supabase
      .from("sos_alerts")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    const list = (rows ?? []) as SOSRow[];
    if (list.length === 0) { setAlerts([]); return; }
    const driverIds = [...new Set(list.map((r) => r.driver_id))];
    const vehicleIds = [...new Set(list.map((r) => r.vehicle_id).filter(Boolean) as string[])];
    const [{ data: profs }, { data: vehs }] = await Promise.all([
      supabase.from("profiles").select("id,call_sign,full_name").in("id", driverIds),
      vehicleIds.length
        ? supabase.from("vehicles").select("id,plate,car_type").in("id", vehicleIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => { pMap[p.id] = p; });
    const vMap: Record<string, any> = {};
    (vehs ?? []).forEach((v: any) => { vMap[v.id] = v; });
    // Also fetch live coordinates if alert lat/lng missing
    const { data: locs } = await supabase
      .from("driver_locations")
      .select("driver_id,lat,lng")
      .in("driver_id", driverIds);
    const lMap: Record<string, { lat: number | null; lng: number | null }> = {};
    (locs ?? []).forEach((l: any) => { lMap[l.driver_id] = { lat: l.lat, lng: l.lng }; });
    setAlerts(list.map((r) => ({
      ...r,
      lat: r.lat ?? lMap[r.driver_id]?.lat ?? null,
      lng: r.lng ?? lMap[r.driver_id]?.lng ?? null,
      call_sign: pMap[r.driver_id]?.call_sign ?? "—",
      full_name: pMap[r.driver_id]?.full_name ?? "",
      plate: r.vehicle_id ? (vMap[r.vehicle_id]?.plate ?? "—") : "—",
      car_type: r.vehicle_id ? (vMap[r.vehicle_id]?.car_type ?? "") : "",
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sos_alerts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, (payload) => {
        load();
        if (payload.eventType === "INSERT") {
          const row: any = payload.new;
          if (row.driver_id !== currentUserId) {
            setOpen(true);
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("🚨 SOS – řidič v nouzi", { body: "Klikni na majáček v aplikaci" });
              }
            } catch {}
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUserId]);

  const active = alerts.length > 0;
  useSiren(active);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from("sos_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message); else { toast.success("SOS vyřízeno"); setOpen(false); }
  };

  const navigate = (lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) { toast.error("Poloha není dostupná"); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  };

  if (!active) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-[1000] w-14 h-14 rounded-full bg-black border-2 border-primary flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.8)]"
        style={{ animation: "sos-pulse 0.6s steps(2) infinite" }}
        aria-label="SOS"
      >
        <Siren className="w-8 h-8" style={{ color: "#ff1a1a", filter: "drop-shadow(0 0 6px #ff1a1a)" }} />
        <style>{`@keyframes sos-pulse { 0%{box-shadow:0 0 25px 6px rgba(255,0,0,0.9)} 50%{box-shadow:0 0 6px 1px rgba(255,0,0,0.3)} 100%{box-shadow:0 0 25px 6px rgba(255,0,0,0.9)} }`}</style>
      </button>

      {open && (
        <div className="fixed inset-0 z-[1001] bg-black/85 flex items-start justify-center p-4 overflow-auto" onClick={() => setOpen(false)}>
          <div className="bg-black border-2 border-red-500 max-w-md w-full mt-12" onClick={(e) => e.stopPropagation()}
               style={{ boxShadow: "0 0 30px rgba(255,0,0,0.6)" }}>
            <div className="flex items-center justify-between border-b border-red-500/60 px-3 py-2">
              <div className="flex items-center gap-2 text-red-500 font-bold">
                <Siren className="w-5 h-5" /> SOS – ŘIDIČ V NOUZI
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              {alerts.map((a) => {
                const canResolve = isDispatcher || a.driver_id === currentUserId;
                return (
                  <div key={a.id} className="border border-red-500/60 p-3">
                    <div className="text-lg font-bold text-primary glow-text font-display">▸ {a.call_sign}</div>
                    <div className="text-sm text-foreground">{a.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      AUTO: {a.plate}{a.car_type ? ` · ${a.car_type}` : ""}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("cs-CZ")}
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button onClick={() => navigate(a.lat, a.lng)}
                        className="border border-primary px-3 py-2 text-sm font-bold flex items-center gap-1 hover:bg-primary/10">
                        <Navigation className="w-4 h-4" /> NAVIGOVAT
                      </button>
                      {canResolve && (
                        <button onClick={() => resolve(a.id)}
                          className="border border-red-500 text-red-400 px-3 py-2 text-sm font-bold hover:bg-red-500/10">
                          ZRUŠIT SOS
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
