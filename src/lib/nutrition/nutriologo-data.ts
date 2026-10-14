/**
 * Glue entre el registro de comida (`LoggedFood[]` + catálogo `Food[]`) y el motor del nutriólogo, que
 * necesita el total de cada micronutriente POR DÍA de la ventana (no un promedio ya hecho) para poder
 * contar "X de Y días fuera de rango". Reutiliza `nutrientDayReport` — el mismo cálculo que ya usa el
 * contador de Calorías — día por día, en vez de reimplementar el escalado de nutrientes por alimento.
 */
import type { LoggedFood, Food } from "@/lib/types";
import { activeLoggedFoods, nutrientDayReport, parsePorcionGramos, scaleMicronutrients } from "@/lib/food-utils";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Un array por nutriente con el total de cada día de la ventana QUE TUVO dato para ese nutriente — un
 * día sin ningún alimento con dato de un nutriente no cuenta como "0 ese día" (se omite, mismo criterio
 * que el contador: nunca inventar un cero donde falta el dato). */
export function dailyMicronutrientTotals(
  loggedFoods: LoggedFood[],
  allFoods: Food[],
  windowDays: number,
  today: Date = new Date(),
): Record<string, number[]> {
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));

  const byDay = new Map<string, LoggedFood[]>();
  for (const f of activeLoggedFoods(loggedFoods)) {
    const d = new Date(f.timestamp);
    if (d < windowStart || d > today) continue;
    const key = dayKey(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(f);
  }

  const perNutrient: Record<string, number[]> = {};
  for (const entries of byDay.values()) {
    const report = nutrientDayReport(entries, allFoods);
    for (const [key, value] of Object.entries(report.totals)) {
      if (value === undefined) continue;
      if (!perNutrient[key]) perNutrient[key] = [];
      perNutrient[key].push(value);
    }
  }
  return perNutrient;
}

export interface FoodNutrientRanking {
  foodId: string;
  nombre: string;
  /** Al tamaño de porción por defecto del alimento (no por 100 g) — lo que el usuario realmente
   * registraría, no un valor normalizado que después no coincide con lo que ve al buscarlo. */
  valorPorPorcion: number;
  unidad: string;
}

/** Los `limit` alimentos de la base (`allFoods`, ya configurados — `configurado !== false`) con más de
 * un micronutriente dado por porción por defecto. Para sugerir "qué alimentos de tu propia base subirían
 * este nutriente" (Fase 1/4) sin inventar ningún valor: solo alimentos que ya tienen el dato cargado. */
export function topFoodsForNutrient(allFoods: Food[], nutrientId: string, limit = 5): FoodNutrientRanking[] {
  return allFoods
    .filter((f) => f.configurado !== false)
    .map((f) => {
      const gramos = parsePorcionGramos(f);
      const micro = scaleMicronutrients(f, gramos) as Record<string, number> | undefined;
      const valor = micro?.[nutrientId];
      return valor !== undefined ? { foodId: f.id, nombre: f.nombre, valorPorPorcion: valor, unidad: "" } : null;
    })
    .filter((x): x is FoodNutrientRanking => x !== null)
    .sort((a, b) => b.valorPorPorcion - a.valorPorPorcion)
    .slice(0, limit);
}
