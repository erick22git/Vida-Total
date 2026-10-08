import foodsData from "@/lib/data/foods.json";
import foodsRegionalData from "@/lib/data/foods-regional.json";
import { TRACKABLE_NUTRIENTS } from "@/lib/types";
import type { Food, FoodPortion, LoggedFood, NutritionProfile, TrackableNutrient } from "@/lib/types";

/** `verificado: true` significa específicamente "un admin revisó estos
 * datos y confirmó que están bien" — nunca "un script encontró una fuente".
 * Ningún script de corrección/importación (ver scripts/correct-nutrition-usda.ts)
 * puede setear este campo; el único camino es la acción manual "Marcar como
 * verificada" en la pantalla de configuración de cada alimento. Un alimento
 * sin el campo se trata como no verificado por default. */
export const BASE_FOODS = ([...(foodsData as Food[]), ...(foodsRegionalData as Food[])]).map((f) => ({
  ...f,
  verificado: f.verificado ?? false,
}));

/** Combina los alimentos personalizados del usuario con la base (USDA +
 * regional), dejando que un `customFoods` con el mismo `id` que un alimento
 * base lo tape (override) en vez de aparecer duplicado en las listas — así
 * es como "Configurar/Verificar" un alimento base termina reflejándose en
 * toda la app: la pantalla de edición guarda un override en `customFoods`
 * con el mismo id que el alimento base (ver `upsertFoodOverride` en
 * gymStore.ts), y este merge hace que ese override gane siempre. */
export function mergeFoods(customFoods: Food[]): Food[] {
  const overriddenIds = new Set(customFoods.map((f) => f.id));
  return [...customFoods, ...BASE_FOODS.filter((f) => !overriddenIds.has(f.id))];
}

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
  grasasMonoinsaturadas?: number;
  grasasPoliinsaturadas?: number;
  omega3Ala?: number;
  omega6Linoleico?: number;
  colesterol?: number;
  sodio?: number;
  fibra?: number;
  azucares?: number;
  azucaresAnadidos?: number;
  agua?: number;
  ceniza?: number;
  alcohol?: number;
  epa?: number;
  dha?: number;
  epaDha?: number;
}

function scaleProfile(profile: NutritionProfile, baseGramos: number, gramos: number): ScaledNutrition {
  const factor = baseGramos > 0 ? gramos / baseGramos : 0;
  const scale = (v?: number) => (v === undefined ? undefined : Math.round(v * factor * 100) / 100);
  return {
    calorias: Math.round((profile.calorias ?? 0) * factor),
    proteina: scale(profile.proteina) ?? 0,
    carbos: scale(profile.carbos) ?? 0,
    grasas: scale(profile.grasas) ?? 0,
    grasasSaturadas: scale(profile.grasasSaturadas),
    grasasTrans: scale(profile.grasasTrans),
    grasasMonoinsaturadas: scale(profile.grasasMonoinsaturadas),
    grasasPoliinsaturadas: scale(profile.grasasPoliinsaturadas),
    omega3Ala: scale(profile.omega3Ala),
    omega6Linoleico: scale(profile.omega6Linoleico),
    colesterol: scale(profile.colesterol),
    sodio: scale(profile.sodio),
    fibra: scale(profile.fibra),
    azucares: scale(profile.azucares),
    azucaresAnadidos: scale(profile.azucaresAnadidos),
    agua: scale(profile.agua),
    ceniza: scale(profile.ceniza),
    alcohol: scale(profile.alcohol),
    epa: scale(profile.epa),
    dha: scale(profile.dha),
    epaDha: scale(profile.epaDha),
  };
}

function scaleProfileMicronutrients(profile: NutritionProfile, baseGramos: number, gramos: number) {
  if (!profile.micronutrientes) return undefined;
  const factor = baseGramos > 0 ? gramos / baseGramos : 0;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(profile.micronutrientes)) {
    if (typeof value === "number") out[key] = Math.round(value * factor * 100) / 100;
  }
  return out;
}

/** Scales a food's CRUDO nutrition data (defined per its base `porcion`) to an arbitrary gram amount. */
export function scaleNutrition(food: Food, gramos: number): ScaledNutrition {
  return scaleProfile(food, parsePorcionGramos(food) || 100, gramos);
}

export function scaleMicronutrients(food: Food, gramos: number) {
  return scaleProfileMicronutrients(food, parsePorcionGramos(food) || 100, gramos);
}

/**
 * Igual que `scaleNutrition`/`scaleMicronutrients` pero para el estado COCIDO (`food.cocido`) — un
 * perfil real e independiente, no una fórmula sobre el crudo (antes era `gramos ÷ 0.7`). `null`/
 * `undefined` si el alimento todavía no tiene datos reales de cocido cargados — quien llama debe
 * tratar eso como "no disponible" (deshabilitar el switch), nunca aproximar un valor.
 */
