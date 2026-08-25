// Bluetooth komunikace s taxametrem (MPT5 apod.).
// Zatím DIAGNOSTIKA: připojíme se, odposlechneme vše, co taxametr posílá,
// a podle záznamu pak doprogramujeme čtení finální ceny.
//
// Web = no-op (prohlížeč do Bluetooth nesmí), funkční jen v Android APK.
import { isNative } from "@/lib/native";
import { Capacitor } from "@capacitor/core";

export type BluetoothMode = "ble" | "serial";
export type BleDevice = {
  deviceId: string;
  name?: string;
  mode: BluetoothMode;
  address?: string;
  source?: "paired" | "scan" | "manual";
};

export type LogLine = {
  at: string;
  kind: "info" | "error" | "data";
  text: string;
};

async function ble() {
  const mod = await import("@capacitor-community/bluetooth-le");
  return mod.BleClient;
}

async function bluetoothSerial() {
  const mod = await import("@e-is/capacitor-bluetooth-serial");
  return mod.BluetoothSerial;
}

export function bluetoothAvailable() {
  return isNative();
}

function nativePluginAvailable(pluginName: "BluetoothLe" | "BluetoothSerial") {
  return isNative() && (Capacitor.isPluginAvailable?.(pluginName) ?? false);
}

function explainMissingPlugin(pluginName: "BluetoothLe" | "BluetoothSerial") {
  return `${pluginName} není v této APK nainstalovaný. Je potřeba sestavit a nainstalovat nové APK; samotné obnovení webové aplikace nestačí.`;
}

export function manualSerialDevice(address: string): BleDevice {
  const clean = address.trim().toUpperCase();
  return {
    deviceId: clean,
    address: clean,
    name: "Ručně zadaný taxametr",
    mode: "serial",
    source: "manual",
  };
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

export function hexOfText(value: string) {
  return Array.from(value)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0").slice(-2).toUpperCase())
    .join(" ");
}

export function asciiOfText(value: string) {
  return Array.from(value)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 10) return "\\n";
      if (code === 13) return "\\r";
      return code >= 32 && code < 127 ? ch : ".";
    })
    .join("");
}

function timeoutError(message: string) {
  return new Error(`${message} Taxametr může být obsazený jinou aplikací, nebo nepovolil SPP spojení.`);
}

