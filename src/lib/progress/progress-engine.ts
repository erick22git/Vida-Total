import { computeStreak } from "./streak";
import { MILESTONES, type Milestone, type ProgressEvent, type ProgressResult, type StreakInput } from "./types";

/**
 * Progress Engine — capa de negocio pura (sin React, sin Zustand, sin UI).
 * Un store de cualquier módulo llama a `processCompletionEvent` cuando
 * ocurre un evento de progreso y usa el resultado para actualizar su propio
 * estado. El engine nunca dispara animaciones ni sonidos — eso lo decide
 * quien llama, con el resultado que este engine le devuelve (ver
 * `src/lib/animations/`). Así la lógica de negocio (¿se rompió la racha?
 * ¿se cruzó un milestone?) queda en un solo lugar y nunca mezclada con la
 * capa visual.
 */

export function getNextMilestone(streak: number, alreadyUnlocked: number[]): Milestone | null {
  const next = MILESTONES.find((m) => streak >= m && !alreadyUnlocked.includes(m));
  return next ?? null;
}

/**
 * Handlers registrados por tipo de evento de progreso basado en racha
 * (hoy: hábito y rutina). Agregar un módulo nuevo que también funcione por
 * racha de días completados es sumar una entrada acá — nunca tocar
 * `processCompletionEvent`. Los tipos de evento que todavía no tienen
 * handler (`workout.completed`, `water.goal_reached`, etc. — ver
 * `types.ts`) devuelven `null` sin error: están "reservados" hasta que su
 * módulo exista.
 */
type CompletionHandler = (input: StreakInput, alreadyUnlocked: number[], today: Date) => ProgressResult;

const streakBasedHandler: CompletionHandler = (input, alreadyUnlocked, today) => {
  const streak = computeStreak(input, today);
  return { streak, milestoneReached: getNextMilestone(streak, alreadyUnlocked) };
};

const EVENT_HANDLERS: Partial<Record<ProgressEvent["type"], CompletionHandler>> = {
  "habit.completed": streakBasedHandler,
  "routine.completed": streakBasedHandler,
};

/**
 * Procesa un evento de progreso basado en racha de fechas completadas
 * (hábitos y rutinas hoy). `input` son los datos YA actualizados (con la
 * fecha de hoy incluida si corresponde) — este engine no muta nada, solo
 * deriva racha + milestone a partir de lo que le pasan.
 */
export function processCompletionEvent(
  event: Pick<ProgressEvent, "type">,
  input: StreakInput,
  alreadyUnlocked: number[],
  today: Date = new Date(),
): ProgressResult {
  const handler = EVENT_HANDLERS[event.type] ?? streakBasedHandler;
  return handler(input, alreadyUnlocked, today);
}

export { computeStreak } from "./streak";
export * from "./types";
