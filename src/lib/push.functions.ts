import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  user_agent: z.string().max(500).optional().nullable(),
});

export const saveDriverPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert by endpoint (unique per device).
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function sendToSubscriptions(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: { title: string; body: string; url?: string; priority?: boolean; tag?: string },
) {
  if (subs.length === 0) return { sent: 0, removed: 0 };
  const webpushMod = await import("web-push");
  const webpush = (webpushMod as any).default ?? webpushMod;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@vino-ride.cz",
    "BOXLCpAtpFuEciHXN0sdLSjhXBqleGPYqFMDRHXGbmSFAYqFCaZhDmKcIIW3safPEwiTbIDzCPI8-LRp2y3NNKU",
    process.env.VAPID_PRIVATE_KEY!,
  );

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const body = JSON.stringify(payload);
  const toRemove: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60, urgency: "high" },
        );
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) toRemove.push(s.id);
        else console.error("push send failed", code, err?.message);
      }
    }),
  );

  if (toRemove.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
  }
  return { sent, removed: toRemove.length };
}

export const notifyNewOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only dispatchers may trigger broadcast.
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (role?.role !== "dispatcher") throw new Error("Forbidden");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,pickup_address,status,assigned_driver_id,priority,released")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) return { ok: false, reason: "not_found" as const };

    const title = order.priority ? "🚨 URGENTNÍ ZAKÁZKA" : "▸ NOVÁ ZAKÁZKA";
    const body = order.pickup_address || "Nová jízda čeká";
    const payload = { title, body, url: "/driver", priority: !!order.priority, tag: `order-${order.id}` };

    let targetUserIds: string[] = [];
    if (order.assigned_driver_id) {
      targetUserIds = [order.assigned_driver_id];
    } else if (order.status === "pending" && order.released) {
      const { data: online } = await supabaseAdmin
        .from("driver_locations").select("driver_id").eq("online", true);
      targetUserIds = (online ?? []).map((r) => r.driver_id);
    }
    if (targetUserIds.length === 0) return { ok: true, sent: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,user_id")
      .in("user_id", targetUserIds);

    const result = await sendToSubscriptions((subs ?? []) as any, payload);

    // Also send FCM (native APK) to those users.
    let fcmSent = 0;
    try {
      const { data: fcmRows } = await supabaseAdmin
        .from("fcm_tokens").select("id,token").in("user_id", targetUserIds);
      const tokens = (fcmRows ?? []).map((r: any) => r.token as string);
      if (tokens.length) {
        const { sendFcmToTokens } = await import("./fcm.server");
        const r = await sendFcmToTokens(tokens, {
          title,
          body,
          data: { url: "/driver", orderId: order.id },
        });
        fcmSent = r.sent;
        if (r.invalid.length) {
          await supabaseAdmin.from("fcm_tokens").delete().in("token", r.invalid);
        }
      }
    } catch (e) {
      console.error("FCM send failed", e);
    }

    return { ok: true, ...result, fcmSent };
  });

export const saveFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      token: z.string().min(10).max(500),
      platform: z.string().max(20).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("fcm_tokens")
      .upsert(
        {
          user_id: context.userId,
          token: data.token,
          platform: data.platform ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
