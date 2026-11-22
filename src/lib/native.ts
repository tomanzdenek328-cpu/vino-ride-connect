// Native bridge pro Capacitor (Android APK).
// Na webu je vše no-op, takže se nic nerozbije.
// Pozn.: Capacitor pluginy načítáme přes runtime require, aby je Vite
// vůbec nezkoušel resolvnout při buildu webu (jejich main entry je nativní).
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { supabase } from "@/integrations/supabase/client";

export const isNative = () => Capacitor.isNativePlatform?.() ?? false;

let bgWatcherId: string | null = null;
let bgGeneration = 0;
let pushInitialization: Promise<void> | null = null;
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
    if (bgWatcherId) {
      await BackgroundGeolocation.removeWatcher({ id: bgWatcherId });
      bgWatcherId = null;
    }
    const id = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Vinné Taxi sleduje vaši polohu",
        backgroundTitle: "Sledování polohy",
        requestPermissions: true,
        stale: false,
        // Ten metres caused visible pauses at city speeds. A short filter keeps
        // movement fluid while still letting Android batch tiny GPS jitter.
        distanceFilter: 2,
      },
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
        const { error: updateError } = await supabase.from("driver_locations").upsert({
          driver_id: driverId,
          lat: location.latitude,
          lng: location.longitude,
          heading: location.bearing ?? null,
          speed: location.speed ?? null,
          online: true,
          updated_at: new Date().toISOString(),
        }).abortSignal(controller.signal);
        if (updateError) console.warn("[bg-geo] uložení polohy selhalo", updateError);
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
 * Token se zatím loguje – pro odesílání push budete potřebovat
 * Firebase projekt (FCM). Až ho budete mít, můžeme tokeny ukládat do DB
 * a odesílat notifikace ze serveru.
 */
export async function initPushNotifications() {
  if (!isNative()) return;
  if (pushInitialization) return pushInitialization;
  pushInitialization = registerPushNotifications();
  return pushInitialization;
}

async function registerPushNotifications() {
  try {
    const mod: any = await loadNativeModule("@capacitor/push-notifications");
    const PushNotifications = mod.PushNotifications ?? mod.default;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.addListener("registration", async (token: any) => {
      try {
        const { saveFcmToken } = await import("./push.functions");
        await saveFcmToken({ data: { token: token.value, platform: "android" } });
      } catch (e) {
        console.warn("[push] save token failed", e);
      }
    });
    await PushNotifications.addListener("registrationError", (err: any) => {
      console.warn("[push] registration error", err);
    });
    await PushNotifications.addListener("pushNotificationReceived", () => {
      window.dispatchEvent(new Event("focus"));
    });
    await PushNotifications.register();
  } catch (e) {
    console.warn("Push notifications init failed", e);
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
    await LocalNotifications.requestPermissions();
  } catch (e) {
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
    const mod: any = await loadNativeModule("@capacitor/local-notifications");
    const LocalNotifications = mod.LocalNotifications ?? mod.default;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          smallIcon: "ic_stat_icon_config_sample",
          sound: undefined,
        },
      ],
    });
  } catch (e) {
    console.warn("Local notification show failed", e);
  }
}
