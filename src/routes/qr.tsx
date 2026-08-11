import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/CustomerShell";
import logo from "@/assets/logo.png";
import plakat from "@/assets/qr-plakat.png.asset.json";



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

const PUBLIC_URL = "https://vino-ride-connect.lovable.app/objednat";

function QrPage() {
  const [url, setUrl] = useState(PUBLIC_URL);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    // Na náhledu/lokálu ukaž vlastní origin, jinak vždy veřejnou adresu.
    if (host === "localhost" || host.endsWith("lovableproject.com") || host.includes("-preview--")) {
      setUrl(`${window.location.origin}/objednat`);
    }
  }, []);

  return (
    <CustomerShell>
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center bg-background/60">
      <img src={logo} alt="Vinné Taxi logo" className="h-24 w-auto drop-shadow-[0_0_18px_rgba(0,0,0,0.7)]" />
      <h1 className="font-display text-2xl text-primary glow-text">▸ OBJEDNEJ SI S NÁMI JÍZDU</h1>
      <div className="bg-white p-4 rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <QRCodeSVG value={url} size={240} level="M" includeMargin />
      </div>

      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all max-w-xs">
        {url}
      </a>
      <p className="text-xs text-muted-foreground max-w-xs">
        Naskenujte telefonem – otevře se objednávka jízdy. Stránku lze přidat na plochu jako aplikaci.
      </p>

      <div className="flex flex-col gap-3 items-center">
        <button
          onClick={() => window.print()}
          className="border border-primary text-primary px-6 py-2 text-sm tracking-widest"
        >
          ▸ VYTISKNOUT
        </button>
        <a
          href={plakat.url}
          download="vinne-taxi-qr-plakat.png"
          className="border border-primary bg-primary/20 text-primary px-6 py-2 text-sm tracking-widest"
        >
          ▸ STÁHNOUT PLAKÁT
        </a>
      </div>

      </div>
    </CustomerShell>
  );
}
