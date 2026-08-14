/**
 * Pracovní doba Vinné Taxi.
 *
 * Nepracovní doba: pondělí–pátek 02:00–10:00 (čas Praha).
 * V této době nemáme volné auto pro okamžité jízdy.
 * Objednávky předem (jiný den a alespoň 8 hodin dopředu) se přijímají vždy.
 */

const TZ = "Europe/Prague";

function pragueParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[p["weekday"] as string] ?? 0,
    hour: parseInt(p["hour"] ?? "0", 10) % 24,
    minute: parseInt(p["minute"] ?? "0", 10),
    day: `${p["year"]}-${p["month"]}-${p["day"]}`,
  };
}

/** Je daný okamžik mimo pracovní dobu (po–pá 02:00–10:00, so+ne 05:30–10:00 pražského času)? */
export function isOffHours(date: Date | string = new Date()): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const { weekday, hour, minute } = pragueParts(d);
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isWeekend = weekday === 0 || weekday === 6;
  const timeInMinutes = hour * 60 + minute;
  const weekdayOff = isWeekday && hour >= 2 && hour < 10;
  // víkend 05:30–10:00
  const weekendOff = isWeekend && timeInMinutes >= 5 * 60 + 30 && timeInMinutes < 10 * 60;
  return weekdayOff || weekendOff;
}

/** Objednávka předem: jiný kalendářní den a nejméně 8 hodin dopředu. */
export function isAdvanceBooking(
  scheduled: Date | string | null | undefined,
  from: Date | string = new Date(),
): boolean {
  if (!scheduled) return false;
  const s = typeof scheduled === "string" ? new Date(scheduled) : scheduled;
  const f = typeof from === "string" ? new Date(from) : from;
  if (Number.isNaN(s.getTime())) return false;
  const eightHours = s.getTime() - f.getTime() >= 8 * 60 * 60 * 1000;
  const differentDay = pragueParts(s).day !== pragueParts(f).day;
  return eightHours && differentDay;
}

export const OFF_HOURS_MESSAGE = "Momentálně nemáme volné auto, zkuste to prosím později.";
export const ADVANCE_ACCEPTED_MESSAGE =
  "Jízda byla přijata. V čase vyzvednutí budeme na vámi zvoleném místě vyzvednutí.";
