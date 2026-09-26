import type { SceneCollectionId } from "@/lib/3d/scene-registry";
import { profileForCategory } from "@/lib/habits/category-config";
import { getProgressSource, type ProgressSourceDef } from "@/lib/habits/progress-sources";
import type { Habit } from "@/lib/types/habits";

/** Qué colección de figuras usa un hábito (la determina su categoría). Hábitos antiguos sin categoría → "habitos". */
export function habitSceneCollection(habit: Pick<Habit, "categoryId">): SceneCollectionId {
  return profileForCategory(habit.categoryId).sceneCollection;
}

/**
 * Fuente de progreso de un hábito. `sourceId` explícito manda; `null` = el usuario lo dejó SIN vínculo; `undefined`
 * (hábitos anteriores a esta función) = la fuente por defecto de su categoría. Nunca modifica el hábito guardado.
 */
export function habitProgressSource(habit: Pick<Habit, "categoryId" | "sourceId">): ProgressSourceDef | undefined {
  if (habit.sourceId === null) return undefined;
  if (habit.sourceId !== undefined) return getProgressSource(habit.sourceId);
  return getProgressSource(profileForCategory(habit.categoryId).defaultSource);
}

/** ¿El hábito toca hoy? (sin `scheduledDays` = todos los días). */
export function isScheduledOn(habit: Pick<Habit, "scheduledDays">, weekday: number): boolean {
  return !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(weekday);
}
