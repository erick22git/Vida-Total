import type { ProgressEventType } from "@/lib/progress/types";

/**
 * Fuentes de progreso: de dónde puede venir "ya cumpliste esto" para un hábito.
 *
 * Una fuente pertenece a un módulo (hoy Gym) y se dispara con un evento del bus de progreso
 * (`src/lib/progress/event-bus.ts`). Hábitos NO conoce la lógica del módulo (calorías, agua, entrenamiento):
 * solo sabe "la fuente X avisó que se cumplió" y entonces pide al usuario confirmar el check. Sumar una fuente
 * nueva (sueño, kegel, meditación…) es agregar una entrada aquí + emitir su evento desde su módulo.
 */
export type ProgressSourceId = "gym.water" | "gym.calories" | "gym.workout";

export interface ProgressSourceDef {
  id: ProgressSourceId;
  module: "gym";
  label: string;
  /** Evento del bus que indica que el objetivo de esta fuente se cumplió. */
  eventType: ProgressEventType;
  /** Texto corto que acompaña al check guiado. */
  prompt: string;
}

export const PROGRESS_SOURCES: ProgressSourceDef[] = [
  { id: "gym.water", module: "gym", label: "Gym · Agua", eventType: "water.goal_reached", prompt: "Ya cumpliste tu meta de agua. Confirma tu hábito." },
  { id: "gym.calories", module: "gym", label: "Gym · Calorías", eventType: "calories.goal_reached", prompt: "Ya llegaste a tu objetivo de calorías. Confirma tu hábito." },
  { id: "gym.workout", module: "gym", label: "Gym · Entrenamiento", eventType: "workout.completed", prompt: "Terminaste tu entrenamiento. Confirma tu hábito." },
];

export function getProgressSource(id: string | null | undefined): ProgressSourceDef | undefined {
  return id ? PROGRESS_SOURCES.find((s) => s.id === id) : undefined;
}

export function sourceForEvent(type: ProgressEventType): ProgressSourceDef | undefined {
  return PROGRESS_SOURCES.find((s) => s.eventType === type);
}
