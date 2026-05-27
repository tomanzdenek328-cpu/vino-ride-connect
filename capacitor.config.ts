import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.vinnetaxi',
  appName: 'Vinné Taxi',
  webDir: 'dist',
  server: {
    // Po vygenerování APK přes PWABuilder se použije tato URL.
    // Pokud chcete načítat aplikaci přímo z webu (vždy aktuální verze),
    // nechte url nastavenou. Jinak ji smažte a zabalí se lokální build.
    url: 'https://vino-ride-connect.lovable.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
