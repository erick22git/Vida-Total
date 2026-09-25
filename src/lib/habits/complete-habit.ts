import { animationEngine } from "@/lib/animations/animation-engine";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { crossedLevelMilestone } from "@/lib/progress";
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

  const prevTotal = habit.completedDates.length;
  const result = useHabitsStore.getState().toggleHabitToday(habitId);
  animationEngine.emit({
    type: "habit.completed",
    tier: "action",
    entityId: habitId,
    meta: { streak: result?.streak },
  });
  // Hito por repeticiones (10/20/…/60): jerarquía "milestone", el 60 es "epic".
  const crossed = crossedLevelMilestone(prevTotal, prevTotal + 1);
  if (crossed) {
    setTimeout(() => {
      animationEngine.emit(
        crossed >= 60
          ? { type: "habit.levelUp", tier: "epic", entityId: habitId, meta: { count: crossed, level: crossed / 10 } }
          : { type: "habit.milestone", tier: "milestone", entityId: habitId, meta: { count: crossed, level: crossed / 10 } },
      );
    }, 380);
  }
  if (result?.milestoneReached) {
    // Racha de 7/21/66: si además hubo hito de repeticiones, va después para
    // que las dos ceremonias no se pisen.
    setTimeout(() => {
      animationEngine.emit({
        type: "streak.milestone",
        tier: "milestone",
        entityId: habitId,
        meta: { streak: result.streak, milestone: result.milestoneReached ?? undefined },
      });
    }, crossed ? 2600 : 380);
  }
  return result;
}

/** Deshacer la completación de hoy. Sin ceremonia (no es un logro). */
export function undoHabit(habitId: string): void {
  const habit = useHabitsStore.getState().habits.find((h) => h.id === habitId);
  if (!habit || !habit.completedDates.includes(todayISO())) return;
  useHabitsStore.getState().toggleHabitToday(habitId);
}
