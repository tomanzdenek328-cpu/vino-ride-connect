import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { createCustomerOrder, estimateRide, getTariffs, type Tariff } from "@/lib/customer.functions";

export const Route = createFileRoute("/objednat")({
  head: () => ({
    meta: [
      { title: "Objednat taxi – Vinné Taxi" },
      {
        name: "description",
        content: "Objednejte si taxi online: zadejte odkud a kam, uvidíte orientační cenu i polohu vozu na mapě.",
      },
      { property: "og:title", content: "Objednat taxi – Vinné Taxi" },
      { property: "og:description", content: "Objednávka jízdy s orientační cenou a sledováním vozu na mapě." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

interface Point {
  address: string;
  lat?: number;
  lng?: number;
}

type Estimate = {
  km: number;
  minutes: number;
  approx: boolean;
  options: (Tariff & { price: number })[];
};

function OrderPage() {
  const navigate = useNavigate();
  const estimate = useServerFn(estimateRide);
  const create = useServerFn(createCustomerOrder);
  const tariffsFn = useServerFn(getTariffs);

  const [pickup, setPickup] = useState<Point>({ address: "" });
  const [dest, setDest] = useState<Point>({ address: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [vehicleType, setVehicleType] = useState("");
  const [est, setEst] = useState<Estimate | null>(null);
  const [calc, setCalc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    tariffsFn()
      .then((t) => {
        setTariffs(t);
        if (t[0]) setVehicleType((v) => v || t[0].vehicle_type);
      })
      .catch(() => {});
  }, [tariffsFn]);

  useEffect(() => {
    if (pickup.lat == null || dest.lat == null) {
      setEst(null);
      return;
    }
    let cancelled = false;
    setCalc(true);
    estimate({
      data: {
        pickup: { address: pickup.address, lat: pickup.lat!, lng: pickup.lng! },
        destination: { address: dest.address, lat: dest.lat!, lng: dest.lng! },
      },
    })
      .then((r) => {
        if (!cancelled) setEst(r as Estimate);
      })
      .catch(() => {})
      .finally(() => !cancelled && setCalc(false));
    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, dest.lat, dest.lng, estimate]);

  const chosen = est?.options.find((o) => o.vehicle_type === vehicleType) ?? est?.options[0] ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pickup.lat == null || dest.lat == null) {
      setError("Vyberte prosím adresu z nabídky, aby šla spočítat trasa.");
      return;
    }
    setSending(true);
    try {
      const res = await create({
        data: {
          pickup: { address: pickup.address, lat: pickup.lat!, lng: pickup.lng! },
          destination: { address: dest.address, lat: dest.lat!, lng: dest.lng! },
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          passengers,
          vehicle_type: vehicleType,
          notes: notes.trim() || null,
          scheduled_time: when ? new Date(when).toISOString() : null,
          estimated_price: chosen?.price ?? null,
          estimated_distance_km: est?.km ?? null,
        },
      });
      navigate({ to: "/jizda/$code", params: { code: res.tracking_code } });
    } catch (err: any) {
      setError(err?.message ?? "Objednávku se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  };

  return (
    <CustomerShell>
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className="text-center mb-4">
          <img
            src={logo}
            alt="Vinné Taxi"
            className="mx-auto w-56 drop-shadow-[0_0_25px_rgba(57,255,20,0.45)]"
          />
          <p className="text-[11px] text-muted-foreground mt-1 tracking-widest">
            OBJEDNEJTE SI JÍZDU ONLINE
          </p>
        </div>

        <CustomerCard>
          <h1 className="font-display text-xl text-primary glow-text mb-3">▸ OBJEDNAT TAXI</h1>

      <form onSubmit={submit} className="space-y-3">
        <AddressAutocomplete
          label="ODKUD"
          value={pickup.address}
          onChange={(v) => setPickup({ address: v })}
          onSelect={(p) => setPickup(p)}
          required
        />
        <AddressAutocomplete
          label="KAM"
          value={dest.address}
          onChange={(v) => setDest({ address: v })}
          onSelect={(p) => setDest(p)}
          required
        />

        {(calc || est) && (
          <div className="border border-primary/40 p-3 bg-primary/5">
            {calc && <div className="text-xs text-muted-foreground">Počítám trasu…</div>}
            {!calc && est && (
              <>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Trasa {est.km} km · cca {est.minutes} min {est.approx && "(odhad)"}
                </div>
                <div className="space-y-2">
                  {est.options.map((o) => (
                    <button
                      type="button"
                      key={o.vehicle_type}
                      onClick={() => setVehicleType(o.vehicle_type)}
                      className={`w-full flex items-center justify-between px-3 py-2 border text-left ${
                        vehicleType === o.vehicle_type
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <span className="text-xs">{o.label}</span>
                      <span className="font-bold">{o.price} Kč</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Cena je orientační, konečnou částku určuje taxametr.
                </div>
              </>
            )}
          </div>
        )}

        <label className="block">
          <div className="text-[10px] text-muted-foreground mb-1">JMÉNO</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <div className="text-[10px] text-muted-foreground mb-1">TELEFON</div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            required
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10px] text-muted-foreground mb-1">POČET OSOB</div>
            <input
              type="number"
              min={1}
              max={8}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
              className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="text-[10px] text-muted-foreground mb-1">ČAS (nepovinné)</div>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        <label className="block">
          <div className="text-[10px] text-muted-foreground mb-1">POZNÁMKA (nepovinné)</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
          />
        </label>

        {error && <div className="text-xs text-destructive">{error}</div>}

        <button
          type="submit"
          disabled={sending}
          className="w-full border border-primary text-primary py-3 font-bold tracking-widest glow hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {sending ? "ODESÍLÁM…" : "▸ OBJEDNAT JÍZDU"}
        </button>
        </form>
        </CustomerCard>

        <div className="mt-6 text-center">
          <Link to="/sledovat" className="text-[11px] text-foreground/80 underline">
            Mám kód objednávky – sledovat jízdu
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}
