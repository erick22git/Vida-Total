"use client";

import { WeekStrip } from "@/components/shared/week-strip";

/** Franja de Hábitos (referencia: Not Boring Habits). El diseño vive en `WeekStrip`, compartido con
 * Calorías, Kegel, Entrenamiento y Agua. */
export function HabitWeekStrip({
  completedDates,
  todayISO,
  viewIndex = 0,
  viewCount = 3,
}: {
  completedDates: string[];
  todayISO: string;
  viewIndex?: number;
  viewCount?: number;
}) {
  return <WeekStrip doneKeys={completedDates} todayISO={todayISO} viewIndex={viewIndex} viewCount={viewCount} />;
}
