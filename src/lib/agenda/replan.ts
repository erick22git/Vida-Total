import { addDays, format } from "date-fns";
import { isRecurring, occurrencesOn } from "./recurrence";
import { sourceOf } from "./sources";
import { nowMinutes, toISODate } from "./time";
import type { AgendaTask } from "./types";

/** Cuántos días hacia atrás revisa Replan. */
export const REPLAN_WINDOW_DAYS = 30;

export interface PendingItem {
  /** Estable por serie + día: cada ocurrencia es su propio pendiente. */
  key: string;
  /** La tarea tal como está guardada (la serie completa si se repite). */
  task: AgendaTask;
  /** El día concreto que quedó sin hacer. */
  date: string;
  recurring: boolean;
}

/**
 * Tareas que quedaron sin completar en el pasado (o más temprano hoy). Lógica pura.
 * - Cada ocurrencia de una tarea que se repite es un pendiente aparte (`date`); nunca representa a la serie.
 * - Los eventos de calendario no son "pendientes" (son de solo lectura y no se replanifican).
 */
export function pendingItems(all: AgendaTask[], now: Date = new Date(), scopeDate: string | null = null): PendingItem[] {
  const today = toISODate(now);
  const nowMin = nowMinutes(now);
  const out: PendingItem[] = [];
  for (let i = REPLAN_WINDOW_DAYS; i >= 0; i--) {
    const date = format(addDays(now, -i), "yyyy-MM-dd");
    if (scopeDate && date !== scopeDate) continue;
    for (const occ of occurrencesOn(all, date)) {
      if (occ.done || sourceOf(occ) === "calendar") continue;
      const past = date < today || (date === today && !occ.allDay && occ.startMin !== null && occ.startMin + occ.durationMin <= nowMin);
      if (!past) continue;
      const task = all.find((t) => t.id === occ.id)!;
      out.push({ key: `${task.id}@${date}`, task, date, recurring: isRecurring(task) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.task.startMin ?? 0) - (b.task.startMin ?? 0));
}

export type ReplanAction = "complete" | "delete" | "reschedule" | "inbox";
