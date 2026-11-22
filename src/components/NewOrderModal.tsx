import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderDictation } from "@/components/OrderDictation";
import { DriverSuggestions } from "@/components/DriverSuggestions";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { notifyNewOrder } from "@/lib/push.functions";
import { estimateRide } from "@/lib/customer.functions";
import { makeTrackingCode } from "@/lib/tracking";
import limoSide from "@/assets/limo-side-black.png";
const TARIFF_KEY = { car: "osobni", van: "dodavka", limo: "vip_limuzina" };

export function NewOrderModal({ onClose, userId, helper = false }: { onClose: () => void; userId: string; helper?: boolean }) {
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
    if (pickupCoords.lat == null || pickupCoords.lng == null || destCoords.lat == null || destCoords.lng == null) { setKm(null); setEst(null); return; }
    let cancelled = false;
    setCalcBusy(true);
    estimateFn({
      data: {
        pickup: { address: pickup, lat: pickupCoords.lat, lng: pickupCoords.lng },
        destination: { address: destination, lat: destCoords.lat, lng: destCoords.lng },
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
    <div className="fixed inset-0 bg-background/90 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-background border border-primary glow p-5 max-w-md w-full space-y-3 my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-primary font-display text-lg">▸ NOVÁ ZAKÁZKA</h3>
          <Button type="button" onClick={onClose} className="text-muted-foreground hover:text-primary"><X className="w-5 h-5" /></Button>
        </div>
        {!helper && <OrderDictation onApply={(draft) => {
          if (draft.pickup != null) { setPickup(draft.pickup); setPickupCoords({}); }
          if (draft.destination != null) { setDestination(draft.destination); setDestCoords({}); }
          if (draft.passengers != null) setPassengers(draft.passengers);
          if (draft.vehicleType != null) setVehicleType(draft.vehicleType);
          if (draft.phone != null) setCustomerPhone(draft.phone);
          if (draft.notes != null) setNotes(draft.notes);
          setWhen(draft.scheduledTime ? "later" : "now");
          setScheduledTime(draft.scheduledTime ?? "");
        }} />}
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
              <Button key={w} type="button" onClick={() => setWhen(w)}
                className={`border py-1.5 text-xs ${when === w ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {w === "now" ? "▸ HNED" : "▸ NAPLÁNOVAT"}
              </Button>
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
              <Button key={v} type="button" onClick={() => setVehicleType(v)}
                className={`border py-1.5 px-1 text-[11px] leading-none flex items-center justify-center gap-1 whitespace-nowrap ${vehicleType === v ? "border-primary bg-primary text-primary-foreground glow" : "border-primary/40 text-primary"}`}>
                {v === "limo" && (
                  <img src={limoSide} alt="" loading="lazy" width={1024} height={512} className="h-3.5 w-auto shrink-0 object-contain" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-muted-foreground mb-1">POČET OSOB ({passengers})</div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => setPassengers(Math.max(1, passengers - 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">−</Button>
            <input
              type="number" min={1} max={30} value={passengers}
              onChange={(e) => setPassengers(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-input border border-primary/40 px-2 py-2 text-primary text-center text-lg"
            />
            <Button type="button" onClick={() => setPassengers(Math.min(30, passengers + 1))}
              className="border border-primary/40 text-primary w-10 h-10 text-lg">+</Button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Max. 30 osob</div>
        </div>
        {!helper && <DriverSuggestions key={`${pickupCoords.lat}-${pickupCoords.lng}-${passengers}-${vehicleType}`} pickup={pickupCoords.lat != null && pickupCoords.lng != null ? {lat:pickupCoords.lat,lng:pickupCoords.lng} : null} passengers={passengers} vehicleType={vehicleType} />}

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


        <label className="block text-xs text-muted-foreground">POZNÁMKA (nepovinné)<input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full bg-input border border-primary/40 px-2 py-1.5 text-primary" /></label>

        <Button
          type="button"
          onClick={() => setPriority((v) => !v)}
          className={`w-full border py-2 text-xs font-bold ${
            priority
              ? "border-destructive bg-destructive text-destructive-foreground blink"
              : "border-destructive/60 text-destructive hover:bg-destructive/10"
          }`}
        >
          {priority ? "🚨 URGENTNÍ – KLIKNI PRO ZRUŠENÍ" : "🚨 OZNAČIT JAKO URGENTNÍ / PRIORITNÍ"}
        </Button>

        <Button type="submit" disabled={submitting} className="w-full border border-primary text-primary py-2 hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
          {submitting ? "▸ ODESÍLÁM..." : "▸ ODESLAT"}
        </Button>
      </form>
    </div>
  );
}

