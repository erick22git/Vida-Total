import type { Habit, HabitRoutine, RoutineStep } from "@/lib/types/habits";

export interface RoutineStepForDay extends RoutineStep {
  routineNombre: string;
}

/**
 * Devuelve los pasos activos para una fecha ISO dada, ordenados por hora.
 * Filtra por diasSemana de la rutina (si existe) y por diasSemana del paso
 * (si existe). Usa noon-local para parsear la fecha sin bugs de zona horaria.
 */
export function stepsForDate(routines: HabitRoutine[], dateISO: string): RoutineStepForDay[] {
  const dow = new Date(`${dateISO}T12:00:00`).getDay(); // 0=dom..6=sáb, hora local
  const result: RoutineStepForDay[] = [];
  for (const r of routines) {
    if (r.diasSemana && !r.diasSemana.includes(dow)) continue;
    for (const step of r.items) {
      if (step.diasSemana && !step.diasSemana.includes(dow)) continue;
      result.push({ ...step, routineNombre: r.nombre });
    }
  }
  return result.sort((a, b) => a.hora.localeCompare(b.hora));
}

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
