import { format } from "date-fns";
import type { AgendaTask } from "./types";

const NBSP = " ";
export const DAY_MIN = 24 * 60;

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const nowMinutes = (d: Date = new Date()) => d.getHours() * 60 + d.getMinutes();

/** "12:15" (sin am/pm). */
export function clock(min: number): string {
  const m = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h12 = ((Math.floor(m / 60) + 11) % 12) + 1;
  return `${h12}:${String(m % 60).padStart(2, "0")}`;
}

const suffix = (min: number) => (((min % DAY_MIN) + DAY_MIN) % DAY_MIN < 720 ? `a.${NBSP}m.` : `p.${NBSP}m.`);

/** "12:00–12:15 p. m." · "11:15 a. m.–12:15 p. m." */
export function timeRange(startMin: number, durationMin: number): string {
  const end = startMin + durationMin;
  const a = suffix(startMin);
  const b = suffix(end);
  return a === b ? `${clock(startMin)}–${clock(end)}${NBSP}${b}` : `${clock(startMin)}${NBSP}${a}–${clock(end)}${NBSP}${b}`;
}

/** "15 min" · "1 h" · "1 h 30 min". */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Duración corta para los segmentos no seleccionados: "30", "45", "1 h". */
export const durationShort = (min: number) => (min < 60 ? String(min) : durationLabel(min));

/** Etiqueta de la hora en la columna izquierda: "6 a.m." (con superíndice en la UI). */
export function hourParts(hour: number): { n: number; s: string } {
  return { n: ((hour + 11) % 12) + 1, s: hour < 12 ? "a.m." : "p.m." };
}

/** Progreso (0–1) de una tarea con hora según el reloj: pasada = 1, en curso = parcial, futura = 0. */
export function taskProgress(task: Pick<AgendaTask, "date" | "startMin" | "durationMin">, now: Date): number {
  if (!task.date || task.startMin === null) return 0;
  const today = toISODate(now);
  if (task.date < today) return 1;
  if (task.date > today) return 0;
  return Math.min(1, Math.max(0, (nowMinutes(now) - task.startMin) / Math.max(1, task.durationMin)));
}

export function isInProgress(task: AgendaTask, now: Date): boolean {
  const p = taskProgress(task, now);
  return p > 0 && p < 1 && !task.done;
}

/** Minutos que faltan para terminar (solo con la tarea en curso). */
export function minutesLeft(task: AgendaTask, now: Date): number {
  if (task.startMin === null) return task.durationMin;
  return Math.max(0, task.startMin + task.durationMin - nowMinutes(now));
}

/* ------------------------------------------------------------------ */
/* Layout vertical del día (no lineal, como en las capturas):          */
/* los tramos con tareas se expanden y las horas vacías se comprimen. */
/* ------------------------------------------------------------------ */
const GAP = 8;
const MIN_H = 38;
const H_BASE = 14;
const H_PER_MIN = 1.27;
const EMPTY_PER_MIN = 0.317;
const OVERLAP = 12;
const TOP_PAD = 14;

export interface LaidOutTask {
  task: AgendaTask;
  top: number;
  height: number;
  /** Z-index para tareas que se solapan: la más tardía queda encima. */
  z: number;
}

export interface DayLayout {
  items: LaidOutTask[];
  yFor: (min: number) => number;
  height: number;
  firstHour: number;
}

export function taskHeight(durationMin: number): number {
  return Math.max(MIN_H, H_BASE + H_PER_MIN * durationMin);
}

export function layoutDay(tasks: AgendaTask[]): DayLayout {
  const timed = tasks
    .filter((t) => t.startMin !== null && !t.allDay)
    .sort((a, b) => (a.startMin! - b.startMin!) || a.createdAt - b.createdAt);
  const firstHour = Math.min(6, timed.length ? Math.floor(timed[0].startMin! / 60) : 6);
  const dayStart = firstHour * 60;
  const anchors: { t: number; y: number }[] = [{ t: dayStart, y: TOP_PAD }];
  const items: LaidOutTask[] = [];
  let cursorTime = dayStart;
  let cursorY = TOP_PAD;

  timed.forEach((task, i) => {
    const start = task.startMin!;
    const end = start + task.durationMin;
    const h = taskHeight(task.durationMin);
    let top: number;
    if (start >= cursorTime) top = cursorY + (start - cursorTime) * EMPTY_PER_MIN + (i > 0 ? GAP : 0);
    else top = Math.max(items[i - 1] ? items[i - 1].top + 14 : TOP_PAD, cursorY - OVERLAP);
    items.push({ task, top, height: h, z: i + 1 });
    const last = anchors[anchors.length - 1];
    if (start > last.t) anchors.push({ t: start, y: top });
    const lastB = anchors[anchors.length - 1];
    if (end > lastB.t) anchors.push({ t: end, y: top + h });
    cursorY = Math.max(cursorY, top + h);
    cursorTime = Math.max(cursorTime, end);
  });

  const yFor = (min: number): number => {
    if (min <= anchors[0].t) return anchors[0].y + (min - anchors[0].t) * EMPTY_PER_MIN;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1];
      const b = anchors[i];
      if (min <= b.t) return a.y + ((min - a.t) / (b.t - a.t)) * (b.y - a.y);
    }
    const l = anchors[anchors.length - 1];
    return l.y + (min - l.t) * EMPTY_PER_MIN;
  };

  return { items, yFor, height: yFor(DAY_MIN) + 8, firstHour };
}
