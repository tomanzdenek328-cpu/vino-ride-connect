/**
 * Sdílený výpočet ceny jízdy (běží na serveru i v prohlížeči).
 *
 * Pravidla:
 *  - Týden (Po–Pá) vs. víkend (So–Ne) = jiné sazby.
 *  - Smluvní jízdné v rámci Mikulova / v rámci Hustopečí = pevná cena.
 *  - Jízda do X km (výchozí 5 km) v rámci jiných měst = pevná cena.
 *  - Jinak nástupní sazba + Kč/km.
 */

export interface TariffFull {
  vehicle_type: string;
  label: string;
  base_fare: number;
  per_km: number;
  capacity: number;
  weekend_base_fare: number;
  weekend_per_km: number;
  short_km_limit: number;
  short_base_fare: number;
  short_per_km: number;
  short_base_fare_weekend: number;
  short_per_km_weekend: number;
  mikulov_flat: number;
  mikulov_flat_weekend: number;
  hustopece_flat: number;
  hustopece_flat_weekend: number;
  hourly_rate?: number;
  included_km?: number;
}

export type FareMode = "auto" | "km" | "short" | "mikulov" | "hustopece" | "hourly";

export const TARIFF_COLUMNS =
  "vehicle_type,label,base_fare,per_km,capacity,weekend_base_fare,weekend_per_km,short_km_limit,short_base_fare,short_per_km,short_base_fare_weekend,short_per_km_weekend,mikulov_flat,mikulov_flat_weekend,hustopece_flat,hustopece_flat_weekend,hourly_rate,included_km";

/** Víkend = pátek od 18:00, sobota nebo neděle (čas v Praze). */
export function isWeekend(when: Date | string | null | undefined = new Date()): boolean {
  const d = when ? new Date(when) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (day === "Sat" || day === "Sun") return true;
  return day === "Fri" && hour >= 18;
}


function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Vrátí smluvní zónu, pokud jsou start i cíl ve stejném městě. */
export function detectZone(pickup?: string | null, destination?: string | null): "mikulov" | "hustopece" | null {
  const a = norm(pickup ?? "");
  const b = norm(destination ?? "");
  if (!a || !b) return null;
  if (a.includes("mikulov") && b.includes("mikulov")) return "mikulov";
  if (a.includes("hustopec") && b.includes("hustopec")) return "hustopece";
  return null;
}

export interface FareResult {
  price: number;
  mode: Exclude<FareMode, "auto">;
  weekend: boolean;
  note: string;
}

const round10 = (n: number) => Math.max(0, Math.round(n / 10) * 10);

export function computeFare(
  t: TariffFull,
  km: number,
  opts: { weekend?: boolean; mode?: FareMode; pickup?: string | null; destination?: string | null; when?: Date | string | null } = {},
): FareResult {
  const weekend = opts.weekend ?? isWeekend(opts.when ?? new Date());

  // Hodinová sazba (VIP limuzína): pevná cena za hodinu s nájezdem do X km.
  const hourly = Number(t.hourly_rate ?? 0);
  const inclKm = Number(t.included_km ?? 0) || 30;
  if (hourly > 0 && (!opts.mode || opts.mode === "auto" || opts.mode === "hourly")) {
    const hours = Math.max(1, Math.ceil((km || 0) / inclKm));
    return {
      price: round10(hourly * hours),
      mode: "hourly",
      weekend,
      note: `${hourly} Kč/hod. (nájezd do ${inclKm} km)`,
    };
  }

  let mode: Exclude<FareMode, "auto">;

  if (!opts.mode || opts.mode === "auto") {
    const zone = detectZone(opts.pickup, opts.destination);
    if (zone) mode = zone;
    else if (km > 0 && km <= (Number(t.short_km_limit) || 5)) mode = "short";
    else mode = "km";
  } else {
    mode = opts.mode;
  }

  const pick = (weekdayVal: number, weekendVal: number) => {
    const v = weekend ? Number(weekendVal) : Number(weekdayVal);
    return v > 0 ? v : Number(weekdayVal);
  };

  if (mode === "mikulov") {
    const p = pick(t.mikulov_flat, t.mikulov_flat_weekend);
    if (p > 0) return { price: round10(p), mode, weekend, note: "Smluvní jízdné Mikulov" };
    mode = "km";
  }
  if (mode === "hustopece") {
    const p = pick(t.hustopece_flat, t.hustopece_flat_weekend);
    if (p > 0) return { price: round10(p), mode, weekend, note: "Smluvní jízdné Hustopeče" };
    mode = "km";
  }
  if (mode === "short") {
    const sBase = pick(t.short_base_fare, t.short_base_fare_weekend);
    const sPerKm = pick(t.short_per_km, t.short_per_km_weekend);
    if (sBase > 0 || sPerKm > 0)
      return {
        price: round10(sBase + sPerKm * km),
        mode,
        weekend,
        note: `Do ${Number(t.short_km_limit) || 5} km: ${sBase} Kč + ${sPerKm} Kč/km`,
      };
    mode = "km";
  }

  const base = pick(t.base_fare, t.weekend_base_fare);
  const perKm = pick(t.per_km, t.weekend_per_km);
  return {
    price: round10(base + perKm * km),
    mode: "km",
    weekend,
    note: `${base} Kč + ${perKm} Kč/km`,
  };
}

export const FARE_MODE_LABELS: Record<FareMode, string> = {
  auto: "AUTOMATICKY",
  km: "KILOMETROVÝ",
  short: "DO 5 KM",
  mikulov: "MIKULOV",
  hustopece: "HUSTOPEČE",
  hourly: "HODINOVÝ",
};
