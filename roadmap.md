# Roadmap

1. [ ] Zjistit, jakou chybu uživatel vidí (domovská stránka a přihlášení v náhledu fungují bez chyby — zeptat uživatele, kde přesně se chyba ukazuje).
2. [ ] Odstranit zpoždění nových zakázek v nativní aplikaci (dispečer i řidič) — přidat realtime odběr (Supabase Realtime) na tabulku orders místo čekání na 15s interval; ponechat polling jako zálohu.
3. [ ] Omezit zamrzání aplikace — dál zkontrolovat souběhy načítání a realtime/interval duplicity v driver i dispatcher view.
4. [ ] Umělá inteligence — zodpovědět uživatele (ano, jde přidat) a zjistit, k čemu by měla sloužit (chat, vyhodnocování, rozpoznávání?).
