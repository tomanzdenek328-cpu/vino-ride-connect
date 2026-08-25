import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bluetooth, Radio, Copy, Share2, Trash2 } from "lucide-react";
import {
  bluetoothAvailable,
  connectAndListen,
  manualSerialDevice,
  scanDevices,
  type BleDevice,
  type LogLine,
} from "@/lib/taximeter";

export const Route = createFileRoute("/_authenticated/taxametr")({
  component: TaximeterDiagnosticsPage,
  head: () => ({
    meta: [
      { title: "Taxametr – diagnostika | Vinné Taxi" },
      { name: "description", content: "Diagnostické připojení k taxametru MPT5 přes Bluetooth pro řidiče Vinné Taxi." },
      { property: "og:title", content: "Taxametr – diagnostika | Vinné Taxi" },
      { property: "og:description", content: "Diagnostické připojení k taxametru MPT5 přes Bluetooth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TaximeterDiagnosticsPage() {
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [manualAddress, setManualAddress] = useState("");
  const disconnectRef = useRef<null | (() => Promise<void>)>(null);
  const native = bluetoothAvailable();

  const log = (line: Omit<LogLine, "at">) =>
    setLines((prev) => [...prev, { ...line, at: new Date().toLocaleTimeString("cs-CZ") }].slice(-500));

  useEffect(() => {
    return () => {
      void disconnectRef.current?.();
    };
  }, []);

  const startScan = async () => {
    setScanning(true);
    setDevices([]);
    log({ kind: "info", text: "Hledám zařízení: nejdřív spárovaná v Androidu, potom klasický Bluetooth/SPP a BLE…" });
    try {
      await scanDevices(
        (d) => setDevices((prev) => (prev.some((p) => p.mode === d.mode && p.deviceId === d.deviceId) ? prev : [...prev, d])),
        6,
        log,
      );
      log({ kind: "info", text: "Hledání dokončeno." });
    } catch (e) {
      log({ kind: "error", text: `Hledání selhalo: ${String(e)}` });
      toast.error("Bluetooth se nepodařilo spustit");
    } finally {
      setScanning(false);
    }
  };

  const connect = async (d: BleDevice) => {
    try {
      await disconnectRef.current?.();
      disconnectRef.current = await connectAndListen(d, log);
      setConnectedId(d.deviceId);
    } catch (e) {
      log({ kind: "error", text: `Připojení selhalo: ${String(e)}` });
      toast.error("Připojení k zařízení selhalo");
    }
  };

  const connectManual = async () => {
    const clean = manualAddress.trim();
    if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(clean)) {
      toast.error("Zadejte Bluetooth adresu ve tvaru 00:11:22:33:44:55");
      return;
    }
    await connect(manualSerialDevice(clean));
  };

  const disconnect = async () => {
    await disconnectRef.current?.();
    disconnectRef.current = null;
    setConnectedId(null);
    log({ kind: "info", text: "Odpojeno." });
  };

  const logText = () => lines.map((l) => `${l.at} [${l.kind}] ${l.text}`).join("\n");

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(logText());
      toast.success("Záznam zkopírován");
    } catch {
      toast.error("Kopírování selhalo");
    }
  };

  const shareLog = async () => {
    const text = logText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Taxametr – záznam", text });
        return;
      } catch {
        /* uživatel zrušil */
      }
    }
    window.location.href = `https://wa.me/?text=${encodeURIComponent(text.slice(0, 3000))}`;
  };

  return (
    <div className="min-h-screen flex flex-col p-3 gap-3">
      <header className="flex items-center gap-2 border-b border-primary/40 pb-2">
        <Link to="/driver" className="border-2 border-primary px-3 py-2 inline-flex items-center gap-2 text-sm hover:bg-primary/10">
          <ArrowLeft className="w-4 h-4" /> ZPĚT
        </Link>
        <div>
          <h1 className="text-lg text-primary glow-text font-display">TAXAMETR – DIAGNOSTIKA</h1>
          <p className="text-[10px] text-muted-foreground">Bluetooth odposlech dat z taxametru MPT5</p>
        </div>
      </header>

      {!native && (
        <div className="border-2 border-yellow-500/60 bg-yellow-500/10 p-3 text-sm">
          Bluetooth funguje pouze v <b>nainstalované Android aplikaci (APK)</b>. Ve webovém prohlížeči
          se k taxametru připojit nelze.
        </div>
      )}

      {native && (
        <div className="border-2 border-amber-warn/70 bg-amber-warn/10 p-3 text-xs text-amber-warn leading-relaxed">
          Když je taxametr už připojený v Androidu, měl by se nově ukázat jako spárované zařízení.
          Před připojením v této aplikaci vypněte Taxi Panel 2, aby nedržel Bluetooth port obsazený.
        </div>
      )}

      {native && lines.some((line) => line.text.includes("není v této APK nainstalovaný")) && (
        <div className="border-2 border-red-500/70 bg-red-500/10 p-3 text-xs text-red-300 leading-relaxed">
          Tato nainstalovaná APK ještě neobsahuje Bluetooth diagnostický modul. Po této úpravě je potřeba vygenerovat a nainstalovat nové APK.
        </div>
      )}

      <div className="border-2 border-primary/40 p-3 text-xs text-muted-foreground leading-relaxed">
        <b className="text-primary">Postup:</b> 1) V Android nastavení spárujte taxametr, pokud ještě spárovaný není.
        2) V Taxi Panel 2 se od taxametru odpojte (nesmí být obsazený). 3) Dejte <b>HLEDAT ZAŘÍZENÍ</b> a vyberte MPT5 ze spárovaných zařízení.
        4) Projeďte krátkou zkušební jízdu a na konci ji na taxametru <b>ukončete</b>.
        5) Pošlete mi záznam přes <b>SDÍLET</b>.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={startScan}
          disabled={scanning}
          className="border-2 border-primary px-4 py-2.5 text-sm font-bold inline-flex items-center gap-2 hover:bg-primary/10 disabled:opacity-50"
        >
          <Bluetooth className="w-4 h-4" /> {scanning ? "HLEDÁM…" : "HLEDAT ZAŘÍZENÍ"}
        </button>
        {connectedId && (
          <button onClick={disconnect} className="border-2 border-red-500 text-red-400 px-4 py-2.5 text-sm font-bold hover:bg-red-500/10">
            ODPOJIT
          </button>
        )}
        <button onClick={copyLog} className="border-2 border-primary/60 px-4 py-2.5 text-sm inline-flex items-center gap-2 hover:bg-primary/10">
          <Copy className="w-4 h-4" /> KOPÍROVAT
        </button>
        <button onClick={shareLog} className="border-2 border-primary/60 px-4 py-2.5 text-sm inline-flex items-center gap-2 hover:bg-primary/10">
          <Share2 className="w-4 h-4" /> SDÍLET
        </button>
        <button onClick={() => setLines([])} className="border-2 border-primary/60 px-4 py-2.5 text-sm inline-flex items-center gap-2 hover:bg-primary/10">
          <Trash2 className="w-4 h-4" /> VYMAZAT
        </button>
      </div>

      {native && (
        <div className="border-2 border-primary/40 p-3 space-y-2">
          <div className="text-xs text-primary font-bold">RUČNÍ PŘIPOJENÍ PODLE BLUETOOTH ADRESY</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="např. 00:11:22:33:44:55"
              className="min-w-0 flex-1 border-2 border-primary/40 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
              inputMode="text"
              autoCapitalize="characters"
            />
            <button onClick={connectManual} className="border-2 border-primary px-4 py-2 text-sm font-bold hover:bg-primary/10">
              PŘIPOJIT
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Adresu najdete v Android nastavení u spárovaného taxametru. Použijte ji, pokud se zařízení nezobrazí v seznamu.
          </p>
        </div>
      )}

      {devices.length > 0 && (
        <div className="border-2 border-primary/40">
          <div className="px-3 py-2 text-xs text-primary border-b border-primary/30">NALEZENÁ ZAŘÍZENÍ</div>
          <ul>
            {devices.map((d) => (
              <li key={d.deviceId} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/10 last:border-b-0">
                <span className="text-sm">
                  <span className="font-bold">{d.name || "(bez názvu)"}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {d.source === "manual" ? "RUČNĚ ZADANÉ" : d.source === "paired" ? "SPÁROVANÉ V ANDROIDU" : d.mode === "serial" ? "KLASICKÝ BLUETOOTH/SPP" : "BLE"} · {d.deviceId}
                  </span>
                </span>
                <button
                  onClick={() => connect(d)}
                  className={`border-2 px-3 py-1.5 text-xs font-bold ${connectedId === d.deviceId ? "border-green-500 text-green-400" : "border-primary hover:bg-primary/10"}`}
                >
                  {connectedId === d.deviceId ? "PŘIPOJENO" : "PŘIPOJIT"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-2 border-primary/40 flex-1 min-h-[200px] flex flex-col">
        <div className="px-3 py-2 text-xs text-primary border-b border-primary/30 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5" /> ZÁZNAM ({lines.length})
        </div>
        <pre className="flex-1 overflow-auto p-2 text-[10px] leading-relaxed whitespace-pre-wrap">
          {lines.length === 0
            ? "Zatím žádná data…"
            : lines
                .map((l) => `${l.at} ${l.kind === "data" ? "»" : l.kind === "error" ? "!" : "·"} ${l.text}`)
                .join("\n")}
        </pre>
      </div>
    </div>
  );
}