export function scaleCookedNutrition(food: Food, gramos: number): ScaledNutrition | null {
  if (!food.cocido) return null;
  // USDA ya reporta el estado cocido por 100g del alimento COCIDO — la misma base de gramos que
  // usa el crudo (la porción declarada del alimento) sigue sirviendo, sin ningún factor extra.
  return scaleProfile(food.cocido, parsePorcionGramos(food) || 100, gramos);
}

export function scaleCookedMicronutrients(food: Food, gramos: number) {
  if (!food.cocido) return undefined;
  return scaleProfileMicronutrients(food.cocido, parsePorcionGramos(food) || 100, gramos);
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
  vitaminaB5: { label: "Vitamina B5 (Ác. Pantoténico)", unit: "mg", group: "vitamina" },
  vitaminaB6: { label: "Vitamina B6", unit: "mg", group: "vitamina" },
  vitaminaB12: { label: "Vitamina B12", unit: "mcg", group: "vitamina" },
  folato: { label: "Folato", unit: "mcg", group: "vitamina" },
  // Colina no es estrictamente una vitamina (es su propio grupo en nutrición clínica), pero para
  // esta pantalla se agrupa junto a las vitaminas — no hay un tercer grupo en la UI, y es la
  // convención más común en apps de nutrición al consumidor.
  colina: { label: "Colina", unit: "mg", group: "vitamina" },
  calcio: { label: "Calcio", unit: "mg", group: "mineral" },
  hierro: { label: "Hierro", unit: "mg", group: "mineral" },
  magnesio: { label: "Magnesio", unit: "mg", group: "mineral" },
  fosforo: { label: "Fósforo", unit: "mg", group: "mineral" },
  potasio: { label: "Potasio", unit: "mg", group: "mineral" },
  zinc: { label: "Zinc", unit: "mg", group: "mineral" },
  selenio: { label: "Selenio", unit: "mcg", group: "mineral" },
  cobre: { label: "Cobre", unit: "mg", group: "mineral" },
  manganeso: { label: "Manganeso", unit: "mg", group: "mineral" },
  biotina: { label: "Biotina (B7)", unit: "mcg", group: "vitamina" },
  yodo: { label: "Yodo", unit: "mcg", group: "mineral" },
  cromo: { label: "Cromo", unit: "mcg", group: "mineral" },
  molibdeno: { label: "Molibdeno", unit: "mcg", group: "mineral" },
  fluoruro: { label: "Flúor", unit: "mcg", group: "mineral" },
  cloruro: { label: "Cloruro", unit: "mg", group: "mineral" },
};

/** Nutrientes que se suman al día además de los macros de cabecera (los macros viven en `LoggedFood`). */
export const DAY_NUTRIENT_KEYS = [
  ...TRACKABLE_NUTRIENTS,
  "colina",
  "colesterol",
  "grasasMonoinsaturadas",
  "grasasPoliinsaturadas",
  "omega3Ala",
  "omega6Linoleico",
  "agua",
  "epa",
  "dha",
  "epaDha",
  "biotina",
  "yodo",
  "cromo",
  "molibdeno",
  "fluoruro",
  "cloruro",
] as const;
export type DayNutrientKey = (typeof DAY_NUTRIENT_KEYS)[number];

/** Cuántos de los alimentos activos del día traen dato de un nutriente. `con < de` = datos incompletos. */
export interface NutrientCoverage {
  con: number;
  de: number;
}

export interface DayNutrientReport {
  /** Suma solo de lo que tiene dato. Un nutriente sin ningún dato no aparece (nunca se muestra como 0). */
  totals: Partial<Record<DayNutrientKey, number>>;
  coverage: Record<DayNutrientKey, NutrientCoverage>;
  /** Alimentos activos del día. */
  entries: number;
}

type MicroMap = Record<string, number> | undefined;

/** EPA + DHA (mg): el total escrito, o epa + dha cuando están los dos; si falta alguno, sin dato (no se suma a medias). */
export function epaDhaOf(n: { epa?: number; dha?: number; epaDha?: number }): number | undefined {
  if (n.epaDha !== undefined) return n.epaDha;
  return n.epa !== undefined && n.dha !== undefined ? Math.round((n.epa + n.dha) * 100) / 100 : undefined;
}

