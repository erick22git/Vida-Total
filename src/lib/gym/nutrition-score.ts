import { format, subDays } from "date-fns";
import type { LoggedFood } from "@/lib/types";
import { groupLoggedFoodsByDay } from "./streaks";

export interface NutritionScoreResult {
  /** 0-100 average score across days with at least one logged entry. */
  score: number;
  /** Number of days in the period that have at least one logged entry. */
  daysLogged: number;
  /** Total days considered in the period. */
  periodDays: number;
}

/**
 * Scores how consistently the user has hit their calorie goal over the last
 * `periodDays` days. Each day with at least one logged entry gets a 0-100
 * score: 100 when the day's total kcal lands within ±10% of the goal,
 * degrading linearly to 0 as the day's total drifts to ±50% away from goal.
 * Days with no entries are excluded from the average (they don't count for
 * or against the user — they just don't contribute a data point).
 */
export function computeNutritionScore(
  loggedFoods: LoggedFood[],
  calorieGoal: number,
  periodDays: number,
): NutritionScoreResult {
  const byDay = groupLoggedFoodsByDay(loggedFoods);
  const today = new Date();

  let sum = 0;
  let daysLogged = 0;

  for (let i = 0; i < periodDays; i++) {
    const date = subDays(today, i);
    const key = format(date, "yyyy-MM-dd");
    const foods = byDay.get(key);
    if (!foods || foods.length === 0) continue;

    const total = foods.reduce((acc, f) => acc + f.calorias, 0);
    const deviation = calorieGoal > 0 ? Math.abs(total - calorieGoal) / calorieGoal : 1;

    let dayScore: number;
    if (deviation <= 0.1) {
      dayScore = 100;
    } else if (deviation >= 0.5) {
      dayScore = 0;
    } else {
      // Linear falloff from 100 at 10% deviation to 0 at 50% deviation.
      dayScore = 100 * (1 - (deviation - 0.1) / 0.4);
    }

    sum += dayScore;
    daysLogged += 1;
  }

  const score = daysLogged > 0 ? Math.round(sum / daysLogged) : 0;
  return { score, daysLogged, periodDays };
}

export function nutritionScoreLabel(score: number, daysLogged: number): string {
  if (daysLogged === 0) return "Empieza a registrar más seguido";
  if (score >= 85) return "Excelente consistencia";
  if (score >= 65) return "Buena consistencia";
  if (score >= 40) return "Puede mejorar";
  return "Empieza a registrar más seguido";
}
