import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { trackOrder } from "@/lib/customer.functions";

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
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await track({ data: { code } });
      setState(r);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [track, code]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-primary">Načítám…</div>;
  }

  if (!state?.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-destructive">Objednávku s kódem {code} jsme nenašli.</div>
        <Link to="/objednat" className="border border-primary text-primary px-6 py-2">
          ▸ NOVÁ OBJEDNÁVKA
        </Link>
      </div>
    );
  }

  const o = state.order;
  const d = state.driver;
  const st = STATUS[o.status] ?? { label: o.status, color: "text-muted-foreground" };

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="font-display text-xl text-primary glow-text">▸ VAŠE JÍZDA</h1>
        <div className="text-[11px] text-muted-foreground tracking-widest">KÓD: {code}</div>
      </div>

      <div className={`border border-primary/40 p-3 font-bold tracking-widest ${st.color}`}>{st.label}</div>

      <div className="border border-border p-3 text-xs space-y-1">
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

      {d && (
        <div className="border border-primary/40 p-3 space-y-2">
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
        </div>
      )}

      <div className="h-72 border border-border">
        <ClientOnly fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Mapa…</div>}>
            <CustomerMap
              pickup={o.pickup_lat != null ? { lat: o.pickup_lat, lng: o.pickup_lng } : null}
              car={d?.lat != null ? { lat: d.lat, lng: d.lng } : null}
            />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="text-center">
        <Link to="/objednat" className="text-[11px] text-muted-foreground underline">
          Objednat další jízdu
        </Link>
      </div>
    </div>
  );
}
