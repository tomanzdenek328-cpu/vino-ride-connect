import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Smartphone, Share, Download, Apple, CheckCircle2 } from "lucide-react";

// Odkaz na nejnovější APK z GitHub Releases.
// Po vytvoření prvního tagu (git tag v1.0.0 && git push origin v1.0.0)
// se tady objeví .apk. Do té doby tlačítko zobrazí návod.
const APK_URL =
  "https://github.com/lovable-app/vinne-taxi/releases/latest/download/vinne-taxi.apk";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Nainstalovat Vinné Taxi" },
      {
        name: "description",
        content:
          "Stáhněte si aplikaci Vinné Taxi – nativní APK pro Android, PWA pro iPhone.",
      },
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
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
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
          STÁHNOUT APLIKACI
        </h1>
        <p style={{ opacity: 0.7, fontSize: 14, marginTop: 8 }}>
          Vyberte podle telefonu – Android i iPhone fungují
        </p>
      </div>

      {/* QR kód – sdílet odkaz */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border:
            "1px solid color-mix(in oklab, var(--color-primary) 25%, transparent)",
          borderRadius: 16,
          padding: 18,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 14,
            borderRadius: 12,
            display: "inline-block",
            marginBottom: 10,
          }}
        >
          <QRCodeSVG value={url} size={170} level="M" />
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Naskenujte QR kód telefonem řidiče
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.55,
            marginTop: 4,
            wordBreak: "break-all",
          }}
        >
          {url}/install
        </div>
      </div>

      {/* ANDROID – nativní APK */}
      <Card accent>
        <CardHeader
          icon={<Download size={22} />}
          title="Android – plná aplikace"
          badge="DOPORUČENO"
        />
        <Feature text="GPS funguje i se zhasnutým displejem" />
        <Feature text="Push notifikace o nových objednávkách" />
        <Feature text="Bez prohlížeče – ikona na ploše jako Bolt/Uber" />

        <a
          href={APK_URL}
          style={{
            display: "block",
            marginTop: 14,
            padding: "14px 18px",
            background: "var(--color-primary)",
            color: "#000",
            borderRadius: 12,
            textAlign: "center",
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          ⬇ Stáhnout APK pro Android
        </a>

        <details style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Návod k instalaci (3 kroky)
          </summary>
          <ol style={{ paddingLeft: 22, marginTop: 8, lineHeight: 1.6 }}>
            <li>Otevřít stažený soubor `vinne-taxi.apk`</li>
            <li>
              Povolit <em>„Instalace z neznámých zdrojů"</em> (Android se sám
              zeptá)
            </li>
            <li>
              Po instalaci povolit polohu <strong>„Vždy"</strong> a notifikace
            </li>
          </ol>
        </details>
      </Card>

      {/* iPhone – PWA */}
      <Card>
        <CardHeader
          icon={<Apple size={22} />}
          title="iPhone – PWA verze"
          badge="WEB"
        />
        <Feature text="Ikona na ploše, fullscreen bez Safari" muted />
        <Feature
          text="GPS jen když je aplikace otevřená (omezení iOS)"
          muted
        />
        <Feature text="Nepotřebuje App Store ani instalaci" muted />

        <div
          style={{
            marginTop: 12,
            padding: 14,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Share size={16} /> Návod (Safari, ne Chrome!)
          </strong>
          <ol style={{ paddingLeft: 22, marginTop: 6, marginBottom: 0 }}>
            <li>
              Otevřít <code>{url}</code> v <strong>Safari</strong>
            </li>
            <li>
              Ikona <strong>Sdílet</strong> (čtvereček se šipkou ↑)
            </li>
            <li>
              Sjet dolů → <strong>„Přidat na plochu"</strong> → Přidat
            </li>
          </ol>
        </div>
      </Card>

      <div
        style={{
          marginTop: 20,
          padding: 14,
          background:
            "color-mix(in oklab, var(--color-primary) 10%, transparent)",
          border:
            "1px dashed color-mix(in oklab, var(--color-primary) 35%, transparent)",
          borderRadius: 12,
          fontSize: 12,
          opacity: 0.85,
          lineHeight: 1.5,
        }}
      >
        <strong>Pozn. pro správce:</strong> APK se generuje automaticky přes
        GitHub Actions (workflow <code>Build Android APK</code>). Detaily
        v souboru <code>MOBILE.md</code>.
      </div>
    </div>
  );
}

function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent
          ? "color-mix(in oklab, var(--color-primary) 8%, transparent)"
          : "rgba(255,255,255,0.03)",
        border: accent
          ? "1px solid color-mix(in oklab, var(--color-primary) 45%, transparent)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span style={{ color: "var(--color-primary)" }}>{icon}</span>
      <strong style={{ fontSize: 16, flex: 1 }}>{title}</strong>
      {badge && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "3px 8px",
            borderRadius: 999,
            background: "var(--color-primary)",
            color: "#000",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Feature({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        marginBottom: 6,
        opacity: muted ? 0.7 : 1,
      }}
    >
      <CheckCircle2
        size={16}
        style={{
          color: muted ? "rgba(255,255,255,0.5)" : "var(--color-primary)",
          flexShrink: 0,
        }}
      />
      <span>{text}</span>
    </div>
  );
}
