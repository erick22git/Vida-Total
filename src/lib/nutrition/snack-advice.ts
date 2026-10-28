/**
 * ¿Cuántas comidas hacer al día y cada cuánto? Sugerencia de snacks según tu objetivo y tus horarios reales.
 * Módulo PURO. Nunca cambia nada solo: la pantalla ofrece "Agregar".
 *
 * Base (convenciones de práctica; no hay un número mágico):
 *  - Reparto de proteína: ~0,4 g/kg por comida repartido en ≥ 4 comidas da la mejor síntesis muscular
 *    (Schoenfeld & Aragon 2018, J Int Soc Sports Nutr). Con 4 tomas de ~20 g cada 3 h la síntesis fue mayor que con
 *    2 tomas grandes o 8 chicas (Areta et al. 2013, J Physiol), y un reparto parejo supera a concentrarla en la
 *    cena (Mamerow et al. 2014, J Nutr).
 *  - Intervalo: ~3 h entre comidas para quien busca ganar o entrena fuerza; ~4 h para el resto.
 *  - Para perder grasa, la frecuencia de comidas por sí sola no cambia el resultado (Schoenfeld et al. 2015, Br J
 *    Nutr): se sugiere un snack solo si pasas mucho tiempo sin comer o si tus comidas quedan muy grandes.
 *  - Una comida principal de más de ~750 kcal (800 si ganas peso) cuesta de comer y de digerir: partirla con un
 *    snack ayuda a cumplir la meta.
 */
import type { MealType } from "@/lib/types";
import { DEFAULT_MEAL_START_TIMES } from "@/lib/store/preferencesStore";
import { activeMeals, MAX_SNACKS } from "@/lib/gym/meal-time";

export type SnackGoal = "perder" | "mantener" | "ganar";

export interface SnackAdviceInput {
  calorieGoal: number;
  proteinGoal: number;
  pesoKg?: number;
  objetivo?: SnackGoal;
  /** Entrena fuerza con regularidad. */
  entrena: boolean;
  mealTimes: Partial<Record<MealType, string>>;
  snackCount: number;
}

export interface SnackGap {
  from: MealType;
  to: MealType;
  hours: number;
}

export interface SnackAdvice {
  mealsNow: number;
  gaps: SnackGap[];
  longestGapHours: number;
  targetGapHours: number;
  /** Snacks recomendados (0-4) y cuántos faltan o sobran respecto de los actuales. */
  recommendedSnacks: number;
  delta: number;
  /** Hora sugerida para el próximo snack ("HH:mm"), en el hueco más largo. */
  suggestedTime: string | null;
  /** Meta por snack (kcal y proteína). */
  perSnack: { kcal: number; proteinG: number } | null;
  reasons: string[];
  headline: string;
}

