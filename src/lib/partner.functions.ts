import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertDispatcher(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "dispatcher" });
  if (!data) throw new Error("Pouze dispečer.");
}

const Id = z.object({ orderId: z.string().uuid() });

export const sendToPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Id.parse(i))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const { data: o, error } = await context.supabase.from("orders").select("*").eq("id", data.orderId).single();
    if (error || !o) throw new Error("Zakázka nenalezena.");
    if (o.partner_direction === "in") throw new Error("Tuto zakázku poslal partner, nelze ji poslat zpět.");
    if (o.status === "completed" || o.status === "cancelled") throw new Error("Zakázka je uzavřená.");
    const { callPartner } = await import("@/lib/partner.server");
    const num = (v: any) => (v == null ? null : Number(v));
    await callPartner("inbox", {
      action: "offer",
      remote_id: o.id,
      order: {
        pickup_address: o.pickup_address, pickup_lat: o.pickup_lat, pickup_lng: o.pickup_lng,
        destination: o.destination, destination_lat: o.destination_lat, destination_lng: o.destination_lng,
        customer_name: o.customer_name, customer_phone: o.customer_phone, notes: o.notes,
        scheduled_time: o.scheduled_time, passengers: o.passengers, vehicle_type: o.vehicle_type,
        estimated_price: num(o.estimated_price), estimated_distance_km: num(o.estimated_distance_km),
      },
    });
    const { error: uErr } = await context.supabase.from("orders").update({
      partner_direction: "out", partner_state: "pending", partner_remote_status: null,
      released: false, assigned_driver_id: null, assigned_driver_ids: [], status: "pending",
    }).eq("id", o.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const recallFromPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Id.parse(i))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const { callPartner } = await import("@/lib/partner.server");
    await callPartner("inbox", { action: "cancel", remote_id: data.orderId });
    await context.supabase.from("orders").update({
      partner_direction: null, partner_state: null, partner_remote_status: null,
    }).eq("id", data.orderId);
    return { ok: true };
  });

export const respondPartnerOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().uuid(), accept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const { data: o } = await context.supabase.from("orders").select("scheduled_time, partner_direction").eq("id", data.orderId).single();
    if (!o || o.partner_direction !== "in") throw new Error("Zakázka nenalezena.");
    const later = !!o.scheduled_time && new Date(o.scheduled_time).getTime() > Date.now();
    const patch = data.accept
      ? { partner_state: "accepted", released: !later }
      : { partner_state: "rejected", status: "cancelled" as const, cancelled_by: context.userId, cancelled_at: new Date().toISOString() };
    const { error } = await context.supabase.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncPartnerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const { data: outs } = await context.supabase.from("orders").select("id, partner_state, partner_remote_status")
      .eq("partner_direction", "out").in("partner_state", ["pending", "accepted"])
      .not("status", "in", "(completed,cancelled)").limit(100);
    if (!outs?.length) return { updated: 0 };
    const { callPartner } = await import("@/lib/partner.server");
    const res = await callPartner<{ items: { id: string; state: string | null; status: string }[] }>("status", { ids: outs.map((o) => o.id) });
    let updated = 0;
    for (const it of res.items ?? []) {
      const cur = outs.find((o) => o.id === it.id);
      if (!cur) continue;
      let patch: Record<string, any> | null = null;
      if (it.state === "rejected" || (it.state === "accepted" && it.status === "cancelled") || it.state === "cancelled") {
        // vráceno zpět k nám
        patch = { partner_state: "rejected", partner_remote_status: it.status };
      } else if (it.state === "accepted" && it.status === "completed") {
        patch = { partner_state: "accepted", partner_remote_status: "completed", status: "completed" };
      } else if (it.state !== cur.partner_state || it.status !== cur.partner_remote_status) {
        patch = { partner_state: it.state, partner_remote_status: it.status };
      }
      if (patch) {
        await context.supabase.from("orders").update(patch as any).eq("id", it.id);
        updated++;
      }
    }
    return { updated };
  });
