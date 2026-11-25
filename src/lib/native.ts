// Native bridge pro Capacitor (Android APK).
// Na webu je vše no-op, takže se nic nerozbije.
// Pluginy načítáme až při použití nativní funkce.
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { supabase } from "@/integrations/supabase/client";
import { ANDROID_ALERT_CHANNEL, BACKGROUND_LOCATION_OPTIONS } from './native-settings';

export const isNative = () => Capacitor.isNativePlatform?.() ?? false;

let bgWatcherId: string | null = null;
let bgGeneration = 0;
let pushInitialization: Promise<void> | null = null;
let pushUserId: string | null = null;
let pushListenersReady = false;
let localInitialization: Promise<void> | null = null;
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

async function loadNativeModule(name: string): Promise<any> {
  // Literal imports are bundled by Vite; bare runtime imports fail in WebView.
  if (name === "@capacitor/push-notifications") return import("@capacitor/push-notifications");
  if (name === "@capacitor/local-notifications") return import("@capacitor/local-notifications");
  throw new Error("Unknown native module");
}

/**
 * Spustí sledování polohy na pozadí (i se zamčeným telefonem).
 * Funguje pouze v nativní Android APK přes Capacitor.
 */
export async function startBackgroundGeolocation(driverId: string) {
  if (!isNative()) return;
  const generation = ++bgGeneration;
  let writing = false;
  try {
    // Android 13 requires this before the GPS service can show its notification.
    await initLocalNotifications();
    if (generation !== bgGeneration) return;
    if (bgWatcherId) {
      await BackgroundGeolocation.removeWatcher({ id: bgWatcherId });
      bgWatcherId = null;
    }
    const id = await BackgroundGeolocation.addWatcher(
      BACKGROUND_LOCATION_OPTIONS,
      async (location: any, error: any) => {
        if (error) {
          console.warn("[bg-geo]", error);
          return;
        }
        if (!location || generation !== bgGeneration || writing) return;
        writing = true;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true })),
        ]);
        const session = sessionResult?.data.session;
        if (!session || session.user.id !== driverId || generation !== bgGeneration || controller.signal.aborted) return;
        // Native HTTP is not throttled with WebView fetch after five minutes.
        // This uses the user's bearer token and ordinary row permissions, not admin.
        const response = await CapacitorHttp.post({
          url: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/driver_locations?on_conflict=driver_id`,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          connectTimeout: 10_000,
          readTimeout: 10_000,
          data: {
          driver_id: driverId,
          lat: location.latitude,
          lng: location.longitude,
          heading: location.bearing ?? null,
          speed: location.speed ?? null,
          online: true,
          updated_at: new Date().toISOString(),
          },
        });
        if (response.status >= 400) console.warn('[bg-geo] uložení polohy selhalo', response.status);
        } catch { console.warn('[bg-geo] přenos polohy selhal');
        } finally { clearTimeout(timeout); writing = false; }
      },
    );
    if (generation !== bgGeneration) await BackgroundGeolocation.removeWatcher({ id });
    else bgWatcherId = id;
  } catch (e) {
    console.warn("Background geolocation start failed", e);
  }
}

export async function stopBackgroundGeolocation() {
  bgGeneration++;
  if (!isNative() || !bgWatcherId) return;
  const id = bgWatcherId;
  bgWatcherId = null;
  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch (e) {
    console.warn("Background geolocation stop failed", e);
  }
}

/**
 * Zaregistruje zařízení pro push notifikace.
 * Registrace ukládá token pro systémová upozornění bez jeho logování.
 */
export async function initPushNotifications(userId: string) {
  if (!isNative()) return;
  if (pushInitialization && pushUserId === userId) return pushInitialization;
  const previous = pushInitialization;
  pushUserId = userId;
  pushInitialization = (async () => {
    await previous;
    const registered = await registerPushNotifications();
    if (!registered && pushUserId === userId) pushInitialization = null;
  })();
  return pushInitialization;
}

async function registerPushNotifications() {
  try {
    const mod: any = await loadNativeModule("@capacitor/push-notifications");
    const PushNotifications = mod.PushNotifications ?? mod.default;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return false;
    await PushNotifications.createChannel(ANDROID_ALERT_CHANNEL);
    if (!pushListenersReady) {
    await PushNotifications.addListener("registration", async (token: any) => {
      try {
        const { saveFcmToken } = await import("./push.functions");
        await saveFcmToken({ data: { token: token.value, platform: "android" } });
      } catch (e) {
        console.warn("[push] save token failed", e);
      }
    });
    await PushNotifications.addListener("registrationError", (err: any) => {
      pushInitialization = null;
      console.warn("[push] registration error", err);
    });
    await PushNotifications.addListener("pushNotificationReceived", () => {
      window.dispatchEvent(new Event("focus"));
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.dispatchEvent(new Event('focus'));
    });
    pushListenersReady = true;
    }
    await PushNotifications.register();
    return true;
  } catch (e) {
    console.warn("Push notifications init failed", e);
    return false;
  }
}

/**
 * Vyžádá povolení pro lokální notifikace (jen v APK).
 */
export async function initLocalNotifications() {
  if (!isNative()) return;
  if (localInitialization) return localInitialization;
  localInitialization = requestLocalNotifications();
  return localInitialization;
}

async function requestLocalNotifications() {
  try {
    const mod: any = await loadNativeModule("@capacitor/local-notifications");
    const LocalNotifications = mod.LocalNotifications ?? mod.default;
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') { localInitialization = null; return; }
    await LocalNotifications.createChannel(ANDROID_ALERT_CHANNEL);
  } catch (e) {
    localInitialization = null;
    console.warn("Local notifications init failed", e);
  }
}

/**
 * Zobrazí systémovou notifikaci v APK (zvuk + vibrace).
 * Na webu je no-op.
 */
export async function showLocalNotification(title: string, body: string) {
  if (!isNative()) return;
  try {
    await initLocalNotifications();
    const mod: any = await loadNativeModule("@capacitor/local-notifications");
    const LocalNotifications = mod.LocalNotifications ?? mod.default;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          channelId: ANDROID_ALERT_CHANNEL.id,
        },
      ],
    });
  } catch (e) {
    console.warn("Local notification show failed", e);
  }
}
