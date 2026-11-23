import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CUSTOMER_INSTALL_PATH, isCustomerPath } from "@/lib/customer-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const customer = isCustomerPath(pathname);
  const dismissKey = customer ? "vt_customer_install_dismissed" : "vt_install_dismissed";
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDeferred(null);
    setReady(true);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    let savedDismissal = false;
    try { savedDismissal = localStorage.getItem(dismissKey) === "1"; } catch { /* storage may be disabled */ }
    setDismissed(standalone || savedDismissal);
    const ua = window.navigator.userAgent.toLowerCase();
    setShowIos(/iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua));
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const installed = () => { setDismissed(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, [dismissKey]);

  const close = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* optional preference */ }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const result = await deferred.userChoice;
      if (result.outcome === "accepted") close();
    } catch { /* Browser menu remains available through the installation guide. */ }
    finally { setDeferred(null); }
  };

  if (!ready || dismissed || pathname === CUSTOMER_INSTALL_PATH) return null;
  if (!customer && !deferred && !showIos) return null;

  return (
    <aside aria-label="Přidání aplikace na plochu" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-primary/40 bg-background/95 p-3 text-foreground shadow-sm">
      <Smartphone size={26} className="hidden shrink-0 text-primary sm:block" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold">{customer ? "Moje taxi na ploše" : "Nainstalovat Vinné Taxi"}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {customer ? "Zákaznická jízda bez přihlášení." : deferred ? "Přidat na plochu" : "Safari → Sdílet → Přidat na plochu."}
        </div>
      </div>
      {deferred ? (
        <Button size="sm" onClick={() => void install()}><Download /> Přidat</Button>
      ) : (
        <Button size="sm" asChild>
          <Link to={customer ? "/zakaznik-instalace" : "/install"}>{customer ? "Na plochu" : "Návod"}</Link>
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={close} aria-label="Zavřít nabídku instalace" title="Zavřít" className="shrink-0"><X /></Button>
    </aside>
  );
}
