import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Q = z.object({ ids: z.array(z.string().uuid()).max(100) });

export const Route = createFileRoute("/api/public/partner/status")({
  server: { handlers: { POST: async ({ request }) => {
    const { verifyPartnerRequest } = await import("@/lib/partner.server");
    const v = await verifyPartnerRequest(request);
    if (!v) return new Response("Unauthorized", { status: 401 });
    const parsed = Q.safeParse(v.payload);
    if (!parsed.success) return new Response("Bad request", { status: 400 });
    if (!parsed.data.ids.length) return Response.json({ items: [] });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("orders")
      .select("partner_remote_id, partner_state, status")
      .eq("partner_direction", "in").in("partner_remote_id", parsed.data.ids);
    return Response.json({ items: (data ?? []).map((r) => ({ id: r.partner_remote_id, state: r.partner_state, status: r.status })) });
  } } },
});
