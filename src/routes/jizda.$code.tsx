import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { trackOrder, trackPosition } from "@/lib/customer.functions";
import { CustomerShell, CustomerCard } from "@/components/CustomerShell";

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

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "HLEDÁME ŘIDIČE", color: "text-orange-400" },
  assigned: { label: "ŘIDIČ PŘIDĚLEN", color: "text-orange-400" },
  accepted: { label: "ŘIDIČ JEDE K VÁM", color: "text-primary" },
  in_progress: { label: "JEDETE", color: "text-primary" },
  completed: { label: "JÍZDA DOKONČENA", color: "text-muted-foreground" },
  cancelled: { label: "ZRUŠENO", color: "text-destructive" },
};

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
    const tick = async () => {
      try {
        const p: any = await trackPos({ data: { code } });
        if (!stop && p?.found && p.lat != null && p.lng != null) {
          setLivePos({ lat: p.lat, lng: p.lng });
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 1000);
    return () => { stop = true; clearInterval(t); };
  }, [trackPos, code]);



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
        <Link to="/objednat" className="border border-primary bg-background/80 text-primary px-6 py-2">
          ▸ NOVÁ OBJEDNÁVKA
        </Link>
        </div>
      </CustomerShell>
    );
  }

  const o = state.order;
  const d = state.driver;
  const st = STATUS[o.status] ?? { label: o.status, color: "text-muted-foreground" };

  return (
    <CustomerShell>
      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="font-display text-xl text-primary glow-text">▸ VAŠE JÍZDA</h1>
        <div className="text-[11px] text-muted-foreground tracking-widest">KÓD: {code}</div>
      </div>

      <div className={`rounded-xl border border-primary/40 bg-background/80 backdrop-blur-md p-3 font-bold tracking-widest ${st.color}`}>{st.label}</div>

      <div className="h-72 rounded-xl overflow-hidden border border-border">
        <ClientOnly fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
            <CustomerMap
              pickup={o.pickup_lat != null ? { lat: o.pickup_lat, lng: o.pickup_lng } : null}
              car={livePos ?? (d?.lat != null ? { lat: d.lat, lng: d.lng } : null)}
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
          {d.eta_minutes != null && (
            <div className="text-primary font-bold">Příjezd cca za {d.eta_minutes} min</div>
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
        <Link to="/objednat" className="text-[11px] text-foreground/80 underline">
          Objednat další jízdu
        </Link>
      </div>
      </div>
    </CustomerShell>
  );
}
