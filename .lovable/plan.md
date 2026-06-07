## Plán: Dvě verze aplikace Vinné taxi

### 1. Android – plnohodnotná nativní aplikace (Capacitor APK)

**Co udělám:**
- Nainstaluju Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`)
- Přidám plugin `@capacitor/geolocation` + `@capacitor-community/background-geolocation` pro GPS na pozadí
- Přidám `@capacitor/push-notifications` pro notifikace o nových objednávkách
- Vygeneruju Android projekt (`npx cap add android`)
- Nastavím ikonu (úvodní obrázek z přihlašovací obrazovky) a název "Vinné taxi"
- Nakonfiguruju oprávnění v `AndroidManifest.xml`: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`
- Přidám foreground notifikaci "Vinné taxi sleduje polohu" (povinné u Androidu pro GPS na pozadí)
- Build instrukce pro vygenerování `.apk` souboru

**Jak řidič dostane APK:**
- Stránka `/stahnout` s tlačítkem "Stáhnout pro Android" + QR kód
- APK soubor nahraný do `public/downloads/vinne-taxi.apk`
- Návod: povolit "Instalace z neznámých zdrojů" → nainstalovat → přihlásit

**Důležité upozornění:** APK soubor musíš vygenerovat lokálně (potřebuješ Android Studio nebo službu jako EAS Build / Codemagic). Já připravím veškerý kód a konfiguraci, ty potom spustíš `npx cap sync android && cd android && ./gradlew assembleRelease`. Pošlu ti přesný návod.

### 2. iPhone – PWA verze (kterou už máme připravenou)

- PWA infrastruktura už existuje (manifest, install banner, `/install` stránka)
- iPhone uživatelé: Safari → Sdílet → "Přidat na plochu"
- Omezení: GPS funguje jen když je apka otevřená na popředí, žádné notifikace na pozadí
- Doplním na stránku `/stahnout` sekci "iPhone" s návodem

### 3. Sjednocená stránka /stahnout

```
┌─────────────────────────────────┐
│   Stáhnout aplikaci Vinné taxi  │
├─────────────────────────────────┤
│  📱 Android (doporučeno)         │
│  [Stáhnout APK]   [QR kód]      │
│  Plná verze s GPS na pozadí     │
├─────────────────────────────────┤
│  🍎 iPhone                       │
│  Návod: Safari → Sdílet →       │
│  "Přidat na plochu"             │
│  (omezená verze – GPS jen v apce)│
└─────────────────────────────────┘
```

### 4. Detekce platformy v kódu

- Když je v Capacitoru (Android) → použít nativní `@capacitor/geolocation` s background módem
- Když je v prohlížeči (iPhone PWA) → použít web `navigator.geolocation`
- Wrapper `useLocation()` hook, který detekuje runtime přes `Capacitor.isNativePlatform()`

### Co budeš muset udělat ty po mé práci

1. Stáhnout projekt do svého počítače
2. Nainstalovat Android Studio (zdarma)
3. Spustit příkazy které ti přesně napíšu (`bun install`, `npx cap sync android`, build)
4. Výsledný `.apk` nahrát zpět do `public/downloads/` a publikovat

**Alternativa bez Android Studia:** Použít online službu (EAS Build, Codemagic, GitHub Actions) – připravím i workflow pro GitHub Actions, který APK vygeneruje automaticky při každém pushi.

### Časový odhad mé práce
~25-30 minut: Capacitor setup, GPS plugin, push notifikace, oprávnění, stránka `/stahnout`, návody, GitHub Actions workflow.

---

**Můžu začít?** Pokud souhlasíš, pustím se do toho a na konci ti dám přesný checklist co udělat pro vygenerování APK.
