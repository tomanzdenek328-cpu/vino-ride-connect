// Server-only push helper: Web Push (PWA) + FCM (native APK) to a set of users.
import { VAPID_PUBLIC_KEY } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  priority?: boolean;
  tag?: string;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, fcmSent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let sent = 0;
  try {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .in("user_id", userIds);

    if (subs && subs.length) {
      const webpushMod = await import("web-push");
      const webpush = (webpushMod as any).default ?? webpushMod;
      webpush.setVapidDetails(
        process.env["VAPID_SUBJECT"] || "mailto:admin@vino-ride.cz",
        VAPID_PUBLIC_KEY,
        process.env["VAPID_PRIVATE_KEY"]!,
      );
      const body = JSON.stringify(payload);
      const toRemove: string[] = [];
      await Promise.all(
        subs.map(async (s: any) => {
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
    }
  } catch (e) {
    console.error("web push failed", e);
  }

  let fcmSent = 0;
  try {
    const { data: fcmRows } = await supabaseAdmin
      .from("fcm_tokens")
      .select("token")
      .in("user_id", userIds);
    const tokens = (fcmRows ?? []).map((r: any) => r.token as string);
    if (tokens.length) {
      const { sendFcmToTokens } = await import("./fcm.server");
      const r = await sendFcmToTokens(tokens, {
        title: payload.title,
        body: payload.body,
        data: { url: payload.url ?? "/dispatcher" },
      });
      fcmSent = r.sent;
      if (r.invalid.length) {
        await supabaseAdmin.from("fcm_tokens").delete().in("token", r.invalid);
      }
    }
  } catch (e) {
    console.error("FCM send failed", e);
  }

  return { sent, fcmSent };
}
