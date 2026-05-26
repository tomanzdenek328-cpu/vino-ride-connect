import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

const InputSchema = z.object({ order_id: z.string().uuid() });

export const autoAssignOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Dispatcher only.
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleRow?.role !== "dispatcher") {
      throw new Error("Pouze dispečer může spustit automatické přidělení.");
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id,pickup_lat,pickup_lng,status,assigned_driver_id,scheduled_time")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) return { ok: false, reason: "not_found" as const };
    if (order.status !== "pending" || order.assigned_driver_id) {
      return { ok: false, reason: "already_assigned" as const };
    }
    if (order.pickup_lat == null || order.pickup_lng == null) {
      return { ok: false, reason: "no_pickup_coords" as const };
    }
    // Don't auto-assign scheduled future rides.
    if (order.scheduled_time && new Date(order.scheduled_time).getTime() > Date.now() + 5 * 60_000) {
      return { ok: false, reason: "scheduled" as const };
    }

    // Online drivers + their current active order (if any) for destination-aware scoring.
    const { data: locs } = await supabaseAdmin
      .from("driver_locations")
      .select("driver_id,lat,lng,online,busy")
      .eq("online", true);

    const candidates = (locs ?? []).filter((l) => l.lat != null && l.lng != null);
    if (candidates.length === 0) return { ok: false, reason: "no_drivers" as const };

    const driverIds = candidates.map((c) => c.driver_id);
    const { data: activeOrders } = await supabaseAdmin
      .from("orders")
      .select("assigned_driver_id,destination_lat,destination_lng,status")
      .in("assigned_driver_id", driverIds)
      .in("status", ["assigned", "accepted", "in_progress"]);

    const activeByDriver = new Map<string, { destination_lat: number | null; destination_lng: number | null }>();
    (activeOrders ?? []).forEach((o: any) => {
      if (o.assigned_driver_id) activeByDriver.set(o.assigned_driver_id, o);
    });

    let best: { driver_id: string; score: number } | null = null;
    for (const c of candidates) {
      const active = activeByDriver.get(c.driver_id);
      let score: number | null = null;
      // Penalty: busy drivers add fixed cost (assumed remaining trip) since they're not free yet.
      const BUSY_PENALTY_KM = 3;
      if (c.busy || active) {
        // Use destination if known — that's where they'll end up.
        if (active?.destination_lat != null && active?.destination_lng != null) {
          score =
            haversineKm(active.destination_lat, active.destination_lng, order.pickup_lat, order.pickup_lng) +
            BUSY_PENALTY_KM;
        } else {
          // Busy with unknown destination — skip.
          continue;
        }
      } else {
        score = haversineKm(c.lat as number, c.lng as number, order.pickup_lat, order.pickup_lng);
      }
      if (score != null && (best == null || score < best.score)) {
        best = { driver_id: c.driver_id, score };
      }
    }

    if (!best) return { ok: false, reason: "no_drivers" as const };

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ assigned_driver_id: best.driver_id, status: "assigned" })
      .eq("id", order.id)
      .eq("status", "pending")
      .is("assigned_driver_id", null);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, driver_id: best.driver_id, score_km: Math.round(best.score * 10) / 10 };
  });
