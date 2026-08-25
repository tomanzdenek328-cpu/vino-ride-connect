// Bluetooth komunikace s taxametrem (MPT5 apod.).
// Zatím DIAGNOSTIKA: připojíme se, odposlechneme vše, co taxametr posílá,
// a podle záznamu pak doprogramujeme čtení finální ceny.
//
// Web = no-op (prohlížeč do Bluetooth nesmí), funkční jen v Android APK.
import { isNative } from "@/lib/native";

export type BleDevice = { deviceId: string; name?: string };

export type LogLine = {
  at: string;
  kind: "info" | "error" | "data";
  text: string;
};

async function ble() {
  const mod = await import("@capacitor-community/bluetooth-le");
  return mod.BleClient;
}

export function bluetoothAvailable() {
  return isNative();
}

export function hexOf(v: DataView) {
  const out: string[] = [];
  for (let i = 0; i < v.byteLength; i++) out.push(v.getUint8(i).toString(16).padStart(2, "0").toUpperCase());
  return out.join(" ");
}

export function asciiOf(v: DataView) {
  let s = "";
  for (let i = 0; i < v.byteLength; i++) {
    const b = v.getUint8(i);
    s += b >= 32 && b < 127 ? String.fromCharCode(b) : ".";
  }
  return s;
}

/** Vyhledá Bluetooth zařízení v okolí (BLE). */
export async function scanDevices(
  onFound: (d: BleDevice) => void,
  seconds = 8,
): Promise<void> {
  const BleClient = await ble();
  await BleClient.initialize({ androidNeverForLocation: true });
  const seen = new Set<string>();
  await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
    const id = result.device.deviceId;
    if (seen.has(id)) return;
    seen.add(id);
    onFound({ deviceId: id, name: result.device.name ?? result.localName ?? undefined });
  });
  await new Promise((r) => setTimeout(r, seconds * 1000));
  try {
    await BleClient.stopLEScan();
  } catch {
    /* ignore */
  }
}

/**
 * Připojí se k zařízení a přihlásí se ke VŠEM kanálům, které umí posílat data.
 * Vrací funkci pro odpojení.
 */
export async function connectAndListen(
  deviceId: string,
  log: (line: Omit<LogLine, "at">) => void,
): Promise<() => Promise<void>> {
  const BleClient = await ble();
  await BleClient.initialize({ androidNeverForLocation: true });
  await BleClient.connect(deviceId, () => log({ kind: "error", text: "Zařízení se odpojilo" }));
  log({ kind: "info", text: `Připojeno k ${deviceId}` });

  const services = await BleClient.getServices(deviceId);
  let subscribed = 0;
  for (const svc of services) {
    log({ kind: "info", text: `Služba ${svc.uuid}` });
    for (const ch of svc.characteristics) {
      const props = Object.entries(ch.properties)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",");
      log({ kind: "info", text: `  kanál ${ch.uuid} [${props}]` });
      if (ch.properties.notify || ch.properties.indicate) {
        try {
          await BleClient.startNotifications(deviceId, svc.uuid, ch.uuid, (value) => {
            log({ kind: "data", text: `${ch.uuid.slice(0, 8)} | ${hexOf(value)} | ${asciiOf(value)}` });
          });
          subscribed++;
        } catch (e) {
          log({ kind: "error", text: `  odběr ${ch.uuid} selhal: ${String(e)}` });
        }
      }
    }
  }
  log({
    kind: subscribed ? "info" : "error",
    text: subscribed
      ? `Odposlouchávám ${subscribed} kanálů – projeďte zkušební jízdu.`
      : "Zařízení nemá žádný kanál pro příjem dat (možná používá klasický Bluetooth SPP).",
  });

  return async () => {
    try {
      await BleClient.disconnect(deviceId);
    } catch {
      /* ignore */
    }
  };
}
