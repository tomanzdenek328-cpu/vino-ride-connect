import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Smartphone, Share, Plus, Download } from "lucide-react";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Nainstalovat Vinné Taxi" },
      { name: "description", content: "Stáhněte si aplikaci Vinné Taxi přímo na plochu telefonu." },
    ],
  }),
  component: InstallPage,
});

function InstallPage() {
  const [url, setUrl] = useState("https://vino-ride-connect.lovable.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.origin);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px 80px",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-sans)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Smartphone
          size={48}
          style={{ color: "var(--color-primary)", marginBottom: 12 }}
        />
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          NAINSTALOVAT APLIKACI
        </h1>
        <p style={{ opacity: 0.7, fontSize: 14, marginTop: 8 }}>
          Vinné Taxi jako aplikace na ploše – bez Google Play / App Store
        </p>
      </div>

      {/* QR code card */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)",
          borderRadius: 16,
          padding: 20,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            display: "inline-block",
            marginBottom: 12,
          }}
        >
          <QRCodeSVG value={url} size={200} level="M" />
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Naskenujte QR kód telefonem řidiče
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.55,
            marginTop: 6,
            wordBreak: "break-all",
          }}
        >
          {url}
        </div>
      </div>

      {/* Android instructions */}
      <Section
        icon={<Download size={20} />}
        title="Android (Chrome)"
        steps={[
          "Otevřete odkaz v Chrome",
          "Klepněte na menu ⋮ vpravo nahoře",
          'Vyberte "Přidat na plochu" nebo "Instalovat aplikaci"',
          "Potvrďte – ikona se objeví na ploše",
        ]}
      />

      {/* iOS instructions */}
      <Section
        icon={<Share size={20} />}
        title="iPhone / iPad (Safari)"
        steps={[
          "Otevřete odkaz v Safari (NE v Chrome!)",
          "Klepněte na ikonu Sdílet (čtvereček se šipkou ↑)",
          'Sjeďte dolů a vyberte "Přidat na plochu"',
          'Potvrďte tlačítkem "Přidat"',
        ]}
      />

      <div
        style={{
          marginTop: 24,
          padding: 14,
          background: "color-mix(in oklab, var(--color-primary) 10%, transparent)",
          border: "1px dashed color-mix(in oklab, var(--color-primary) 40%, transparent)",
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <strong>Tip:</strong> Po instalaci aplikace funguje jako nativní – ikona
        na ploše, fullscreen, vlastní splash. Aktualizuje se automaticky.
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          color: "var(--color-primary)",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {icon} {title}
      </div>
      <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14, lineHeight: 1.6 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <Plus
              size={0}
              style={{ display: "none" }}
            />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
