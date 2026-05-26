# Vinné Taxi – plán MVP

Aplikace pro koordinaci řidičů a dispečera v reálném čase, ve stylu terminálu (černé pozadí, fosforová zelená).

## Stack
- Lovable Cloud (Supabase) – auth, databáze, realtime
- TanStack Start + React
- Mapa: Leaflet + OpenStreetMap (zdarma, bez API klíčů)
- Vysílačka: WebRTC mesh peer-to-peer s Supabase realtime jako signalizace + push-to-talk

## Design system
- Pozadí: čistá černá `#000`
- Primární: fosforová zelená `#39FF14` (text, ohraničení, loga)
- Sekundární akcent: jantarová pro výstrahy
- Monospace font (JetBrains Mono) – CRT terminál look
- Subtle scanline efekt, glow na klíčových prvcích

## Databázové schéma
- `profiles` – id, full_name, call_sign (volací znak), role-info
- `user_roles` – user_id, role enum (`dispatcher` | `driver`) – samostatná tabulka, security definer `has_role()`
- `driver_locations` – driver_id, lat, lng, heading, updated_at, online
- `orders` – id, pickup_address, pickup_lat/lng, destination, customer_name, customer_phone, notes, status (`pending`|`assigned`|`accepted`|`in_progress`|`completed`|`cancelled`), assigned_driver_id, created_by, timestamps
- `radio_signals` – pro WebRTC signalizaci (offer/answer/ICE), broadcast přes realtime

RLS:
- profiles: každý vidí všechny přihlášené (potřeba pro mapu a vysílačku)
- user_roles: čtení vlastní, dispečer vidí všechny
- driver_locations: čtení všichni přihlášení, zápis pouze vlastník
- orders: dispečer plný přístup, řidič vidí přiřazené sobě + pending

## Routy
- `/login` – přihlášení (email+heslo)
- `/signup` – registrace s výběrem role
- `/_authenticated/dispatcher` – dispečerský dashboard: mapa všech řidičů, seznam zakázek, formulář nové zakázky, přiřazení řidiči
- `/_authenticated/driver` – řidičský pohled: mapa, moje zakázky, tlačítka přijmout/odmítnout/dokončit, sdílení polohy, online toggle
- `/` – auto-redirect podle role

## Komponenty
- `LiveMap` – Leaflet mapa s markery řidičů (real-time přes Supabase channels)
- `OrderList`, `OrderCard`, `NewOrderForm`
- `WalkieTalkie` – plovoucí tlačítko push-to-talk, WebRTC audio do "kanálu" (broadcast všem online)
- `OnlineStatus` toggle
- `RoleGate` – chrání podle role

## Vysílačka (technika)
- Push-to-talk tlačítko: drží = zachytí mikrofon přes `getUserMedia`, streamuje přes WebRTC `RTCPeerConnection` ke všem ostatním online uživatelům
- Signalizace přes Supabase realtime channel `radio` – broadcasty offer/answer/ICE
- Jednoduchý "always-on kanál" – kdo je online = slyší ostatní

## Sledování polohy řidiče
- `navigator.geolocation.watchPosition` na řidičově obrazovce při online stavu
- Update do `driver_locations` každé ~5 s, throttle
- Dispečer subscribuje realtime na změny tabulky

## Kroky implementace
1. Zapnout Lovable Cloud
2. Migrace: tabulky, enums, RLS, has_role funkce, trigger pro auto-profile
3. Design system v `src/styles.css` (černá + fosfor)
4. Auth kontext + routy login/signup + `_authenticated` guard
5. Instalovat Leaflet
6. Dispečerský dashboard
7. Řidičský pohled + geolokace
8. Vysílačka (WebRTC + signalizace)
9. Index redirect podle role

Po schválení začnu stavět.