async function withTimeout<T>(task: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof window.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(timeoutError(message)), milliseconds);
  });
  task.catch(() => undefined);
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/** Vyhledá Bluetooth zařízení: nejdřív spárovaná v Androidu; když žádná nenajde, pokračuje SPP/BLE skenem. */
export async function scanDevices(
  onFound: (d: BleDevice) => void,
  seconds = 6,
  log?: (line: Omit<LogLine, "at">) => void,
): Promise<void> {
  const seen = new Set<string>();
  const emit = (device: BleDevice) => {
    const key = `${device.mode}:${device.address ?? device.deviceId}`;
    if (seen.has(key)) return;
    seen.add(key);
    onFound(device);
  };

  let BleClient: Awaited<ReturnType<typeof ble>> | null = null;

  if (nativePluginAvailable("BluetoothLe")) {
    try {
      BleClient = await ble();
      await BleClient.initialize({ androidNeverForLocation: true });
      log?.({ kind: "info", text: "Načítám spárovaná Bluetooth zařízení z Androidu…" });
      const bonded = await BleClient.getBondedDevices();
      for (const device of bonded) {
        emit({
          deviceId: device.deviceId,
          address: device.deviceId,
          name: device.name || "Spárované Bluetooth zařízení",
          mode: "serial",
          source: "paired",
        });
      }
      log?.({ kind: "info", text: `Spárovaná zařízení: ${bonded.length}. Pokud je mezi nimi MPT5, klepněte na jeho řádek nebo PŘIPOJIT.` });
      if (bonded.length > 0) {
        log?.({ kind: "info", text: "Hledání zastaveno, aby Bluetooth nebyl obsazený při připojování." });
        return;
      }
    } catch (e) {
      BleClient = null;
      log?.({ kind: "error", text: `Načtení spárovaných zařízení selhalo: ${String(e)}` });
      log?.({ kind: "info", text: "Pokračuji klasickým Bluetooth/SPP hledáním." });
    }
  } else {
    log?.({ kind: "error", text: explainMissingPlugin("BluetoothLe") });
    log?.({ kind: "info", text: "Spárovaná zařízení z Androidu nepůjde načíst, ale zkusím klasické Bluetooth/SPP hledání." });
  }

  if (nativePluginAvailable("BluetoothSerial")) {
    try {
      const Serial = await bluetoothSerial();
      const state = await Serial.isEnabled().catch(() => ({ enabled: false }));
      if (!state.enabled) await Serial.enable();
      log?.({ kind: "info", text: "Hledám viditelná klasická Bluetooth/SPP zařízení…" });
      const result = await Serial.scan();
      for (const device of result.devices ?? []) {
        const address = device.address || device.id;
        if (!address) continue;
        emit({
          deviceId: address,
          address,
          name: device.name || "Klasické Bluetooth zařízení",
          mode: "serial",
          source: "scan",
        });
      }
      log?.({ kind: "info", text: `SPP hledání dokončeno: ${result.devices?.length ?? 0} zařízení.` });
    } catch (e) {
      log?.({ kind: "error", text: `SPP hledání selhalo: ${String(e)}` });
    }
  } else {
    log?.({ kind: "error", text: explainMissingPlugin("BluetoothSerial") });
  }

  if (BleClient) {
    try {
      const locationEnabled = await BleClient.isLocationEnabled().catch(() => true);
      if (!locationEnabled) {
        log?.({ kind: "error", text: "Android má vypnuté služby polohy. U některých telefonů bez toho Bluetooth sken nic nenajde." });
      }
      log?.({ kind: "info", text: "Hledám BLE zařízení…" });
      await BleClient.requestLEScan({ allowDuplicates: false, allowExtendedAdvertising: true, scanMode: 2 }, (result) => {
        const id = result.device.deviceId;
        emit({ deviceId: id, name: result.device.name ?? result.localName ?? "BLE zařízení", mode: "ble", source: "scan" });
      });
      await new Promise((r) => setTimeout(r, seconds * 1000));
    } catch (e) {
      log?.({ kind: "error", text: `BLE hledání selhalo: ${String(e)}` });
    } finally {
      try {
        await BleClient.stopLEScan();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Připojí se k zařízení a přihlásí se ke VŠEM kanálům, které umí posílat data.
 * Vrací funkci pro odpojení.
 */
export async function connectAndListen(
  device: BleDevice | string,
  log: (line: Omit<LogLine, "at">) => void,
): Promise<() => Promise<void>> {
  if (typeof device !== "string" && device.mode === "serial") {
    return connectSerialAndListen(device, log);
  }
  if (!nativePluginAvailable("BluetoothLe")) {
    throw new Error(explainMissingPlugin("BluetoothLe"));
  }
  const deviceId = typeof device === "string" ? device : device.deviceId;
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

async function connectSerialAndListen(
  device: BleDevice,
  log: (line: Omit<LogLine, "at">) => void,
): Promise<() => Promise<void>> {
  const address = device.address ?? device.deviceId;
  if (!nativePluginAvailable("BluetoothSerial")) {
    throw new Error(explainMissingPlugin("BluetoothSerial"));
  }
  const Serial = await bluetoothSerial();
  const state = await Serial.isEnabled().catch(() => ({ enabled: false }));
  if (!state.enabled) await Serial.enable();

  try {
    await Serial.disconnect({ address });
  } catch {
    /* ignore previous state */
  }

  log({ kind: "info", text: `Připojuji k ${device.name ?? address} (${address})…` });

  try {
    log({ kind: "info", text: "Zkouším nešifrované SPP spojení – to často používají taxametry MPT5…" });
    await withTimeout(Serial.connectInsecure({ address }), 12000, "Nešifrované připojení se do 12 sekund neotevřelo.");
  } catch (insecureError) {
    log({ kind: "error", text: `Nešifrované SPP nevyšlo: ${String(insecureError)}` });
    try {
      await Serial.disconnect({ address });
    } catch {
      /* ignore failed cleanup */
    }
    log({ kind: "info", text: "Zkouším běžné zabezpečené SPP spojení…" });
    await withTimeout(Serial.connect({ address }), 12000, "Běžné připojení se do 12 sekund neotevřelo.");
  }

  log({ kind: "info", text: `Připojeno přes klasický Bluetooth/SPP k ${device.name ?? address}` });
  log({ kind: "info", text: "Odposlouchávám data – ukončete zkušební jízdu na taxametru a pošlete záznam." });

  let reading = false;
  const poll = window.setInterval(async () => {
    if (reading) return;
    reading = true;
    try {
      const result = await Serial.read({ address });
      const value = result.value ?? "";
      if (value.length > 0) {
        log({ kind: "data", text: `SPP | ${hexOfText(value)} | ${asciiOfText(value)}` });
      }
    } catch (e) {
      log({ kind: "error", text: `Čtení SPP selhalo: ${String(e)}` });
    } finally {
      reading = false;
    }
  }, 450);

  return async () => {
    window.clearInterval(poll);
    try {
      await Serial.disconnect({ address });
    } catch {
      /* ignore */
    }
  };
}
