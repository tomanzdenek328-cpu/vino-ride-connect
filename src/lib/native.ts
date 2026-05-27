// Native bridge pro Capacitor (Android APK).
// Na webu je vše no-op, takže se nic nerozbije.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const isNative = () => Capacitor.isNativePlatform?.() ?? false;

let bgWatcherId: string | null = null;

/**
 * Spustí sledování polohy na pozadí (i se zamčeným telefonem).
 * Funguje pouze v nativní Android APK přes Capacitor.
 */
export async function startBackgroundGeolocation(driverId: string) {
  if (!isNative()) return;
  try {
    const { BackgroundGeolocation } = await import(
      "@capacitor-community/background-geolocation"
    );
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
        distanceFilter: 10,
      },
      async (location, error) => {
        if (error) {
          console.warn("[bg-geo]", error);
          return;
        }
        if (!location) return;
        await supabase.from("driver_locations").upsert({
          driver_id: driverId,
          lat: location.latitude,
          lng: location.longitude,
          heading: location.bearing ?? null,
          speed: location.speed ?? null,
          online: true,
        });
      },
    );
  } catch (e) {
    console.warn("Background geolocation start failed", e);
  }
}

export async function stopBackgroundGeolocation() {
  if (!isNative() || !bgWatcherId) return;
  try {
    const { BackgroundGeolocation } = await import(
      "@capacitor-community/background-geolocation"
    );
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
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      console.log("[push] token:", token.value);
    });
    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[push] registration error", err);
    });
    PushNotifications.addListener("pushNotificationReceived", (n) => {
      console.log("[push] received", n);
    });
  } catch (e) {
    console.warn("Push notifications init failed", e);
  }
}
