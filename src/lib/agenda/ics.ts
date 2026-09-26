import { format } from "date-fns";
import { iconForTitle } from "./icons";
import { NO_REPEAT, type AgendaRepeat } from "./types";

/**
 * Lector de archivos iCalendar (.ics): la vía REAL de importar calendarios y recordatorios desde una web, sin
 * inventar APIs del teléfono. Un .ics se exporta desde Google Calendar, Apple Calendar, Outlook, etc.
 *  - VEVENT → eventos de calendario · VTODO → recordatorios/tareas.
 *  - Soporta fecha o fecha-hora (local o UTC), todo el día, duración, y repeticiones simples (diaria / semanal con BYDAY / UNTIL).
 *    Repeticiones más complejas se importan como una sola ocurrencia.
 */
export interface ParsedItem {
  uid: string;
  title: string;
  /** yyyy-MM-dd, o `null` (recordatorio sin fecha → Bandeja). */
  date: string | null;
  startMin: number | null;
  durationMin: number;
  allDay: boolean;
  notes: string;
  done: boolean;
  repeat: AgendaRepeat;
}

export interface ParsedICS {
  calendarName: string | null;
  events: ParsedItem[];
  reminders: ParsedItem[];
}

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out.filter((l) => l.trim() !== "");
}

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  const i = line.indexOf(":");
  if (i < 0) return null;
  const [name, ...ps] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v] = p.split("=");
    if (k && v) params[k.toUpperCase()] = v;
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

/** "20260925", "20260925T130000", "20260925T130000Z" → fecha/hora locales. */
function parseDate(p: Prop): { date: string; startMin: number | null; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, , z] = m;
  if (hh === undefined || p.params.VALUE === "DATE") return { date: `${y}-${mo}-${d}`, startMin: null, allDay: true };
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm));
    return { date: format(dt, "yyyy-MM-dd"), startMin: dt.getHours() * 60 + dt.getMinutes(), allDay: false };
  }
  return { date: `${y}-${mo}-${d}`, startMin: +hh * 60 + +mm, allDay: false };
}

function parseDuration(v: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(v.trim());
  if (!m) return null;
  return (+(m[1] ?? 0)) * 7 * 1440 + (+(m[2] ?? 0)) * 1440 + (+(m[3] ?? 0)) * 60 + +(m[4] ?? 0);
}

function parseRRule(v: string, startDate: string | null): AgendaRepeat {
  const parts = Object.fromEntries(v.split(";").map((kv) => kv.split("=") as [string, string]));
  const interval = parts.INTERVAL ? +parts.INTERVAL : 1;
  if (interval !== 1) return NO_REPEAT; // intervalos raros: una sola ocurrencia
  const until = parts.UNTIL ? parseDate({ name: "UNTIL", params: {}, value: parts.UNTIL })?.date ?? null : null;
  if (parts.FREQ === "DAILY") return { freq: "daily", days: [], until };
  if (parts.FREQ === "WEEKLY") {
    const days = (parts.BYDAY ?? "")
      .split(",")
      .map((d) => DAY_CODES[d.replace(/[^A-Z]/g, "").slice(-2)])
      .filter((d) => d !== undefined);
    const fallback = startDate ? [new Date(`${startDate}T12:00:00`).getDay()] : [];
    return { freq: "weekly", days: days.length ? days : fallback, until };
  }
  return NO_REPEAT;
}

export function parseICS(text: string): ParsedICS {
  const lines = unfold(text);
  if (!lines.some((l) => l.toUpperCase().startsWith("BEGIN:VCALENDAR"))) throw new Error("El archivo no es un calendario .ics válido.");
  const result: ParsedICS = { calendarName: null, events: [], reminders: [] };
  let cur: { kind: "VEVENT" | "VTODO"; props: Prop[] } | null = null;
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "BEGIN" && (p.value === "VEVENT" || p.value === "VTODO")) {
      cur = { kind: p.value, props: [] };
      continue;
    }
    if (p.name === "END" && cur && p.value === cur.kind) {
      const item = buildItem(cur.kind, cur.props);
      if (item) (cur.kind === "VEVENT" ? result.events : result.reminders).push(item);
      cur = null;
      continue;
    }
    if (cur) cur.props.push(p);
    else if (p.name === "X-WR-CALNAME") result.calendarName = unescape(p.value);
  }
  return result;
}

function buildItem(kind: "VEVENT" | "VTODO", props: Prop[]): ParsedItem | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const title = unescape(get("SUMMARY")?.value ?? "").trim();
  if (!title) return null;
  const start = get("DTSTART") ? parseDate(get("DTSTART")!) : null;
  const due = kind === "VTODO" && get("DUE") ? parseDate(get("DUE")!) : null;
  const when = start ?? due;
  let durationMin = 60;
  if (when && !when.allDay) {
    const end = get("DTEND") ? parseDate(get("DTEND")!) : null;
    const dur = get("DURATION") ? parseDuration(get("DURATION")!.value) : null;
    if (end && end.date === when.date && end.startMin !== null && when.startMin !== null && end.startMin > when.startMin) durationMin = end.startMin - when.startMin;
    else if (end && end.date !== when.date && when.startMin !== null) durationMin = Math.min(1440 - when.startMin, 1440);
    else if (dur) durationMin = Math.max(1, dur);
    else if (kind === "VTODO") durationMin = 15;
  }
  const status = get("STATUS")?.value.toUpperCase();
  return {
    uid: get("UID")?.value.trim() || `${kind}-${title}-${when?.date ?? "sin-fecha"}-${when?.startMin ?? ""}`,
    title,
    date: when?.date ?? null,
    startMin: when?.startMin ?? null,
    durationMin,
    allDay: !!when?.allDay,
    notes: unescape(get("DESCRIPTION")?.value ?? ""),
    done: kind === "VTODO" && (status === "COMPLETED" || !!get("COMPLETED")),
    repeat: get("RRULE") ? parseRRule(get("RRULE")!.value, when?.date ?? null) : NO_REPEAT,
  };
}

export { iconForTitle };
