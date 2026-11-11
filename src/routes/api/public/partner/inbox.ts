import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Offer = z.object({
  action: z.literal("offer"),
  remote_id: z.string().uuid(),
  order: z.object({
    pickup_address: z.string().min(1).max(300),
    pickup_lat: z.number().nullable().optional(),
    pickup_lng: z.number().nullable().optional(),
    destination: z.string().max(300).nullable().optional(),
    destination_lat: z.number().nullable().optional(),
    destination_lng: z.number().nullable().optional(),
    customer_name: z.string().max(120).nullable().optional(),
    customer_phone: z.string().max(40).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    scheduled_time: z.string().max(40).nullable().optional(),
    passengers: z.number().int().min(1).max(20).optional(),
    vehicle_type: z.string().max(30).nullable().optional(),
    estimated_price: z.number().nullable().optional(),
    estimated_distance_km: z.number().nullable().optional(),
  }),
});
const Cancel = z.object({ action: z.literal("cancel"), remote_id: z.string().uuid() });
const Msg = z.discriminatedUnion("action", [Offer, Cancel]);

export const Route = createFileRoute("/api/public/partner/inbox")({
  server: { handlers: { POST: async ({ request }) => {
    const { verifyPartnerRequest } = await import("@/lib/partner.server");
    const v = await verifyPartnerRequest(request);
    if (!v) return new Response("Unauthorized", { status: 401 });
    const parsed = Msg.safeParse(v.payload);
    if (!parsed.success) return new Response("Bad request", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = parsed.data;
    if (m.action === "offer") {
      const { data: existing } = await supabaseAdmin.from("orders").select("id")
        .eq("partner_remote_id", m.remote_id).eq("partner_direction", "in").maybeSingle();
      if (existing) return Response.json({ ok: true, id: existing.id });
      const { data, error } = await supabaseAdmin.from("orders").insert({
        ...m.order,
        passengers: m.order.passengers ?? 1,
        status: "pending",
        released: false,
        source: "partner",
        partner_direction: "in",
        partner_state: "pending",
        partner_remote_id: m.remote_id,
        partner_name: v.from,
      }).select("id").single();
      if (error) return new Response("Error", { status: 500 });
      return Response.json({ ok: true, id: data.id });
    }
    await supabaseAdmin.from("orders").update({
      status: "cancelled", partner_state: "cancelled", cancelled_at: new Date().toISOString(),
    }).eq("partner_remote_id", m.remote_id).eq("partner_direction", "in")
      .not("status", "in", "(completed,cancelled)");
    return Response.json({ ok: true });
  } } },
});
