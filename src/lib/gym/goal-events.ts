import { format, isSameDay } from "date-fns";
import { emitProgressEvent } from "@/lib/progress/event-bus";
import { totalMlForDay } from "@/lib/gym/water-stats";
import { useGymStore, type GymState } from "@/lib/store/gymStore";
import type { LoggedFood } from "@/lib/types";

/**
 * Gym → eventos de progreso. Gym conserva TODA su lógica (agua, calorías, entrenamiento); este módulo solo mira su
 * estado y, cuando el usuario CUMPLE un objetivo, avisa por el bus (`src/lib/progress/event-bus.ts`). No sabe si
 * algún hábito está vinculado: eso lo resuelve Hábitos.
 *
 *  - water.goal_reached     el total de hoy cruza `waterGoalMl` hacia arriba
 *  - calories.goal_reached  las kcal de hoy cruzan `calorieGoal` hacia arriba
 *  - workout.completed      se termina una sesión de entrenamiento
 *
 * Solo cuenta lo que el usuario HACE ahora: una entrada/sesión debe ser nueva y reciente (`FRESH_MS`). Así la
 * hidratación del almacenamiento local o de Supabase (que puede traer un día ya cumplido) nunca dispara nada.
 */
const FRESH_MS = 10_000;

function todayKcal(foods: LoggedFood[], now: Date): number {
  return foods.reduce((sum, f) => (f.activo === false || !isSameDay(new Date(f.timestamp), now) ? sum : sum + f.calorias), 0);
}

export function detectGymGoals(prev: GymState, next: GymState, now: Date = new Date()): void {
  const t = now.getTime();

  // Agua
  if (next.waterEntries !== prev.waterEntries && next.waterGoalMl > 0) {
    const known = new Set(prev.waterEntries.map((e) => e.id));
    const fresh = next.waterEntries.some((e) => !known.has(e.id) && t - e.timestamp < FRESH_MS);
    if (fresh) {
      const before = totalMlForDay(prev.waterEntries, now);
      const after = totalMlForDay(next.waterEntries, now);
      if (before < next.waterGoalMl && after >= next.waterGoalMl) {
        emitProgressEvent("water.goal_reached", `water:${format(now, "yyyy-MM-dd")}`, { value: after, goal: next.waterGoalMl, unit: "ml" });
      }
    }
  }

  // Calorías
  if (next.loggedFoods !== prev.loggedFoods && next.calorieGoal > 0) {
    const known = new Set(prev.loggedFoods.map((f) => f.id));
    const fresh = next.loggedFoods.some((f) => !known.has(f.id) && t - f.timestamp < FRESH_MS);
    if (fresh) {
      const before = todayKcal(prev.loggedFoods, now);
      const after = todayKcal(next.loggedFoods, now);
      if (before < next.calorieGoal && after >= next.calorieGoal) {
        emitProgressEvent("calories.goal_reached", `calories:${format(now, "yyyy-MM-dd")}`, { value: Math.round(after), goal: next.calorieGoal, unit: "kcal" });
      }
    }
  }

  // Entrenamiento: una sesión nueva ya completada y recién terminada
  if (next.sessions !== prev.sessions && next.sessions.length > prev.sessions.length) {
    const known = new Set(prev.sessions.map((s) => s.id));
    const finished = next.sessions.find((s) => !known.has(s.id) && s.completado);
    const at = next.lastWorkoutCompletedDate ? new Date(next.lastWorkoutCompletedDate).getTime() : 0;
    if (finished && t - at < FRESH_MS) {
      emitProgressEvent("workout.completed", finished.id, { durationSeconds: finished.durationSeconds });
    }
  }
}

/** Empieza a vigilar el store de Gym. Devuelve la función para dejar de vigilar. */
export function startGymGoalWatcher(): () => void {
  let prev = useGymStore.getState();
  return useGymStore.subscribe((next) => {
    const before = prev;
    prev = next;
    try {
      detectGymGoals(before, next);
    } catch (err) {
      console.warn("[gym-goal-events] no se pudo evaluar el objetivo:", err);
    }
  });
}
