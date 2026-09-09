import { format, isSameDay, subDays } from "date-fns";
import type { WeeklyPlanDay, WorkoutSession } from "@/lib/types";

/** Groups completed workout sessions by calendar-day key (yyyy-MM-dd, local time). */
export function groupSessionsByDay(sessions: WorkoutSession[]): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    if (!s.completado) continue;
    const key = format(new Date(s.date), "yyyy-MM-dd");
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return map;
}

export interface StreakResult {
  current: number;
  best: number;
}

/**
 * Counts consecutive days (walking back from today) with at least one
 * completed workout, and separately finds the longest such run in history.
 */
export function computeWorkoutStreak(sessions: WorkoutSession[]): StreakResult {
  const byDay = groupSessionsByDay(sessions);
  if (byDay.size === 0) return { current: 0, best: 0 };

  let current = 0;
  let cursor = new Date();
  for (;;) {
    const key = format(cursor, "yyyy-MM-dd");
    if (byDay.has(key)) {
      current += 1;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  const qualifyingDays = Array.from(byDay.keys()).sort();
  let best = 0;
  let run = 0;
  let prevDate: Date | null = null;
  for (const key of qualifyingDays) {
    const d = new Date(`${key}T00:00:00`);
    if (prevDate && isSameDay(subDays(d, 1), prevDate)) {
      run += 1;
    } else {
      run = 1;
    }
    prevDate = d;
    if (run > best) best = run;
  }
  best = Math.max(best, current);

  return { current, best };
}

/** Whether the given date has at least one completed workout session. */
export function dayHasWorkout(sessions: WorkoutSession[], date: Date): boolean {
  return sessions.some((s) => s.completado && isSameDay(new Date(s.date), date));
}

/** Monday=0 ... Sunday=6 index for an arbitrary date (not just "today"). */
export function dateDayIndex(date: Date): number {
  const jsDay = date.getDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Whether `date` is a "Descanso" day according to the user's weekly plan. */
export function isPlannedRestDay(weeklyPlan: WeeklyPlanDay[], date: Date): boolean {
  return weeklyPlan[dateDayIndex(date)]?.grupoMuscular === "Descanso";
}

/**
 * Number of rest days "used" so far this week (Monday through today): days
 * the weekly plan marks as "Descanso" that have already passed (or today),
 * regardless of whether a workout was also logged that day.
 */
export function countRestDaysUsedThisWeek(
  weeklyPlan: WeeklyPlanDay[],
  today: Date = new Date(),
): number {
  const todayIdx = dateDayIndex(today);
  let count = 0;
  for (let i = 0; i <= todayIdx; i++) {
    const d = subDays(today, todayIdx - i);
    if (isPlannedRestDay(weeklyPlan, d)) count += 1;
  }
  return count;
}

/** Total rest days "used" across all history covered by `sessions`, plus this week. */
export function countRestDaysUsedTotal(
  weeklyPlan: WeeklyPlanDay[],
  sessions: WorkoutSession[],
  today: Date = new Date(),
): number {
  if (sessions.length === 0) return countRestDaysUsedThisWeek(weeklyPlan, today);
  const earliest = sessions.reduce<Date | null>((min, s) => {
    const d = new Date(s.date);
    return !min || d < min ? d : min;
  }, null);
  if (!earliest) return 0;
  let count = 0;
  let cursor = new Date(earliest);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    if (isPlannedRestDay(weeklyPlan, cursor)) count += 1;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return count;
}
