/**
 * Niveles de un hábito por repeticiones acumuladas (independiente de la
 * racha). Puro y sin dependencias — mismo criterio que el resto del
 * Progress Engine: la UI solo lee el resultado.
 *
 * Cada 10 repeticiones se alcanza un hito (10/20/…/60) y sube un nivel. Al
 * llegar a 60 el hábito queda "dominado" (nivel máximo, Master).
 */
export const LEVEL_STEP = 10;
export const LEVEL_MAX = 6;
export const LEVEL_GOAL = LEVEL_STEP * LEVEL_MAX; // 60

export interface HabitLevel {
  total: number;
  /** 0..6 — cantidad de hitos alcanzados. */
  level: number;
  goal: number;
  /** Próximo hito (10, 20…) o `null` si ya está dominado. */
  nextMilestone: number | null;
  mastered: boolean;
  /** 0..1 hacia la meta de 60. */
  fraction: number;
}

export function computeHabitLevel(total: number): HabitLevel {
  const level = Math.min(Math.floor(total / LEVEL_STEP), LEVEL_MAX);
  const mastered = level >= LEVEL_MAX;
  return {
    total,
    level,
    goal: LEVEL_GOAL,
    nextMilestone: mastered ? null : (level + 1) * LEVEL_STEP,
    mastered,
    fraction: Math.min(total / LEVEL_GOAL, 1),
  };
}

/** Si pasar de `prev` a `next` repeticiones cruza un hito (10..60), devuelve
 * ese hito; si no, `null`. */
export function crossedLevelMilestone(prev: number, next: number): number | null {
  const before = Math.min(Math.floor(prev / LEVEL_STEP), LEVEL_MAX);
  const after = Math.min(Math.floor(next / LEVEL_STEP), LEVEL_MAX);
  return after > before ? after * LEVEL_STEP : null;
}
