# Roadmap

1. [x] Zpoždění nových zakázek — dispečink poll 15s→5s, řidič: guard proti souběhům + okamžité obnovení při návratu do popředí, jízdy/výběry 5s→15s. (Čeká publikace do APK.)
2. [x] Typová chyba error-komponenty v `src/routes/__root.tsx` (předcházela) — opraveno (`error: unknown`).
3. [ ] Chyba v nativní APK — publikovaný web i náhled běží bez chyby; čekám na screenshot chyby od uživatele.
4. [ ] Umělá inteligence (uživatel chce všechny funkce postupně):
   - [x] Překladač řidič ↔ zákazník — `src/components/TranslatePanel.tsx`, `src/lib/translate.functions.ts`, `src/lib/ai/translate.server.ts` (Lovable AI, model openai/gpt-6-astra). Tlačítko PŘEKLADAČ v dispečinku i u řidiče; ověřeno v náhledu.
   - [x] Hlasové zadávání zakázek — mikrofon, WAV přepis, úprava textu a rozpoznání do formuláře bez automatického odeslání; skutečné AI volání a český zvukový přepis ověřeny.
   - [x] Návrh vhodných kolegů pro skupiny — volní řidiči, kapacity z tarifů, čerstvé polohy, vzdálenosti a chybějící místa; testy pořadí a dostupnosti prošly.
   - [x] Pomoc dispečerovi — dotazy a souhrny aktuálních zakázek, pouze doporučení bez změn; AI odpověď ověřena.
   - [ ] Ověření všech nových funkcí v přihlášeném dispečinku — blokováno vypršeným přihlášením; uživatel se musí přihlásit v náhledu.
5. [ ] Zpřístupnění nových funkcí v APK — vyžaduje publikaci webu a nový APK s oprávněním mikrofonu; publikace nebyla v této žádosti požadována.


