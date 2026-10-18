# Roadmap

1. [x] Zpoždění nových zakázek — dispečink poll 15s→5s, řidič: guard proti souběhům + okamžité obnovení při návratu do popředí, jízdy/výběry 5s→15s. (Čeká publikace do APK.)
2. [x] Typová chyba error-komponenty v `src/routes/__root.tsx` (předcházela) — opraveno (`error: unknown`).
3. [ ] Chyba v nativní APK — publikovaný web i náhled běží bez chyby; čekám na screenshot chyby od uživatele.
4. [ ] Umělá inteligence (uživatel chce všechny funkce postupně):
   - [x] Překladač řidič ↔ zákazník — `src/components/TranslatePanel.tsx`, `src/lib/translate.functions.ts`, `src/lib/ai/translate.server.ts` (Lovable AI, model openai/gpt-6-astra). Tlačítko PŘEKLADAČ v dispečinku i u řidiče; ověřeno v náhledu.
   - [ ] Hlasové zadávání zakázek (dikce → rozparsání adres/času do formuláře)
   - [ ] Návrh vhodného kolegy-řidiče pro větší skupiny podle polohy a typu auta
   - [ ] Pomoc dispečerovi (nápověda, souhrny)


