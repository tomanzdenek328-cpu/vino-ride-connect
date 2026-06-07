# Vinné Taxi – mobilní aplikace

## Přehled

| Platforma  | Verze                  | GPS na pozadí | Jak se nainstaluje                       |
| ---------- | ---------------------- | ------------- | ---------------------------------------- |
| **Android** | Nativní APK (Capacitor) | ✅ Ano        | Stáhnout `.apk` z GitHub Releases         |
| **iPhone**  | PWA (web na ploše)      | ❌ Ne (jen v popředí) | Safari → Sdílet → Přidat na plochu |

## Android – jak vygenerovat APK (automaticky přes GitHub Actions)

V repu je workflow `.github/workflows/android-apk.yml`, který APK postaví za vás:

1. Otevřete GitHub repozitář projektu.
2. Záložka **Actions** → **Build Android APK** → tlačítko **Run workflow**.
3. Po ~10 minutách stáhněte artefakt **vinne-taxi-apk** (dole na stránce běhu).
4. Rozbalte ZIP → uvnitř je `vinne-taxi.apk`.
5. Pošlete řidičům (e-mail, WhatsApp, nebo přes stránku `/install`).

**Vytvoření veřejné release** (s trvalým odkazem ke stažení):

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow automaticky vytvoří GitHub Release a přidá APK jako přílohu. Trvalý
odkaz pak je `https://github.com/<user>/<repo>/releases/latest/download/vinne-taxi.apk`.

## Android – ruční build (volitelné, vyžaduje Android Studio)

```bash
bun install
bun run build
bunx cap add android      # jen poprvé
bunx cap sync android
bunx cap open android     # otevře Android Studio
```

V Android Studiu: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

## Instalace APK na telefon řidiče

1. Otevřít `.apk` v telefonu (Gmail příloha, WhatsApp, stažení z odkazu).
2. Android zeptá na povolení **Instalace z neznámých zdrojů** → povolit.
3. Po instalaci spustit, povolit GPS **"Vždy"** a notifikace.
4. Aplikace běží jako Bolt/Uber – ikona na ploše, žádný prohlížeč,
   GPS funguje i se zhasnutým displejem.

## iPhone – PWA verze

iPhone uživatelé nepotřebují žádný build – stačí web:

1. Otevřít `https://vino-ride-connect.lovable.app` v **Safari** (nikoli Chrome).
2. Ikona **Sdílet** (čtvereček se šipkou) → **Přidat na plochu**.
3. Spustit z plochy – běží fullscreen bez prohlížeče.

**Omezení iPhone PWA:**

- GPS funguje **jen když je aplikace otevřená v popředí**.
- Push notifikace na pozadí nejsou spolehlivé.
- Pro plnou verzi by byl potřeba Apple Developer účet ($99/rok) a Mac.

## Co je už v kódu připravené

- `capacitor.config.ts` – app ID, název, ikona
- `src/lib/native.ts` – wrapper, který automaticky zvolí mezi web a nativní GPS
- `@capacitor-community/background-geolocation` – GPS na pozadí (Android)
- `@capacitor/push-notifications` – push (Android přes FCM)
- `_authenticated.driver.tsx` – spouští `startBackgroundGeolocation()` při přihlášení

## Push notifikace (volitelné)

Pro skutečné odesílání push na Android je potřeba **Firebase projekt (FCM)**:

1. Vytvořit projekt na <https://console.firebase.google.com>.
2. Stáhnout `google-services.json` → vložit do `android/app/`.
3. Token zařízení (v `native.ts` se loguje) ukládat do Supabase a odesílat
   push přes Firebase Admin SDK.

Bez FCM aplikace funguje – jen nepřijde notifikace o nové objednávce, když
je apka úplně zavřená.