const toMin = (hhmm: string | undefined, fb: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "") ?? /^(\d{1,2}):(\d{2})$/.exec(fb)!;
  return Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]);
};
const fmt = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60 / 15) * 15 % 60).padStart(2, "0")}`;

export function adviseSnacks(i: SnackAdviceInput): SnackAdvice {
  const meals = activeMeals(i.snackCount);
  const timed = meals
    .map((meal) => ({ meal, min: toMin(i.mealTimes[meal], DEFAULT_MEAL_START_TIMES[meal]) }))
    .sort((a, b) => a.min - b.min);

  const gaps: SnackGap[] = [];
  for (let k = 1; k < timed.length; k++) gaps.push({ from: timed[k - 1].meal, to: timed[k].meal, hours: Math.round(((timed[k].min - timed[k - 1].min) / 60) * 10) / 10 });
  const longest = gaps.reduce((a, g) => (g.hours > a.hours ? g : a), gaps[0] ?? { from: "desayuno" as MealType, to: "cena" as MealType, hours: 0 });

  const gainOrTrain = i.objetivo === "ganar" || i.entrena;
  const targetGapHours = i.objetivo === "ganar" ? 3 : gainOrTrain ? 3.5 : 4;
  const spanHours = timed.length > 1 ? (timed[timed.length - 1].min - timed[0].min) / 60 : 0;
  const bigMeal = i.objetivo === "ganar" ? 800 : 750;

  const reasons: string[] = [];
  // Por tiempo: cuántas tomas entran en el rango del día con el intervalo objetivo.
  let byTime = Math.max(0, Math.round(spanHours / targetGapHours + 1) - 3);
  if (i.objetivo === "perder" && !i.entrena) {
    // Sin ventaja de más frecuencia para perder grasa: solo si hay un hueco muy largo.
    byTime = longest.hours > 5.5 ? Math.max(byTime, 1) : Math.min(byTime, 1);
  }
  let recommended = Math.min(MAX_SNACKS, byTime);
  if (longest.hours > targetGapHours + 0.9) reasons.push(`Pasas ${longest.hours} h entre ${labelOf(longest.from)} y ${labelOf(longest.to)}; lo ideal es cada ~${targetGapHours} h.`);

  // Por tamaño de comida principal.
  const kcalPerMain = i.calorieGoal > 0 ? i.calorieGoal / (3 + recommended) : 0;
  if (i.calorieGoal > 0 && kcalPerMain > bigMeal && recommended < MAX_SNACKS) {
    recommended = Math.min(MAX_SNACKS, Math.ceil(i.calorieGoal / bigMeal) - 3);
    reasons.push(`Con ${i.calorieGoal} kcal, tus comidas quedarían de más de ${bigMeal} kcal: partirlas con snacks facilita cumplir la meta.`);
  }
  // Por proteína: ~0,4 g/kg por toma.
  if (i.pesoKg && i.proteinGoal > 0 && gainOrTrain) {
    const perMeal = i.proteinGoal / (3 + recommended);
    const target = 0.4 * i.pesoKg;
    if (perMeal > target * 1.35 && recommended < MAX_SNACKS) {
      recommended += 1;
      reasons.push(`Tu meta de ${i.proteinGoal} g de proteína en ${3 + recommended - 1} comidas serían ~${Math.round(i.proteinGoal / (3 + recommended - 1))} g cada una; lo mejor para el músculo es ~${Math.round(target)} g (0,4 g/kg) por toma, repartida.`);
    }
  }
  recommended = Math.max(0, Math.min(MAX_SNACKS, recommended));
  const delta = recommended - i.snackCount;

  let suggestedTime: string | null = null;
  if (delta > 0 && i.snackCount < MAX_SNACKS && gaps.length > 0) {
    const a = timed.find((t) => t.meal === longest.from)!;
    suggestedTime = fmt(a.min + (longest.hours * 60) / 2);
  }

  const perSnack = recommended > 0 && i.calorieGoal > 0 ? { kcal: Math.round((i.calorieGoal * 0.1) / 5) * 5, proteinG: Math.round(Math.max(10, i.pesoKg ? i.pesoKg * 0.25 : 20)) } : null;

  let headline: string;
  if (delta > 0) headline = `Te conviene agregar ${delta === 1 ? "1 snack" : `${delta} snacks`} (${3 + recommended} comidas al día).`;
  else if (delta < 0) headline = `Tus ${3 + i.snackCount} comidas ya son más de lo necesario para tu objetivo; ${3 + recommended} bastan.`;
  else headline = `Tus ${3 + i.snackCount} comidas al día están bien para tu objetivo.`;
  if (delta <= 0 && reasons.length === 0) reasons.push(`Tus comidas están separadas ~${Math.round((spanHours / Math.max(1, timed.length - 1)) * 10) / 10} h en promedio, dentro de lo recomendado (~${targetGapHours} h).`);

  return { mealsNow: 3 + i.snackCount, gaps, longestGapHours: longest.hours, targetGapHours, recommendedSnacks: recommended, delta, suggestedTime, perSnack, reasons, headline };
}

function labelOf(m: MealType): string {
  return m.startsWith("snack") ? `Snack ${m.slice(5)}` : m.charAt(0).toUpperCase() + m.slice(1);
}
