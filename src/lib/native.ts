// Native bridge pro Capacitor (Android APK).
// Na webu je vše no-op, takže se nic nerozbije.
// Pozn.: Capacitor pluginy načítáme přes runtime require, aby je Vite
// vůbec nezkoušel resolvnout při buildu webu (jejich main entry je nativní).
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { supabase } from "@/integrations/supabase/client";

export const isNative = () => Capacitor.isNativePlatform?.() ?? false;

let bgWatcherId: string | null = null;
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

async function loadNativeModule(name: string): Promise<any> {
  const spec = name;
  // @vite-ignore – záměrně dynamický specifikátor, modul existuje jen v APK.
  return await import(/* @vite-ignore */ spec);
}

/**
 * Spustí sledování polohy na pozadí (i se zamčeným telefonem).
 * Funguje pouze v nativní Android APK přes Capacitor.
 */
export async function startBackgroundGeolocation(driverId: string) {
  if (!isNative()) return;
  try {
    if (bgWatcherId) {
      await BackgroundGeolocation.removeWatcher({ id: bgWatcherId });
      bgWatcherId = null;
    }
    bgWatcherId = await BackgroundGeolocation.addWatcher(
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
        if (!location) return;
        const { error: updateError } = await supabase.from("driver_locations").upsert({
          driver_id: driverId,
          lat: location.latitude,
          lng: location.longitude,
          heading: location.bearing ?? null,
          speed: location.speed ?? null,
          online: true,
          updated_at: new Date().toISOString(),
        });
        if (updateError) console.warn("[bg-geo] uložení polohy selhalo", updateError);
      },
    );
  } catch (e) {
    console.warn("Background geolocation start failed", e);
  }
}

export async function stopBackgroundGeolocation() {
  if (!isNative() || !bgWatcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: bgWatcherId });
  } catch (e) {
    console.warn("Background geolocation stop failed", e);
  } finally {
    bgWatcherId = null;
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
  try {
    const mod: any = await loadNativeModule("@capacitor/push-notifications");
    const PushNotifications = mod.PushNotifications ?? mod.default;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token: any) => {
      console.log("[push] token:", token.value);
      try {
        const { saveFcmToken } = await import("./push.functions");
        await saveFcmToken({ data: { token: token.value, platform: "android" } });
      } catch (e) {
        console.warn("[push] save token failed", e);
      }
    });
    PushNotifications.addListener("registrationError", (err: any) => {
      console.warn("[push] registration error", err);
    });
    PushNotifications.addListener("pushNotificationReceived", (n: any) => {
      console.log("[push] received", n);
    });
  } catch (e) {
    console.warn("Push notifications init failed", e);
  }
}

/**
 * Vyžádá povolení pro lokální notifikace (jen v APK).
 */
export async function initLocalNotifications() {
  if (!isNative()) return;
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
