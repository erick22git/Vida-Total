/**
 * Glue entre el registro de comida (`LoggedFood[]` + catálogo `Food[]`) y el motor del nutriólogo, que
 * necesita el total de cada micronutriente POR DÍA de la ventana (no un promedio ya hecho) para poder
 * contar "X de Y días fuera de rango". Reutiliza `nutrientDayReport` — el mismo cálculo que ya usa el
 * contador de Calorías — día por día, en vez de reimplementar el escalado de nutrientes por alimento.
 */
import type { LoggedFood, Food } from "@/lib/types";
import { localDayKey } from "@/lib/gym/kegel-dates";
import { activeLoggedFoods, nutrientDayReport, parsePorcionGramos, scaleMicronutrients } from "@/lib/food-utils";

function dayKey(d: Date): string {
  return localDayKey(d);
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
  // Inicio de la ventana a medianoche local: con la hora actual se perdían los registros madrugadores del día más viejo.
  const windowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (windowDays - 1));

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
  /** Gramos de esa porción por defecto (lo que `valorPorPorcion` ya incluye). */
  gramosPorcion: number;
  /** Solo si se pidió cubrir una brecha (`falta`): gramos de este alimento que la cubren y cuántas porciones son. */
  gramosParaCubrir?: number;
  porcionesParaCubrir?: number;
}

/** Más que esto de UN solo alimento en un día no es una cantidad real de comer: se descarta como sugerencia. */
const MAX_GRAMOS_REALES_POR_ALIMENTO = 400;

/** Los `limit` alimentos de la base (`allFoods`, ya configurados — `configurado !== false`) con más de
 * un micronutriente dado por porción por defecto. Para sugerir "qué alimentos de tu propia base subirían
 * este nutriente" (Fase 1/4) sin inventar ningún valor: solo alimentos que ya tienen el dato cargado.
 *
 * Si se pasa `falta` (lo que le falta al día en la unidad del nutriente), cada sugerencia trae los GRAMOS REALES que cubren esa
 * brecha, calculados con la porción del alimento — no con 100 g: nadie come 100 g de chía, y la tabla por 100 g exagera.
 * Los alimentos que necesitarían más de `MAX_GRAMOS_REALES_POR_ALIMENTO` se descartan. */
export function topFoodsForNutrient(allFoods: Food[], nutrientId: string, limit = 5, falta?: number): FoodNutrientRanking[] {
  const ranked = allFoods
    .filter((f) => f.configurado !== false)
    .map((f): FoodNutrientRanking | null => {
      const gramos = parsePorcionGramos(f);
      const micro = scaleMicronutrients(f, gramos) as Record<string, number> | undefined;
      const valor = micro?.[nutrientId];
      if (valor === undefined) return null;
      const base: FoodNutrientRanking = { foodId: f.id, nombre: f.nombre, valorPorPorcion: valor, unidad: "", gramosPorcion: gramos };
      if (falta === undefined || falta <= 0) return base;
      if (valor <= 0 || gramos <= 0) return null;
      const gramosParaCubrir = Math.max(1, Math.round((falta / valor) * gramos));
      if (gramosParaCubrir > MAX_GRAMOS_REALES_POR_ALIMENTO) return null;
      return { ...base, gramosParaCubrir, porcionesParaCubrir: Math.round((falta / valor) * 10) / 10 };
    })
    .filter((x): x is FoodNutrientRanking => x !== null);

  // Siempre por lo que aporta UNA porción real (no por gramos: ordenar por "menos gramos" subiría especias de 1 g).
  ranked.sort((a, b) => b.valorPorPorcion - a.valorPorPorcion);
  return ranked.slice(0, limit);
}
