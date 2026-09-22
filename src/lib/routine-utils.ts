import type { Habit, HabitRoutine, RoutineStep } from "@/lib/types/habits";

/**
 * Si el paso está vinculado a un hábito, la fuente de verdad es
 * `Habit.completedDates` (nunca se duplica el dato en el paso). Si no, se
 * usa el registro propio del paso.
 */
export function isStepDoneOn(step: RoutineStep, habits: Habit[], dateISO: string): boolean {
  if (step.habitId) {
    const habit = habits.find((h) => h.id === step.habitId);
    return habit?.completedDates.includes(dateISO) ?? false;
  }
  return step.completedDates.includes(dateISO);
}

export function routineProgressOn(routine: HabitRoutine, habits: Habit[], dateISO: string): { done: number; total: number } {
  const total = routine.items.length;
  const done = routine.items.filter((s) => isStepDoneOn(s, habits, dateISO)).length;
  return { done, total };
}

export function sortStepsByHora(items: RoutineStep[]): RoutineStep[] {
  return [...items].sort((a, b) => a.hora.localeCompare(b.hora));
}
