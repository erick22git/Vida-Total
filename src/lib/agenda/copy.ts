import { addDays, format } from "date-fns";
import { isRecurring } from "./recurrence";
import { sourceOf } from "./sources";
import { normalizeText } from "./icons";
import type { AgendaTask } from "./types";

/** Cuánto hacia adelante se copia: días desde el día de origen. */
export const COPY_SPANS = [
  { days: 7, label: "7 días" },
  { days: 28, label: "4 semanas" },
  { days: 84, label: "12 semanas" },
] as const;

export type NewTask = Omit<AgendaTask, "id" | "createdAt">;

export interface CopyPlan {
  /** Tareas nuevas (sin id) que se crearían. */
  create: NewTask[];
  /** Cuántas se omiten porque ese día ya tiene una igual (mismo título y hora). */
  skipped: number;
}

const sameSlot = (a: Pick<AgendaTask, "title" | "startMin" | "allDay">, b: Pick<AgendaTask, "title" | "startMin" | "allDay">) =>
  normalizeText(a.title) === normalizeText(b.title) && a.startMin === b.startMin && a.allDay === b.allDay;

/**
 * Plan de copia (función pura, no toca el store): de `sourceDate` copia las tareas elegidas a los días de la semana
 * marcados, dentro de los próximos `spanDays`. Nunca borra ni pisa nada: si el día destino ya tiene la misma tarea
 * (mismo título y hora) se omite. Las tareas que se repiten no se copian (ya aparecen solas). Las copias nacen sin hacer.
 */
export function planCopy(all: AgendaTask[], sourceDate: string, taskIds: string[], weekdays: number[], spanDays: number): CopyPlan {
  const picked = all.filter((t) => t.date === sourceDate && taskIds.includes(t.id) && !isRecurring(t) && sourceOf(t) === "local");
  const src = new Date(`${sourceDate}T12:00:00`);
  const create: NewTask[] = [];
  let skipped = 0;
  for (let i = 1; i <= spanDays; i++) {
    const d = addDays(src, i);
    if (!weekdays.includes(d.getDay())) continue;
    const iso = format(d, "yyyy-MM-dd");
    const there = all.filter((t) => t.date === iso && !isRecurring(t));
    for (const t of picked) {
      if (there.some((x) => sameSlot(x, t)) || create.some((x) => x.date === iso && sameSlot(x, t))) {
        skipped++;
        continue;
      }
      create.push({
        title: t.title,
        icon: t.icon,
        color: t.color,
        date: iso,
        startMin: t.startMin,
        durationMin: t.durationMin,
        allDay: t.allDay,
        done: false,
        notes: t.notes,
        subtasks: t.subtasks.map((s, k) => ({ id: `s-${i}-${k}-${Math.random().toString(36).slice(2, 7)}`, title: s.title, done: false })),
        alerts: t.alerts?.map((a) => ({ ...a })),
      });
    }
  }
  return { create, skipped };
}
