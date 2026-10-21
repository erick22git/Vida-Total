import type { WeeklyPlanDay } from "@/lib/types";

export const DEFAULT_WEEKLY_PLAN: WeeklyPlanDay[] = [
  { day: "L", grupoMuscular: "Pecho" },
  { day: "M", grupoMuscular: "Espalda" },
  { day: "X", grupoMuscular: "Cuadriceps" },
  { day: "J", grupoMuscular: "Hombros" },
  { day: "V", grupoMuscular: "Biceps" },
  { day: "S", grupoMuscular: "Gluteos" },
  { day: "D", grupoMuscular: "Descanso" },
];

/** Semana sin nada planificado: es lo que tiene una cuenta nueva hasta que elige o arma su rutina. */
export const EMPTY_WEEKLY_PLAN: WeeklyPlanDay[] = [
  { day: "L", grupoMuscular: "Descanso" },
  { day: "M", grupoMuscular: "Descanso" },
  { day: "X", grupoMuscular: "Descanso" },
  { day: "J", grupoMuscular: "Descanso" },
  { day: "V", grupoMuscular: "Descanso" },
  { day: "S", grupoMuscular: "Descanso" },
  { day: "D", grupoMuscular: "Descanso" },
];

export const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/** Returns the JS-week-index-adjusted day letter for "today" (Mon=0 ... Sun=6). */
export function todayDayIndex(): number {
  const jsDay = new Date().getDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}
