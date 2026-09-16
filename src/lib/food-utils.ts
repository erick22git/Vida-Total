import foodsData from "@/lib/data/foods.json";
import foodsRegionalData from "@/lib/data/foods-regional.json";
import type { Food, FoodPortion, LoggedFood, TrackableNutrient } from "@/lib/types";

/** `verificado` viene del propio dato en foods.json (ver
 * scripts/correct-nutrition-usda.ts, que lo marca `true` para cada
 * alimento cuyos valores fueron cruzados contra USDA y `false` para los
 * que quedaron pendientes de revisión manual) — ya NO se fuerza a `true`
 * para toda la base. Un alimento sin el campo (dataset viejo, todavía no
 * pasó por el script) se trata como no verificado, no como verificado por
 * default. */
export const BASE_FOODS = ([...(foodsData as Food[]), ...(foodsRegionalData as Food[])]).map((f) => ({
  ...f,
  verificado: f.verificado ?? false,
}));

/** Extracts the gram weight implied by a food's default `porcion` label, e.g. "100 g" -> 100. */
export function parsePorcionGramos(food: Food): number {
  if (food.pesoGramos) return food.pesoGramos;
  const match = food.porcion.match(/\(([\d.]+)\s*g\)/) ?? food.porcion.match(/^([\d.]+)\s*g/);
  if (match) return parseFloat(match[1]);
  const ml = food.porcion.match(/([\d.]+)\s*ml/);
  if (ml) return parseFloat(ml[1]); // approx 1ml = 1g for liquids
  return 100;
}

/** Entries the user has un-checked (activo === false) stay visible in the log
 * but must never count toward any calorie/macro/nutrient total. Every sum
 * over a LoggedFood[] should filter through this first. */
export function activeLoggedFoods(entries: LoggedFood[]): LoggedFood[] {
  return entries.filter((f) => f.activo !== false);
}

export function defaultPortions(food: Food): FoodPortion[] {
  const gramos = parsePorcionGramos(food);
  const list: FoodPortion[] = food.porciones?.length
    ? food.porciones
    : [{ nombre: food.porcion, gramos }];
  // Always offer a "100 g" option if not already present, useful for recalculation.
  if (!list.some((p) => Math.round(p.gramos) === 100)) {
    list.push({ nombre: "100 g", gramos: 100 });
  }
  return list;
}

export interface ScaledNutrition {
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  grasasTrans?: number;
  colesterol?: number;
  sodio?: number;
  fibra?: number;
  azucares?: number;
  azucaresAnadidos?: number;
}

/** Scales a food's nutrition data (defined per its base `porcion`) to an arbitrary gram amount. */
export function scaleNutrition(food: Food, gramos: number): ScaledNutrition {
  const baseGramos = parsePorcionGramos(food) || 100;
  const factor = baseGramos > 0 ? gramos / baseGramos : 0;
  const scale = (v?: number) => (v === undefined ? undefined : Math.round(v * factor * 100) / 100);
  return {
    calorias: Math.round((food.calorias ?? 0) * factor),
    proteina: scale(food.proteina) ?? 0,
    carbos: scale(food.carbos) ?? 0,
    grasas: scale(food.grasas) ?? 0,
    grasasSaturadas: scale(food.grasasSaturadas),
    grasasTrans: scale(food.grasasTrans),
    colesterol: scale(food.colesterol),
    sodio: scale(food.sodio),
    fibra: scale(food.fibra),
    azucares: scale(food.azucares),
    azucaresAnadidos: scale(food.azucaresAnadidos),
  };
}

export function scaleMicronutrients(food: Food, gramos: number) {
  if (!food.micronutrientes) return undefined;
  const baseGramos = parsePorcionGramos(food) || 100;
  const factor = baseGramos > 0 ? gramos / baseGramos : 0;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(food.micronutrientes)) {
    if (typeof value === "number") out[key] = Math.round(value * factor * 100) / 100;
  }
  return out;
}

