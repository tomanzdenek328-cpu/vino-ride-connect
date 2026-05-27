# Vinné Taxi – mobilní APK (Android)

Aplikace je připravená pro zabalení do nativní Android APK přes Capacitor.
Nejjednodušší cesta je **PWABuilder.com** – nepotřebujete Android Studio.

## Co umí mobilní APK navíc oproti webu

- **GPS na pozadí** – sleduje polohu řidiče i se zamčeným telefonem
  (plugin `@capacitor-community/background-geolocation`).
- **Push notifikace** – připraveno přes `@capacitor/push-notifications`.
  Pro skutečné odesílání push budete potřebovat Firebase projekt (FCM).
- **Instalace mimo Play Store** – stačí poslat .apk soubor (e-mail, WhatsApp).

## Postup vygenerování APK přes PWABuilder

1. Projekt publikujte v Lovable (tlačítko **Publish**).
2. Otevřete <https://www.pwabuilder.com>.
3. Vložte URL: `https://vino-ride-connect.lovable.app`
4. Klikněte **Start** → po analýze klikněte **Package For Stores → Android**.
5. Vyberte **Signed APK** (pro instalaci mimo Play) nebo **Test package**.
6. Stáhněte ZIP, uvnitř je `.apk` soubor.
7. Pošlete řidičům – nainstalují přes „Neznámé zdroje" v nastavení Androidu.

## Postup přes Android Studio (volitelné)

```bash
bun add -d @capacitor/cli
bun run build
bunx cap add android
bunx cap sync android
bunx cap open android
```

V Android Studiu: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

## iPhone

Pro iOS musíte mít Mac + Apple Developer účet (99 USD/rok). APK na iPhonu
nefunguje. Pokud řidiči mají iPhone, použijí web (PWA – Přidat na plochu).

## Oprávnění (Android)

V `android/app/src/main/AndroidManifest.xml` po `cap add android` přidejte:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

PWABuilder tyto oprávnění většinou nastaví automaticky podle manifestu
a použitých Capacitor pluginů.
