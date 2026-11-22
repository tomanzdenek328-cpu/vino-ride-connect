# Roadmap

10. [x] Stabilní identita při obnově oprávnění, jeden nativní GPS zdroj, jednorázové notifikace, obnova zakázek s časovým limitem a okamžité potvrzení uloženého přijetí. Přijetí přiřazené testovací zakázky (0,26 s), stav po obnovení, odhlášení a mobilní zobrazení ověřeny; 21 testů prošlo, testovací data odstraněna. Čeká publikace, zasekávání skutečné APK nelze v prohlížeči potvrdit.

9. [x] Oko u hesla, vlastní registrace se jménem a volacím znakem, TORPÉDO jako hlavní dispečer a přidělování pomocného dispečera v detailu řidiče. Skutečná registrace vytvořila řidiče, TORPÉDO přidělil roli, pomocný dispečer vytvořil a přečetl zakázku; přímé čtení ostatních řidičů, poloh a jízd i změna rolí byly zablokovány. Telefonní zobrazení ověřeno, zkušební účty a zakázka odstraněny. Zatím nepublikováno, APK neověřena.

8. [x] Zákaznické zakázky — ruční odhad příjezdu a jeho čtení zákazníkem, blokace odjezdu během předchozí jízdy, JEDU PRO ZÁKAZNÍKA a odlišení u řidiče ověřeny v přihlášené aplikaci a na mobilním rozměru; 9 testů prošlo. Google Maps výpočet z aktuální polohy je připraven, ale musí být ověřen na publikované stránce; APK neověřena.

7. [x] Překladač — příchozí překlad vždy česky, automatický zdrojový jazyk a zapamatovaný mužský/ženský hlas podle účtu; 8 testů prošlo, skutečný anglický přepis, český překlad, oba hlasy a opakování z cache ověřeny v přihlášeném dispečinku na desktopu a mobilním rozměru. APK a publikace neověřeny.

6. [x] Překladač — mikrofon, přehrání překladu v cílovém jazyce a opakování bez dalšího AI volání; skutečný přepis a zvuk v obou směrech ověřeny v přihlášeném dispečinku na desktopu i mobilním rozměru. APK vyžaduje publikaci a oprávnění mikrofonu.

1. [x] Zpoždění nových zakázek — dispečink poll 15s→5s, řidič: guard proti souběhům + okamžité obnovení při návratu do popředí, jízdy/výběry 5s→15s. (Čeká publikace do APK.)
2. [x] Typová chyba error-komponenty v `src/routes/__root.tsx` (předcházela) — opraveno (`error: unknown`).
3. [ ] Chyba v nativní APK — screenshoty dodány: zakázky jsou zamčené, Android má zapnuté pozastavení nepoužívané aplikace. Úpravy viz bod 10; ověření zasekávání na skutečném telefonu čeká na publikaci a zkoušku uživatelem.
4. [ ] Umělá inteligence (uživatel chce všechny funkce postupně):
   - [x] Překladač řidič ↔ zákazník — `src/components/TranslatePanel.tsx`, `src/lib/translate.functions.ts`, `src/lib/ai/translate.server.ts` (Lovable AI, model openai/gpt-6-astra). Tlačítko PŘEKLADAČ v dispečinku i u řidiče; ověřeno v náhledu.
   - [x] Hlasové zadávání zakázek — mikrofon, WAV přepis, úprava textu a rozpoznání do formuláře bez automatického odeslání; skutečné AI volání a český zvukový přepis ověřeny.
   - [x] Návrh vhodných kolegů pro skupiny — volní řidiči, kapacity z tarifů, čerstvé polohy, vzdálenosti a chybějící místa; testy pořadí a dostupnosti prošly.
   - [x] Pomoc dispečerovi — dotazy a souhrny aktuálních zakázek, pouze doporučení bez změn; AI odpověď ověřena.
   - [ ] Ověření všech nových funkcí v přihlášeném dispečinku — blokováno vypršeným přihlášením; uživatel se musí přihlásit v náhledu.
5. [ ] Zpřístupnění nových funkcí v APK — vyžaduje publikaci webu a nový APK s oprávněním mikrofonu; publikace nebyla v této žádosti požadována.


