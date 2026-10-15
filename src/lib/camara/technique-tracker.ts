/**
 * Fase E del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2). Detecta
 * cuándo varias repeticiones SEGUIDAS no llegaron a la profundidad citada — nunca por un intento
 * aislado (podría ser ruido del tracking en una sola repetición) — para sugerir, ahí sí, marcar la
 * nota "mala técnica" que ya existe en el registro manual (sesión anterior, `set-type-modal.tsx`).
 * Puro: no decide la UI, solo cuenta.
 */
import type { CameraExerciseConfig } from "./exercise-configs";
import type { RepCounterState } from "./rep-counter";

/** Cuántas repeticiones flojas SEGUIDAS hacen falta para sugerir la nota — más de una, para no
 * reaccionar a un intento aislado (criterio propio, no de la literatura). */
export const SHALLOW_REP_STREAK_THRESHOLD = 2;

/**
 * Avanza la racha de repeticiones flojas a partir de la transición de un frame al siguiente del
 * contador de reps (`rep-counter.ts`). Una repetición "floja" es la que vuelve al extremo de
 * arranque del ejercicio SIN haber contado como repetición completa (es decir, nunca llegó al
 * otro extremo) — eso es exactamente lo que `prevState.reps === nextState.reps` en ese borde
 * significa. Una repetición completa reinicia la racha a 0.
 *
 * Solo aplica a ejercicios con `hasFormValidation: true` (hoy, solo sentadilla) — para el resto no
 * hay una fuente citada que respalde decir "esta repetición estuvo mal", así que la racha nunca
 * avanza, nunca se sugiere la nota (mismo criterio que `overlay-segments.ts`).
 */
export function nextShallowRepStreak(
  prevState: RepCounterState,
  nextState: RepCounterState,
  config: CameraExerciseConfig,
  prevStreak: number,
): number {
  if (!config.hasFormValidation) return 0;

  const enteringStart = nextState.phase === config.startExtreme && prevState.phase !== config.startExtreme;
  if (!enteringStart) return prevStreak;

  const completedRep = nextState.reps > prevState.reps;
  return completedRep ? 0 : prevStreak + 1;
}

export function shouldSuggestTechniqueNote(streak: number): boolean {
  return streak >= SHALLOW_REP_STREAK_THRESHOLD;
}
