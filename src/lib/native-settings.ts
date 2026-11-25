export const ANDROID_ALERT_CHANNEL = {
  id: 'vinne_taxi_alerts_v2',
  name: 'Zakázky, zprávy a SOS',
  description: 'Zvuková upozornění Vinného Taxi',
  importance: 5 as const,
  visibility: 0 as const,
  vibration: true,
  lights: true,
};

export const BACKGROUND_LOCATION_OPTIONS = {
  backgroundMessage: 'Vinné Taxi sleduje vaši polohu',
  backgroundTitle: 'Sledování polohy',
  requestPermissions: true,
  stale: false,
  distanceFilter: 0,
};

export const ANDROID_FCM_ALERT = {
  sound: 'default',
  channel_id: ANDROID_ALERT_CHANNEL.id,
};