export const MICRONUTRIENT_LABELS: Record<string, { label: string; unit: string; group: "vitamina" | "mineral" }> = {
  vitaminaA: { label: "Vitamina A", unit: "mcg", group: "vitamina" },
  vitaminaC: { label: "Vitamina C", unit: "mg", group: "vitamina" },
  vitaminaD: { label: "Vitamina D", unit: "mcg", group: "vitamina" },
  vitaminaE: { label: "Vitamina E", unit: "mg", group: "vitamina" },
  vitaminaK: { label: "Vitamina K", unit: "mcg", group: "vitamina" },
  vitaminaB1: { label: "Vitamina B1 (Tiamina)", unit: "mg", group: "vitamina" },
  vitaminaB2: { label: "Vitamina B2 (Riboflavina)", unit: "mg", group: "vitamina" },
  vitaminaB3: { label: "Vitamina B3 (Niacina)", unit: "mg", group: "vitamina" },
  vitaminaB6: { label: "Vitamina B6", unit: "mg", group: "vitamina" },
  vitaminaB12: { label: "Vitamina B12", unit: "mcg", group: "vitamina" },
  folato: { label: "Folato", unit: "mcg", group: "vitamina" },
  calcio: { label: "Calcio", unit: "mg", group: "mineral" },
  hierro: { label: "Hierro", unit: "mg", group: "mineral" },
  magnesio: { label: "Magnesio", unit: "mg", group: "mineral" },
  fosforo: { label: "Fósforo", unit: "mg", group: "mineral" },
  potasio: { label: "Potasio", unit: "mg", group: "mineral" },
  zinc: { label: "Zinc", unit: "mg", group: "mineral" },
  selenio: { label: "Selenio", unit: "mcg", group: "mineral" },
  cobre: { label: "Cobre", unit: "mg", group: "mineral" },
  manganeso: { label: "Manganeso", unit: "mg", group: "mineral" },
};

/**
 * Best-effort totals for the "Otros nutrientes" card: `LoggedFood` entries only
 * store the four headline macros, so this looks up each entry's source `Food`
 * (falling back to skipping it if it can no longer be found — e.g. a deleted
 * custom food) and re-scales its detailed nutrition/micronutrients to the
 * gram amount that was actually logged.
 */
export function nutrientTotalsForLoggedFoods(
  entries: LoggedFood[],
  allFoods: Food[],
): Partial<Record<TrackableNutrient, number>> {
  const totals: Partial<Record<TrackableNutrient, number>> = {};
  const add = (key: TrackableNutrient, v: number | undefined) => {
    if (!v) return;
    totals[key] = (totals[key] ?? 0) + v;
  };
  for (const entry of entries) {
    const food = allFoods.find((f) => f.id === entry.foodId);
    if (!food) continue;
    const gramos = entry.gramos ?? (entry.cantidad ? entry.cantidad * parsePorcionGramos(food) : parsePorcionGramos(food));
    const n = scaleNutrition(food, gramos);
    const micro = scaleMicronutrients(food, gramos);
    add("azucares", n.azucares);
    add("fibra", n.fibra);
    add("sodio", n.sodio);
    add("grasasSaturadas", n.grasasSaturadas);
    add("grasasTrans", n.grasasTrans);
    add("azucaresAnadidos", n.azucaresAnadidos);
    add("carbsNetos", n.carbos !== undefined ? Math.max(0, n.carbos - (n.fibra ?? 0)) : undefined);
    if (micro) {
      for (const [key, value] of Object.entries(micro)) {
        add(key as TrackableNutrient, value);
      }
    }
  }
  return totals;
}

/** Daily reference values (approximate adult RDA) used for the nutrient progress bars. */
export const DAILY_VALUES: Record<string, number> = {
  carbos: 275,
  proteina: 50,
  grasas: 78,
  grasasSaturadas: 20,
  colesterol: 300,
  sodio: 2300,
  fibra: 28,
  azucares: 50,
  azucaresAnadidos: 50,
};
