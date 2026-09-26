/**
 * Progress Engine — tipos.
 *
 * Módulo-agnóstico a propósito: no importa nada de `@/lib/types/habits` ni
 * de ningún store. Cualquier módulo (Hábitos, Rutinas, y más adelante Gym,
 * Agua, Comidas, Sueño...) reporta un `ProgressEvent` y el engine devuelve
 * el resultado derivado (racha, milestone alcanzado). La UI decide qué
 * animación mostrar con ese resultado — el engine nunca sabe de animación.
 */

/**
 * Todos los tipos de evento que este engine podrá procesar, incluidos los
 * de módulos que todavía no existen. Agregar un módulo nuevo más adelante
 * es: 1) sumar su tipo acá, 2) sumar su handler en `EVENT_HANDLERS` de
 * `progress-engine.ts` — nunca reescribir el dispatcher.
 */
export type ProgressEventType =
  | "habit.completed"
  | "routine.completed"
  // Preparados para módulos futuros — sin handler todavía, ver progress-engine.ts.
  | "workout.completed"
  | "water.goal_reached"
  | "meal.logged"
  | "sleep.goal_reached"
  | "calories.goal_reached"
  | "meal.goal_reached"
  | "kegel.completed"
  | "meditation.completed";

export interface ProgressEvent {
  type: ProgressEventType;
  entityId: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

/** Hitos de racha soportados hoy — 66 días es el que usa Not Boring Habits
 * como referencia (constancia real de un hábito), 7/21 dan recompensas
 * tempranas para no perder al usuario antes de llegar ahí. */
export const MILESTONES = [7, 21, 66] as const;
export type Milestone = (typeof MILESTONES)[number];

export interface StreakInput {
  /** Fechas ISO "yyyy-MM-dd" en las que se completó, en cualquier orden. */
  completedDates: string[];
  frequency: "diario" | "semanal";
}

export interface ProgressResult {
  streak: number;
  /** Milestone recién cruzado con esta racha (no estaba en `alreadyUnlocked`
   * y `streak` ya lo alcanza), o `null` si no hay ninguno nuevo. */
  milestoneReached: Milestone | null;
}
