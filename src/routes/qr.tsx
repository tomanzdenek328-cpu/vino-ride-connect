import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/qr")({
  head: () => ({
    meta: [
      { title: "QR kód pro zákazníky – Vinné Taxi" },
      { name: "description", content: "QR kód na objednávkovou stránku Vinné Taxi – k vytištění do vozu i na provozovnu." },
      { property: "og:title", content: "QR kód pro zákazníky – Vinné Taxi" },
      { property: "og:description", content: "QR kód na objednávkovou stránku Vinné Taxi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QrPage,
});

function QrPage() {
  const [origin, setOrigin] = useState("https://vino-ride-connect.lovable.app");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  const url = `${origin}/objednat`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="font-display text-2xl text-primary glow-text">▸ OBJEDNEJ TAXI</h1>
      <div className="bg-white p-4">
        <QRCodeSVG value={url} size={240} />
      </div>
      <div className="text-xs text-muted-foreground break-all max-w-xs">{url}</div>
      <p className="text-xs text-muted-foreground max-w-xs">
        Naskenujte telefonem – otevře se objednávka jízdy. Stránku lze přidat na plochu jako aplikaci.
      </p>
      <button
        onClick={() => window.print()}
        className="border border-primary text-primary px-6 py-2 text-sm tracking-widest"
      >
        ▸ VYTISKNOUT
      </button>
    </div>
  );
}
