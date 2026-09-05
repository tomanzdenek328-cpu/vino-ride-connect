import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { trackOrder, trackPosition } from "@/lib/customer.functions";
import { CustomerShell, CustomerCard } from "@/components/CustomerShell";
import { ADVANCE_ACCEPTED_MESSAGE, OFF_HOURS_MESSAGE } from "@/lib/hours";


const CustomerMap = lazy(() => import("@/components/CustomerMap"));

export const Route = createFileRoute("/jizda/$code")({
  head: () => ({
    meta: [
      { title: "Sledování jízdy – Vinné Taxi" },
      { name: "description", content: "Sledujte stav objednávky, řidiče a polohu vozu na mapě v reálném čase." },
      { property: "og:title", content: "Sledování jízdy – Vinné Taxi" },
      { property: "og:description", content: "Stav objednávky, informace o řidiči a poloha vozu na mapě." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function formatEta(mins: number) {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "HLEDÁME ŘIDIČE", color: "text-orange-400" },
  assigned: { label: "ŘIDIČ PŘIDĚLEN", color: "text-orange-400" },
  accepted: { label: "ŘIDIČ JEDE K VÁM", color: "text-primary" },
  in_progress: { label: "JEDETE", color: "text-primary" },
  completed: { label: "JÍZDA DOKONČENA", color: "text-muted-foreground" },
  cancelled: { label: "ZRUŠENO", color: "text-destructive" },
};

function approximateEtaMinutes(
  car: { lat: number; lng: number } | null,
  pickup: { lat: number; lng: number } | null,
) {
  if (!car || !pickup) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(pickup.lat - car.lat);
  const dLng = toRad(pickup.lng - car.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(car.lat)) * Math.cos(toRad(pickup.lat)) * Math.sin(dLng / 2) ** 2;
  const roadKm = 2 * 6371 * Math.asin(Math.sqrt(a)) * 1.3;
  return Math.max(1, Math.round((roadKm / 35) * 60));
}

function TrackPage() {
  const { code } = Route.useParams();
  const track = useServerFn(trackOrder);
  const trackPos = useServerFn(trackPosition);
  const [state, setState] = useState<any>(null);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r: any = await track({ data: { code } });
      setState(r);
      try {
        if (r?.found && ["completed", "cancelled"].includes(r.order.status)) {
          if (localStorage.getItem("vt_ride_code") === code) localStorage.removeItem("vt_ride_code");
        } else if (r?.found) {
          localStorage.setItem("vt_ride_code", code);
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [track, code]);


  useEffect(() => {
    load();
    // full refresh (driver, ETA, status) every 15 s
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // near-real-time car position (light query every second)
  useEffect(() => {
    let stop = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const p: any = await trackPos({ data: { code } });
        if (!stop && p?.found && p.lat != null && p.lng != null) {
          setLivePos({ lat: p.lat, lng: p.lng });
        }
      } catch {
        /* ignore */
      } finally {
        // Start the next request only after this one has finished. This avoids
        // older, slower responses moving the car backwards on the map.
        if (!stop) timer = window.setTimeout(tick, 700);
      }
    };
    tick();
    return () => {
      stop = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [trackPos, code]);

  // Upozornění zákazníkovi, že řidič dorazil na místo vyzvednutí.
  const arrivedAt = state?.found ? state.order?.driver_arrived_at : null;
  useEffect(() => {
    if (!arrivedAt) return;
    const key = `vt_arrived_${code}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    const title = "🚕 Váš řidič dorazil";
    const body = "Řidič čeká na místě vyzvednutí. Your driver has arrived.";

    const show = () => {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(title, { body, icon: "/icon-192.png", tag: `arrived-${code}` });
        }
      } catch {
        /* ignore */
      }
    };

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(show).catch(() => {});
    } else {
      show();
    }

    try {
      navigator.vibrate?.([300, 120, 300, 120, 500]);
    } catch {
      /* ignore */
    }
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.35, 0.7].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.3);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1500);
    } catch {
      /* ignore */
    }
  }, [arrivedAt, code]);





  if (loading) {
    return (
      <CustomerShell>
        <div className="min-h-screen flex items-center justify-center text-primary">Načítám…</div>
      </CustomerShell>
    );
  }

  if (!state?.found) {
    return (
      <CustomerShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-destructive">Objednávku s kódem {code} jsme nenašli.</div>
        <Link
          to="/objednat"
          search={{ nova: false }}
          className="border border-primary bg-background/80 text-primary px-6 py-2"
        >
          ▸ NOVÁ OBJEDNÁVKA
        </Link>
        </div>
      </CustomerShell>
    );
  }

  const o = state.order;
  const d = state.driver;
  const pickupPosition =
    o.pickup_lat != null && o.pickup_lng != null
      ? { lat: o.pickup_lat, lng: o.pickup_lng }
      : null;
  const carPosition = livePos ?? (d?.lat != null && d?.lng != null ? { lat: d.lat, lng: d.lng } : null);
  const liveEta = approximateEtaMinutes(carPosition, pickupPosition);
  let st = STATUS[o.status] ?? { label: o.status, color: "text-muted-foreground" };
  if (o.driver_arrived_at && (o.status === "accepted" || o.status === "assigned")) {
    st = { label: "🚕 VÁŠ ŘIDIČ DORAZIL", color: "text-primary" };
  }
  if (o.approval === "rejected" || o.status === "cancelled") {
    st = { label: "MOMENTÁLNĚ NEJSOU K DISPOZICI VOLNÁ AUTA", color: "text-destructive" };
  } else if ((o as any).advance && o.status === "pending") {
    st = { label: "✅ JÍZDA BYLA PŘIJATA", color: "text-primary" };
  } else if ((o as any).off_hours && o.status === "pending") {
    st = { label: "MOMENTÁLNĚ NEMÁME VOLNÉ AUTO", color: "text-destructive" };
  } else if (o.approval === "pending") {
    st = { label: "HLEDÁME ŘIDIČE…", color: "text-orange-400" };
  }

  return (
    <CustomerShell>
      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="font-display text-xl text-primary glow-text">▸ VAŠE JÍZDA</h1>
        <div className="text-[11px] text-muted-foreground tracking-widest">KÓD: {code}</div>
      </div>

      <div className={`rounded-xl border border-primary/40 bg-background/80 backdrop-blur-md p-3 font-bold tracking-widest ${st.color}`}>{st.label}</div>

      {o.driver_arrived_at && !["completed", "cancelled"].includes(o.status) && (
        <div className="rounded-xl border-2 border-primary bg-primary/15 p-3 text-sm text-primary font-bold animate-pulse">
          🚕 ŘIDIČ JE NA MÍSTĚ VYZVEDNUTÍ – prosím vyjděte k vozu.
          <div className="text-[11px] font-normal opacity-80 mt-1">Your driver has arrived at the pickup point.</div>
        </div>
      )}



      {o.status === "pending" && (o as any).advance && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
          {ADVANCE_ACCEPTED_MESSAGE}
        </div>
      )}
      {o.status === "pending" && (o as any).off_hours && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {OFF_HOURS_MESSAGE}
        </div>
      )}


      <div className="h-72 rounded-xl overflow-hidden border border-border">
        <ClientOnly fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
            <CustomerMap
              pickup={pickupPosition}
              car={carPosition}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {d ? (
        <div className="rounded-xl border border-primary/40 bg-background/80 backdrop-blur-md p-3 space-y-2">
          <div className="text-[10px] text-muted-foreground tracking-widest">VÁŠ ŘIDIČ</div>
          <div className="flex items-center gap-3">
            {d.photo_url ? (
              <img src={d.photo_url} alt={`Vozidlo ${d.plate ?? ""}`} className="w-20 h-16 object-cover border border-border" />
            ) : (
              <div className="w-20 h-16 border border-border flex items-center justify-center text-2xl">🚕</div>
            )}
            <div className="text-sm">
              <div className="font-bold text-primary">
                {d.call_sign} {d.full_name && `· ${d.full_name}`}
              </div>
              {d.plate && <div className="font-mono">{d.plate}</div>}
              {d.car_type && <div className="text-xs text-muted-foreground">{d.car_type}</div>}
            </div>
          </div>
          {(liveEta ?? d.eta_minutes) != null && (
            <div className="text-primary font-bold">Příjezd cca za {formatEta(liveEta ?? d.eta_minutes!)}</div>
          )}
          {d.lat == null && (
            <div className="text-[11px] text-muted-foreground">Polohu vozu zatím nemáme – zobrazí se za chvíli.</div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background/80 backdrop-blur-md p-3 text-xs text-muted-foreground">
          Hledáme pro vás nejbližší vůz… jakmile řidič jízdu přijme, uvidíte tu jeho jméno, auto a polohu na mapě.
        </div>
      )}

      <div className="rounded-xl border border-border bg-background/80 backdrop-blur-md p-3 text-xs space-y-1">
        <div>
          <span className="text-muted-foreground">Odkud:</span> {o.pickup_address}
        </div>
        <div>
          <span className="text-muted-foreground">Kam:</span> {o.destination}
        </div>
        {o.estimated_price != null && (
          <div>
            <span className="text-muted-foreground">Orientační cena:</span>{" "}
            <span className="text-primary font-bold">{o.estimated_price} Kč</span>
            {o.estimated_distance_km != null && ` · ${o.estimated_distance_km} km`}
          </div>
        )}
      </div>


      <div className="text-center">
        <Link
          to="/objednat"
          search={{ nova: true }}
          className="text-[11px] text-foreground/80 underline"
        >
          Objednat další jízdu
        </Link>
      </div>
      </div>
    </CustomerShell>
  );
}