function readDayValue(key: DayNutrientKey, n: ScaledNutrition, micro: MicroMap): number | undefined {
  switch (key) {
    case "carbsNetos":
      return n.fibra !== undefined ? Math.max(0, n.carbos - n.fibra) : undefined;
    case "epaDha":
      return epaDhaOf(n);
    case "azucares":
    case "fibra":
    case "sodio":
    case "grasasSaturadas":
    case "grasasTrans":
    case "azucaresAnadidos":
    case "colesterol":
    case "grasasMonoinsaturadas":
    case "grasasPoliinsaturadas":
    case "omega3Ala":
    case "omega6Linoleico":
    case "agua":
    case "alcohol":
    case "epa":
    case "dha":
      return n[key];
    default:
      return micro?.[key];
  }
}

/**
 * Totales del día para el contador, SIN inventar datos: un valor que falta no cuenta como 0 y se informa en
 * `coverage` ("n de m alimentos con dato"). Cada entrada usa el perfil del estado con que se registró (crudo o
 * cocido, si el alimento tiene perfil cocido real). Una entrada sin alimento en el catálogo (escáner IA, manual,
 * alimento borrado) o con un alimento "sin configurar" cuenta como sin dato para todos los nutrientes de detalle.
 */
export function nutrientDayReport(entries: LoggedFood[], allFoods: Food[]): DayNutrientReport {
  const byId = new Map(allFoods.map((f) => [f.id, f]));
  const sums: Partial<Record<DayNutrientKey, number>> = {};
  const coverage = {} as Record<DayNutrientKey, NutrientCoverage>;
  for (const k of DAY_NUTRIENT_KEYS) coverage[k] = { con: 0, de: entries.length };

  for (const entry of entries) {
    const food = byId.get(entry.foodId);
    if (!food || food.configurado === false) continue;
    const gramos = entry.gramos ?? (entry.cantidad ? entry.cantidad * parsePorcionGramos(food) : parsePorcionGramos(food));
    const cooked = entry.cookedState === "cocido" && food.cocido ? scaleCookedNutrition(food, gramos) : null;
    const n = cooked ?? scaleNutrition(food, gramos);
    const micro = (cooked ? scaleCookedMicronutrients(food, gramos) : scaleMicronutrients(food, gramos)) as MicroMap;
    for (const k of DAY_NUTRIENT_KEYS) {
      const v = readDayValue(k, n, micro);
      if (v === undefined || !Number.isFinite(v)) continue;
      sums[k] = (sums[k] ?? 0) + v;
      coverage[k].con++;
    }
  }
  const totals: Partial<Record<DayNutrientKey, number>> = {};
  for (const k of DAY_NUTRIENT_KEYS) if (sums[k] !== undefined) totals[k] = Math.round((sums[k] as number) * 100) / 100;
  return { totals, coverage, entries: entries.length };
}

/** Compatibilidad: solo los totales de los nutrientes que el contador puede seguir. */
export function nutrientTotalsForLoggedFoods(entries: LoggedFood[], allFoods: Food[]): Partial<Record<TrackableNutrient, number>> {
  return nutrientDayReport(entries, allFoods).totals as Partial<Record<TrackableNutrient, number>>;
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

const NUTRITION_KEYS = [
  "calorias", "proteina", "carbos", "grasas", "grasasSaturadas", "grasasTrans", "grasasMonoinsaturadas", "grasasPoliinsaturadas",
  "omega3Ala", "omega6Linoleico", "colesterol", "sodio", "fibra", "azucares", "azucaresAnadidos", "agua", "ceniza", "alcohol", "epa", "dha", "epaDha",
] as const;

function nutritionSnapshot(p: Partial<NutritionProfile> | undefined | null) {
  const out: Record<string, number | Record<string, number>> = {};
  for (const k of NUTRITION_KEYS) out[k] = Number(p?.[k] ?? 0);
  const micro: Record<string, number> = {};
  for (const [k, v] of Object.entries(p?.micronutrientes ?? {})) if (typeof v === "number" && v !== 0) micro[k] = v;
  out.micronutrientes = Object.fromEntries(Object.entries(micro).sort(([a], [b]) => a.localeCompare(b)));
  return out;
}

/** ¿Cambió algún valor nutricional (crudo o cocido), o la porción base? Faltante y 0 se consideran lo mismo, así que
 * guardar sin tocar nada no cuenta como cambio. Se usa para devolver a "sin verificar" un alimento verificado editado. */
export function nutritionChanged(before: Food, after: Partial<Food>): boolean {
  const next = { ...before, ...after };
  if (JSON.stringify(nutritionSnapshot(before)) !== JSON.stringify(nutritionSnapshot(next))) return true;
  const hadCocido = !!before.cocido;
  const hasCocido = !!next.cocido;
  if (hadCocido !== hasCocido) return true;
  if (hadCocido && hasCocido && JSON.stringify(nutritionSnapshot(before.cocido)) !== JSON.stringify(nutritionSnapshot(next.cocido))) return true;
  return parsePorcionGramos(before) !== parsePorcionGramos(next as Food);
}
