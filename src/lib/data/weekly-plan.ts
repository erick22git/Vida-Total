import type { WeeklyPlanDay } from "@/lib/types";

export const DEFAULT_WEEKLY_PLAN: WeeklyPlanDay[] = [
  { day: "L", grupoMuscular: "Pecho" },
  { day: "M", grupoMuscular: "Espalda" },
  { day: "X", grupoMuscular: "Piernas" },
  { day: "J", grupoMuscular: "Hombros" },
  { day: "V", grupoMuscular: "Biceps" },
  { day: "S", grupoMuscular: "Gluteos" },
  { day: "D", grupoMuscular: "Descanso" },
];

export const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/** Returns the JS-week-index-adjusted day letter for "today" (Mon=0 ... Sun=6). */
export function todayDayIndex(): number {
  const jsDay = new Date().getDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}
