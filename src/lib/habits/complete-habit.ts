import { animationEngine } from "@/lib/animations/animation-engine";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import type { ProgressResult } from "@/lib/progress/types";

/**
 * Business action: completar un hábito HOY. La UI nunca hace
 * `setCompleted(true)` — llama esto, que pasa por el store → Progress
 * Engine y después avisa al Animation Engine (que decide sonido, háptico y
 * animación; este módulo no sabe cuáles existen).
 */
export function completeHabit(habitId: string): ProgressResult | null {
  const habit = useHabitsStore.getState().habits.find((h) => h.id === habitId);
  if (!habit || habit.completedDates.includes(todayISO())) return null;

  const result = useHabitsStore.getState().toggleHabitToday(habitId);
  animationEngine.emit({
    type: "habit.completed",
    tier: "action",
    entityId: habitId,
    meta: { streak: result?.streak },
  });
  if (result?.milestoneReached) {
    // Pequeño desfase: primero se siente "completaste", luego "es un hito".
    setTimeout(() => {
      animationEngine.emit({
        type: "streak.milestone",
        tier: "milestone",
        entityId: habitId,
        meta: { streak: result.streak, milestone: result.milestoneReached ?? undefined },
      });
    }, 380);
  }
  return result;
}

/** Deshacer la completación de hoy. Sin ceremonia (no es un logro). */
export function undoHabit(habitId: string): void {
  const habit = useHabitsStore.getState().habits.find((h) => h.id === habitId);
  if (!habit || !habit.completedDates.includes(todayISO())) return;
  useHabitsStore.getState().toggleHabitToday(habitId);
}
