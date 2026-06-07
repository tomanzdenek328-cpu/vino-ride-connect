import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Link } from "@tanstack/react-router";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "vt_install_dismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }

    // already installed?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore - iOS Safari
      window.navigator.standalone === true;
    if (standalone) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection (no beforeinstallprompt available)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (isIos) setShowIos(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    close();
  };

  if (dismissed) return null;
  if (!deferred && !showIos) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        right: 12,
        zIndex: 9999,
        background: "rgba(10,13,10,0.97)",
        border: "1px solid color-mix(in oklab, var(--color-primary) 50%, transparent)",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Smartphone size={28} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>Nainstalovat Vinné Taxi</div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          {deferred
            ? "Přidat na plochu – otevírá se jako aplikace."
            : "Safari → Sdílet → Přidat na plochu."}
        </div>
      </div>
      {deferred ? (
        <button
          onClick={install}
          style={{
            background: "var(--color-primary)",
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "8px 12px",
            fontWeight: 700,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <Download size={14} /> Instalovat
        </button>
      ) : (
        <Link
          to="/install"
          style={{
            background: "var(--color-primary)",
            color: "#000",
            borderRadius: 8,
            padding: "8px 12px",
            fontWeight: 700,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Návod
        </Link>
      )}
      <button
        onClick={close}
        aria-label="Zavřít"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-foreground)",
          opacity: 0.6,
          cursor: "pointer",
          padding: 4,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
