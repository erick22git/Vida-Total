import { format, isSameDay, subDays } from "date-fns";
import type { LoggedFood } from "@/lib/types";

/** Groups logged foods by calendar-day key (yyyy-MM-dd, local time). Entries
 * the user un-checked (activo === false) are excluded — they don't count
 * toward streaks, scores, or "day has entry" indicators. */
export function groupLoggedFoodsByDay(loggedFoods: LoggedFood[]): Map<string, LoggedFood[]> {
  const map = new Map<string, LoggedFood[]>();
  for (const f of loggedFoods) {
    if (f.activo === false) continue;
    const key = format(new Date(f.timestamp), "yyyy-MM-dd");
    const list = map.get(key);
    if (list) list.push(f);
    else map.set(key, [f]);
  }
  return map;
}

function dayKcal(foods: LoggedFood[]): number {
  return foods.reduce((sum, f) => sum + f.calorias, 0);
}

/** A day counts as "perfect" when its total kcal lands within ±10% of the goal. */
function isPerfectDay(foods: LoggedFood[], calorieGoal: number): boolean {
  if (foods.length === 0) return false;
  const total = dayKcal(foods);
  const low = calorieGoal * 0.9;
  const high = calorieGoal * 1.1;
  return total >= low && total <= high;
}

export interface StreakResult {
  current: number;
  best: number;
}

/**
 * Counts consecutive days (walking back from today) where `predicate` holds
 * for that day's logged foods, and separately finds the longest such run
 * anywhere in the history.
 */
function computeStreak(
  loggedFoods: LoggedFood[],
  predicate: (foods: LoggedFood[]) => boolean,
): StreakResult {
  const byDay = groupLoggedFoodsByDay(loggedFoods);
  if (byDay.size === 0) return { current: 0, best: 0 };

  // Current streak: walk back from today while the predicate holds.
  let current = 0;
  let cursor = new Date();
  // If today has no qualifying entry yet, current streak is 0 but we still
  // want yesterday's run to count once today breaks it — start check today,
  // stop at the first day that fails.
  for (;;) {
    const key = format(cursor, "yyyy-MM-dd");
    const foods = byDay.get(key) ?? [];
    if (predicate(foods)) {
      current += 1;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  // Best streak: sort all qualifying days and find the longest consecutive run.
  const qualifyingDays = Array.from(byDay.entries())
    .filter(([, foods]) => predicate(foods))
    .map(([key]) => key)
    .sort();

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

/** Streak of consecutive days with at least one food logged. */
export function computeLoggedDaysStreak(loggedFoods: LoggedFood[]): StreakResult {
  return computeStreak(loggedFoods, (foods) => foods.length > 0);
}

/** Streak of consecutive days where total kcal landed within the goal range. */
export function computePerfectDaysStreak(
  loggedFoods: LoggedFood[],
  calorieGoal: number,
): StreakResult {
  return computeStreak(loggedFoods, (foods) => isPerfectDay(foods, calorieGoal));
}

/** Whether the given date has at least one logged food entry. */
export function dayHasLoggedFood(loggedFoods: LoggedFood[], date: Date): boolean {
  return loggedFoods.some((f) => f.activo !== false && isSameDay(new Date(f.timestamp), date));
}

/** Average kcal logged per day-with-entries within [start, end] inclusive; null if none. */
export function averageKcalInRange(
  loggedFoods: LoggedFood[],
  start: Date,
  end: Date,
): number | null {
  const byDay = groupLoggedFoodsByDay(loggedFoods);
  let totalKcal = 0;
  let daysWithEntries = 0;
  for (const [key, foods] of byDay) {
    const d = new Date(`${key}T00:00:00`);
    if (d >= new Date(format(start, "yyyy-MM-dd") + "T00:00:00") && d <= new Date(format(end, "yyyy-MM-dd") + "T23:59:59")) {
      totalKcal += dayKcal(foods);
      daysWithEntries += 1;
    }
  }
  if (daysWithEntries === 0) return null;
  return Math.round(totalKcal / daysWithEntries);
}
