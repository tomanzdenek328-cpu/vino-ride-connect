import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TARIFF_COLUMNS, computeFare, isWeekend, type TariffFull } from "./pricing";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Vzdálenost + doba jízdy po silnici (Routes API), s fallbackem na vzdušnou čáru. */
async function routeDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): Promise<{ km: number; minutes: number; approx: boolean }> {
  const lk = process.env["LOVABLE_API_KEY"];
  const gk = process.env["GOOGLE_MAPS_API_KEY"];
  if (lk && gk) {
    try {
      const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lk}`,
          "X-Connection-Api-Key": gk,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
          destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
          travelMode: "DRIVE",
          languageCode: "cs",
          regionCode: "CZ",
        }),
      });
      if (r.ok) {
        const j: any = await r.json();
        const route = j.routes?.[0];
        if (route?.distanceMeters) {
          return {
            km: route.distanceMeters / 1000,
            minutes: Math.round(parseInt(String(route.duration ?? "0"), 10) / 60) || 1,
            approx: false,
          };
        }
      } else {
        console.error(`Routes API ${r.status}: ${await r.text()}`);
      }
    } catch (e) {
      console.error("Routes API selhalo", e);
    }
  }
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng) * 1.3;
  return { km, minutes: Math.max(1, Math.round((km / 40) * 60)), approx: true };
}

function serverClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: any, init: any) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  });
}

export type { TariffFull } from "./pricing";

export interface Tariff {
  vehicle_type: string;
  label: string;
  base_fare: number;
  per_km: number;
  capacity: number;
}

export const getTariffs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await serverClient();
  const { data, error } = await sb
    .from("tariffs")
    .select(TARIFF_COLUMNS)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TariffFull[];
});

const PointSchema = z.object({
  address: z.string().min(2).max(300),
  lat: z.number(),
  lng: z.number(),
});

export const estimateRide = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ pickup: PointSchema, destination: PointSchema, when: z.string().optional().nullable() }).parse(i),
  )
  .handler(async ({ data }) => {
    const [{ km, minutes, approx }, sb] = await Promise.all([
      routeDistance(data.pickup, data.destination),
      serverClient(),
    ]);
    const { data: tariffs } = await sb.from("tariffs").select(TARIFF_COLUMNS).order("sort_order");
    const weekend = isWeekend(data.when ?? new Date());
    const options = ((tariffs ?? []) as unknown as TariffFull[]).map((t) => {
      const fare = computeFare(t, km, {
        weekend,
        pickup: data.pickup.address,
        destination: data.destination.address,
      });
      return {
        vehicle_type: t.vehicle_type,
        label: t.label,
        base_fare: t.base_fare,
        per_km: t.per_km,
        capacity: t.capacity,
        price: fare.price,
        fare_mode: fare.mode,
        fare_note: fare.note,
      };
    });
    return { km: Math.round(km * 10) / 10, minutes, approx, weekend, options };
  });


const CreateSchema = z.object({
  pickup: PointSchema,
  destination: PointSchema,
  customer_name: z.string().min(2).max(80),
  customer_phone: z.string().min(6).max(30),
  passengers: z.number().int().min(1).max(8),
  vehicle_type: z.string().max(40),
  notes: z.string().max(300).optional().nullable(),
  scheduled_time: z.string().datetime().optional().nullable(),
  estimated_price: z.number().nonnegative().optional().nullable(),
  estimated_distance_km: z.number().nonnegative().optional().nullable(),
});

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const createCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tracking_code = makeCode();
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        pickup_address: data.pickup.address,
        pickup_lat: data.pickup.lat,
        pickup_lng: data.pickup.lng,
        destination: data.destination.address,
        destination_lat: data.destination.lat,
        destination_lng: data.destination.lng,
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        passengers: data.passengers,
        vehicle_type: data.vehicle_type || null,
        notes: data.notes?.trim() || null,
        scheduled_time: data.scheduled_time ?? null,
        status: "pending",
        released: false,
        approval: "pending",
        source: "customer",
        tracking_code,
        estimated_price: data.estimated_price ?? null,
        estimated_distance_km: data.estimated_distance_km ?? null,
      } as any)
      .select("id,tracking_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true as const, tracking_code: row?.tracking_code ?? tracking_code };
  });

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id,status,approval,pickup_address,pickup_lat,pickup_lng,destination,customer_name,scheduled_time,estimated_price,estimated_distance_km,assigned_driver_id,created_at",
      )
      .eq("tracking_code", data.code.toUpperCase())
      .maybeSingle();
    if (!order) return { found: false as const };

    let driver: {
      call_sign: string;
      full_name: string;
      lat: number | null;
      lng: number | null;
      plate: string | null;
      car_type: string | null;
      photo_url: string | null;
      eta_minutes: number | null;
    } | null = null;

    if (order.assigned_driver_id) {
      const [{ data: prof }, { data: loc }] = await Promise.all([
        supabaseAdmin.from("profiles").select("call_sign,full_name").eq("id", order.assigned_driver_id).maybeSingle(),
        supabaseAdmin
          .from("driver_locations")
          .select("lat,lng,vehicle_id")
          .eq("driver_id", order.assigned_driver_id)
          .maybeSingle(),
      ]);
      let vehicle: any = null;
      if (loc?.vehicle_id) {
        const { data: v } = await supabaseAdmin
          .from("vehicles")
          .select("plate,car_type,photo_url")
          .eq("id", loc.vehicle_id)
          .maybeSingle();
        vehicle = v;
      }
      let eta: number | null = null;
      if (
        loc?.lat != null &&
        loc?.lng != null &&
        order.pickup_lat != null &&
        order.pickup_lng != null &&
        ["assigned", "accepted"].includes(order.status)
      ) {
        const r = await routeDistance(
          { lat: loc.lat, lng: loc.lng },
          { lat: order.pickup_lat, lng: order.pickup_lng },
        );
        eta = r.minutes;
      }
      let photoUrl: string | null = vehicle?.photo_url ?? null;
      if (photoUrl && !photoUrl.startsWith("http")) {
        const { data: signed } = await supabaseAdmin.storage
          .from("vehicle-photos")
          .createSignedUrl(photoUrl, 60 * 60 * 6);
        photoUrl = signed?.signedUrl ?? null;
      }
      driver = {
        call_sign: prof?.call_sign ?? "",
        full_name: prof?.full_name ?? "",
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        plate: vehicle?.plate ?? null,
        car_type: vehicle?.car_type ?? null,
        photo_url: photoUrl,
        eta_minutes: eta,
      };

    }

    return {
      found: true as const,
      order: {
        status: order.status,
        pickup_address: order.pickup_address,
        pickup_lat: order.pickup_lat,
        pickup_lng: order.pickup_lng,
        destination: order.destination,
        scheduled_time: order.scheduled_time,
        estimated_price: order.estimated_price,
        estimated_distance_km: order.estimated_distance_km,
      },
      driver,
    };
  });

/**
 * Lightweight, high-frequency position poll for the customer tracking page.
 * Returns only the car position + status (no route/ETA calls), so it can run every second.
 */
export const trackPosition = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("status,assigned_driver_id")
      .eq("tracking_code", data.code.toUpperCase())
      .maybeSingle();
    if (!order) return { found: false as const };
    if (!order.assigned_driver_id) return { found: true as const, status: order.status, lat: null, lng: null };
    const { data: loc } = await supabaseAdmin
      .from("driver_locations")
      .select("lat,lng,updated_at")
      .eq("driver_id", order.assigned_driver_id)
      .maybeSingle();
    return {
      found: true as const,
      status: order.status,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    };
  });
