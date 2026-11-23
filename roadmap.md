# Roadmap

15. [ ] Partnerské jízdy: Vinné Taxi rozlišuje přijetí řidičem, příjezd a jízdu se zákazníkem, ověřuje odpověď a aplikuje potvrzené změny každých 5 s. 5 testů prošlo, sestavení bez chyb. Blokátor příjezdu: 2x Stárek ve svém partnerském statusu neposílá driver_arrived_at; nutná úprava a publikace v partnerském projektu, zde je pouze čitelný. Živé zobrazení dispečinku nelze potvrdit s dostupným účtem (Dj Vídně má roli řidiče). Publikace zde dosud neprovedena.

14. [x] Zákaznická ikona na ploše: vlastní manifest se vstupem pro kód jízdy, zákaznický návod místo řidičské APK; 3 testy prošly. Zadání kódu bez přihlášení, neexistující kód, mobilní a desktopové zobrazení i zachování řidičského manifestu ověřeny v prohlížeči. Skutečné přidání ikony na Androidu/iPhonu čeká na publikaci a zkoušku telefonu.

13. [x] Kontrola ochrany: zákaznické sledování oběma funkcemi nyní po dokončení/zrušení nevydává živou GPS ani údaje aktuálního vozu; skutečný uzavřený kód ověřen bez změny záznamu. Správa řidičů a emailů ověřuje dispečera před privilegovaným přístupem; správa vozidel nově načítá privilegovaný přístup až po stejném ověření. Partner ověřuje podpis a stáří zprávy; oba nepodepsané vstupy vracejí 401. Hlasové služby ověřují uživatele, diktování navíc dispečera; všechny tři nepřihlášené vstupy vracejí 401. AI čte s oprávněním volajícího, push ověřuje účet a helperovo vlastnictví zakázky. Chat, mapa, SOS a databázové funkce rolí přečteny; respektují opravené přístupy. 11 testů prošlo. Přenos mezi partnery, skutečné fotky v prázdném úložišti a skutečná APK nejsou živě ověřeny. Údaje hotových jízd, ostatní oprávnění a nastavení nezměněny.

12. [x] Široké přístupy nahrazeny pravidly pro členy taxislužby, vlastní/aktivní SOS polohy a dispečerské fotky; omezení pomocníků zachována. Zapnuta ochrana proti uniklým heslům a odebráno veřejné zjišťování pomocné role. Živá pravidla ověřena, přihlášený řidič vidí vlastní polohu a vozidla, nevidí běžné cizí polohy ani cizí vyřízené SOS; mapa a odhlášení fungují. 9 testů prošlo; bezpečnostní kontrola bez kritických nálezů, zbývají dvě informativní zprávy o veřejném ceníku a nastavení. Úložiště nyní nemá žádné fotky, proto skutečné stažení fotky nebylo vyzkoušeno; pravidlo pro dispečera a zákaznické podepsané odkazy ověřeny ze zdrojů. Skutečná APK nadále vyžaduje zkoušku na telefonu.

11. [x] Kontrola stejného zpoždění: kód dispečinku (zakázky, řidiči, přiřazení, uvolnění, zamčení, schválení), řidiče (přijetí, historie, výdaje, příjezd), mapy, SOS, chatu, vysílačky, taxametru, přihlášení a odhlášení, nativní GPS a notifikací, zákaznického sledování a partnerských funkcí přečten. Doplněny omezené sloučené obnovy seznamů a okamžité zobrazení potvrzených změn dispečera, SOS a odeslané zprávy. Vysílačka a taxametr již uklízejí spojení; příjezd již brání souběhům a záměrně pozastavuje placené výpočty při chybě. Partnerská obnova nově brání souběhům. Živé definice funkcí rolí, updated_at a automatického uvolnění přečteny: zakázky se uvolňují 45 minut předem, zamčené se nepřijímají; bez změny. Oprávnění, nastavení a uzavřené záznamy beze změn. Přihlášený řidič a odhlášení znovu ověřeny; ostatní výše uvedené části kontrolovány ze zdrojů, nikoli všechny živě. Skutečná APK čeká na publikaci a telefon.

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


