"use client";

import { WeekStrip } from "@/components/shared/week-strip";

/** Franja de Calorías: la misma de Hábitos (`WeekStrip`), con cada día tocable para cambiar `selectedDate`. */
export function CalorieWeekStrip({
  loggedDayKeys,
  selectedDate,
  onSelectDate,
  todayISO,
  viewIndex = 0,
  viewCount = 3,
}: {
  loggedDayKeys: Set<string>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  todayISO: string;
  viewIndex?: number;
  viewCount?: number;
}) {
  return (
    <WeekStrip
      doneKeys={loggedDayKeys}
      todayISO={todayISO}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      viewIndex={viewIndex}
      viewCount={viewCount}
    />
  );
}
