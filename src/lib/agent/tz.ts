/** Fecha y hora "locales" del usuario en una zona IANA (el servidor corre en UTC). PURO. */

export interface LocalParts {
  /** yyyy-MM-dd */
  date: string;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado (igual que Date#getDay). */
  weekday: number;
  /** minutos desde medianoche */
  minutesOfDay: number;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(ms: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute,
    weekday: WD[get("weekday")] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

/** yyyy-MM-dd de hoy para esa zona. */
export const todayKey = (ms: number, timeZone: string) => localParts(ms, timeZone).date;

/** Suma días a una clave yyyy-MM-dd. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Instante (ms) en que es `hh:mm` del día `key` en la zona `timeZone`. Prueba con el desfase de ese día; sirve para avisos
 * ("tarea mañana 09:00") sin librerías de fechas.
 */
export function zonedTimeToMs(key: string, hhmm: string, timeZone: string): number {
  const [y, mo, d] = key.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = localParts(guess, timeZone);
  const asUtc = Date.UTC(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)) - 1, Number(p.date.slice(8, 10)), p.hour, p.minute);
  return guess - (asUtc - guess);
}
