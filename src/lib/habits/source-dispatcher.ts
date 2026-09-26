import { animationEngine } from "@/lib/animations/animation-engine";
import { habitProgressSource, isScheduledOn } from "@/lib/habits/habit-links";
import { useHabitPromptStore } from "@/lib/habits/habit-prompts";
import { sourceForEvent } from "@/lib/habits/progress-sources";
import { progressEvents } from "@/lib/progress/event-bus";
import type { ProgressEvent } from "@/lib/progress/types";
import { format } from "date-fns";
import { useHabitsStore } from "@/lib/store/habitsStore";

/**
 * Consumidor de Hábitos para los eventos de progreso de otros módulos.
 *
 *   evento del bus → fuente de progreso → hábitos vinculados (y pendientes hoy) → acción pendiente + aviso
 *
 * Es GENÉRICO: no sabe de agua, calorías ni entrenamiento; solo cruza `evento → fuente → hábito` con las tablas de
 * `progress-sources.ts` y `habit-links.ts`. No completa nada: el usuario confirma con el check.
 * Un evento sin fuente conocida, o sin hábito vinculado, no hace nada.
 */
export function dispatchProgressEvent(event: ProgressEvent, now: Date = new Date()): string[] {
  const source = sourceForEvent(event.type);
  if (!source) return [];
  const today = format(now, "yyyy-MM-dd");
  const weekday = now.getDay();
  const { habits } = useHabitsStore.getState();
  const linked = habits.filter(
    (h) => habitProgressSource(h)?.id === source.id && isScheduledOn(h, weekday) && !h.completedDates.includes(today),
  );
  if (linked.length === 0) return [];
  const prompts = useHabitPromptStore.getState();
  prompts.prune(today);
  for (const h of linked) {
    prompts.add({ habitId: h.id, sourceId: source.id, eventType: event.type, date: today, createdAt: event.timestamp });
    animationEngine.emit({ type: "habit.prompted", tier: "action", entityId: h.id, meta: { sourceId: source.id } });
  }
  return linked.map((h) => h.id);
}

/** Empieza a escuchar el bus. `onPrompted` recibe los hábitos con acción pendiente (la UI decide si navegar). */
export function startSourceDispatcher(onPrompted: (habitIds: string[], event: ProgressEvent) => void): () => void {
  return progressEvents.subscribe((event) => {
    const ids = dispatchProgressEvent(event);
    if (ids.length > 0) onPrompted(ids, event);
  });
}
