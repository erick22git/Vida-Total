/**
 * Sugerencia de plan de comidas — combina alimentos YA EXISTENTES en la base de la app (USDA FoodData
 * Central + regional, `food-utils.ts`), nunca inventa un alimento ni una receta de ningún sitio externo.
 * Para cada comida (desayuno/almuerzo/snack1/snack2/cena) arma proteína + carbohidrato (+ verdura y
 * grasa en almuerzo/cena) y ajusta los gramos de cada uno para acercarse a la meta de kcal/macros de esa
 * comida, repartida desde la meta diaria del usuario (`calorieGoal`/`proteinGoal`/`carbsGoal`/`fatGoal`,
 * ya configuradas en Calorías — ver `calcCalorieGoal` / `suggestMacros`).
 *
 * El reparto por comida (25/30/10/10/25 %) es una CONVENCIÓN del proyecto para distribuir el día —
 * similar al patrón más común en guías de alimentación (desayuno y cena algo más grandes que las
 * colaciones, almuerzo el más grande) — no es una norma de ninguna entidad: se documenta como tal, igual
 * que los % de déficit/superávit de `calorie-calc.ts`. No reemplaza a un nutricionista: es una forma de
 * EMPEZAR con alimentos reales y cantidades razonables, basada en lo mismo que ya muestra el contador de
 * calorías (Harvard T.H. Chan "Healthy Eating Plate" y USDA MyPlate: proteína + cereal/tubérculo +
 * verdura + grasa en cada comida principal — ver docs/ciencia-nutricion.md).
 */
import type { Food, MealType } from "@/lib/types";
import { getMealOrder } from "@/lib/gym/meal-time";
import { parsePorcionGramos, scaleNutrition, type ScaledNutrition } from "@/lib/food-utils";

/** % de la meta diaria que se asigna a cada comida. Suma 1. Convención del proyecto (ver cabecera). */
export const MEAL_CALORIE_SPLIT: Record<MealType, number> = {
  desayuno: 0.25,
  almuerzo: 0.3,
  snack1: 0.1,
  snack2: 0.1,
  snack3: 0.1,
  snack4: 0.1,
  cena: 0.25,
};

type Role = "proteina" | "carbo" | "verdura" | "grasa";

interface RoleSpec {
  role: Role;
  categorias: string[];
  gramosMin: number;
  gramosMax: number;
}

/** Qué roles arma cada comida y de qué categorías de `foods.json` puede sacar cada uno. Deja afuera a
 * propósito Snack/Comida rápida/Plato preparado/Postre/Endulzante/Bebida/Suplemento/Condimento/Otros:
 * son para registrar lo que uno ya comió, no para una sugerencia de alimentos base. */
const MEAL_TEMPLATES: Record<MealType, RoleSpec[]> = {
  desayuno: [
    { role: "proteina", categorias: ["Lácteo", "Proteína", "Fruto seco"], gramosMin: 30, gramosMax: 250 },
    { role: "carbo", categorias: ["Cereal", "Fruta"], gramosMin: 30, gramosMax: 200 },
    { role: "grasa", categorias: ["Fruto seco", "Semilla", "Grasa"], gramosMin: 8, gramosMax: 35 },
  ],
  almuerzo: [
    { role: "proteina", categorias: ["Proteína", "Legumbre"], gramosMin: 60, gramosMax: 300 },
    { role: "carbo", categorias: ["Cereal", "Tubérculo", "Legumbre"], gramosMin: 40, gramosMax: 300 },
    { role: "verdura", categorias: ["Verdura"], gramosMin: 80, gramosMax: 200 },
    { role: "grasa", categorias: ["Grasa", "Fruto seco"], gramosMin: 5, gramosMax: 25 },
  ],
  snack1: [
    { role: "proteina", categorias: ["Lácteo", "Fruto seco", "Proteína"], gramosMin: 20, gramosMax: 150 },
    { role: "carbo", categorias: ["Fruta", "Cereal"], gramosMin: 30, gramosMax: 150 },
  ],
  snack2: [
    { role: "proteina", categorias: ["Lácteo", "Fruto seco", "Proteína"], gramosMin: 20, gramosMax: 150 },
    { role: "carbo", categorias: ["Fruta", "Cereal"], gramosMin: 30, gramosMax: 150 },
  ],
  snack3: [
    { role: "proteina", categorias: ["Lácteo", "Fruto seco", "Proteína"], gramosMin: 20, gramosMax: 150 },
    { role: "carbo", categorias: ["Fruta", "Cereal"], gramosMin: 30, gramosMax: 150 },
  ],
  snack4: [
    { role: "proteina", categorias: ["Lácteo", "Fruto seco", "Proteína"], gramosMin: 20, gramosMax: 150 },
    { role: "carbo", categorias: ["Fruta", "Cereal"], gramosMin: 30, gramosMax: 150 },
  ],
  cena: [
    { role: "proteina", categorias: ["Proteína", "Legumbre"], gramosMin: 60, gramosMax: 300 },
    { role: "carbo", categorias: ["Cereal", "Tubérculo", "Legumbre"], gramosMin: 40, gramosMax: 250 },
    { role: "verdura", categorias: ["Verdura"], gramosMin: 80, gramosMax: 200 },
    { role: "grasa", categorias: ["Grasa", "Fruto seco"], gramosMin: 5, gramosMax: 25 },
  ],
};

export interface MealPlanItem {
  food: Food;
  gramos: number;
  nutricion: ScaledNutrition;
  role: Role;
}

export interface MealPlanEntry {
  meal: MealType;
  items: MealPlanItem[];
  totales: { calorias: number; proteina: number; carbos: number; grasas: number };
  metaCalorias: number;
}

export interface MealPlanSuggestion {
  dia: string; // ISO yyyy-MM-dd — para qué día se generó (la variedad depende del día)
  entries: MealPlanEntry[];
  totalesDia: { calorias: number; proteina: number; carbos: number; grasas: number };
  metas: { calorias: number; proteina: number; carbos: number; grasas: number };
  avisos: string[];
}

const round5 = (n: number) => Math.round(n / 5) * 5;

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}

/** Candidatos de una categoría, ordenados por densidad del nutriente que más importa para ese rol
 * (proteína: g de proteína por kcal, de mayor a menor = más "magro"; grasa: más insaturada que
 * saturada cuando el dato está). Determinístico (mismo orden siempre), la variedad día a día viene de
 * rotar el índice elegido dentro del grupo de arriba, no de un orden aleatorio. */
function rankCandidates(foods: Food[], spec: RoleSpec): Food[] {
  const pool = foods.filter(
    (f) => spec.categorias.includes(f.categoria) && f.configurado !== false && f.calorias > 0 && (f.proteina > 0 || f.carbos > 0 || f.grasas > 0),
  );
  const score = (f: Food) => {
    if (spec.role === "proteina") return f.calorias > 0 ? f.proteina / f.calorias : 0;
    if (spec.role === "grasa") {
      const insat = (f.grasasMonoinsaturadas ?? 0) + (f.grasasPoliinsaturadas ?? 0);
      const sat = f.grasasSaturadas ?? 0;
      return sat > 0 ? insat / sat : insat;
    }
    if (spec.role === "verdura") return f.fibra ?? 0;
    return f.carbos > 0 ? f.carbos / Math.max(1, f.calorias) : 0;
  };
  return [...pool].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

/** Elige uno entre los mejores `topN` candidatos, rotando por día + comida + rol para no repetir
 * siempre el mismo alimento — pero SOLO entre los ya rankeados como mejor opción para el rol. */
function pickCandidate(ranked: Food[], seed: number, topN = 6): Food | null {
  if (ranked.length === 0) return null;
  const pool = ranked.slice(0, Math.min(topN, ranked.length));
  return pool[seed % pool.length];
}

function gramsForTarget(food: Food, targetValue: number, field: "proteina" | "carbos" | "grasas" | "calorias", spec: RoleSpec): number {
  const per100 = food[field] ?? 0;
  const base = parsePorcionGramos(food) || 100;
  if (per100 <= 0 || targetValue <= 0) return spec.gramosMin;
  const gramos = (targetValue / per100) * base;
  return Math.min(spec.gramosMax, Math.max(spec.gramosMin, round5(gramos)));
}

const ZERO = { calorias: 0, proteina: 0, carbos: 0, grasas: 0 };
function sumNutrition(items: { calorias: number; proteina: number; carbos: number; grasas: number }[]) {
  return items.reduce(
    (acc, n) => ({ calorias: acc.calorias + n.calorias, proteina: acc.proteina + n.proteina, carbos: acc.carbos + n.carbos, grasas: acc.grasas + n.grasas }),
    { ...ZERO },
  );
}

function buildMeal(meal: MealType, foods: Food[], metaCalorias: number, metaProteina: number, metaCarbos: number, metaGrasas: number, seedBase: number): MealPlanEntry {
  const specs = MEAL_TEMPLATES[meal];
  const items: MealPlanItem[] = [];
  let seed = seedBase;

  for (const spec of specs) {
    const ranked = rankCandidates(foods, spec);
    const food = pickCandidate(ranked, seed);
    seed += 7; // avanza el "sorteo" determinístico para el próximo rol sin repetir el mismo índice
    if (!food) continue;

    const acumulado = sumNutrition(items.map((i) => i.nutricion));
    let gramos: number;
    if (spec.role === "proteina") gramos = gramsForTarget(food, metaProteina, "proteina", spec);
    else if (spec.role === "carbo") gramos = gramsForTarget(food, Math.max(0, metaCarbos - acumulado.carbos), "carbos", spec);
    else if (spec.role === "verdura") gramos = Math.round((spec.gramosMin + spec.gramosMax) / 2 / 5) * 5; // volumen fijo: fibra/micros, no cierra macros
    else gramos = gramsForTarget(food, Math.max(0, metaCalorias - acumulado.calorias), "calorias", spec);

    items.push({ food, gramos, role: spec.role, nutricion: scaleNutrition(food, gramos) });
  }

  return { meal, items, totales: sumNutrition(items.map((i) => i.nutricion)), metaCalorias };
}

/**
 * Arma el día completo. `foods` = `mergeFoods(customFoods)` (base + overrides del usuario), para no
 * sugerir un alimento que el usuario ya marcó distinto. `dia` (ISO) decide la rotación de variedad —
 * pasar un string distinto (p. ej. cada día real) da una combinación distinta dentro de los mismos
 * candidatos "buenos" para cada rol.
 */
export function suggestMealPlan(params: {
  foods: Food[];
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  dia?: string;
  meals?: MealType[];
}): MealPlanSuggestion {
  const dia = params.dia ?? new Date().toISOString().slice(0, 10);
  const meals = params.meals ?? getMealOrder();
  const splitTotal = meals.reduce((a, m) => a + MEAL_CALORIE_SPLIT[m], 0) || 1;
  const seedBase = dayOfYear(new Date(`${dia}T00:00:00`));
  const avisos: string[] = [];

  const entries = meals.map((meal, mi) => {
    const pct = MEAL_CALORIE_SPLIT[meal] / splitTotal;
    const entry = buildMeal(
      meal,
      params.foods,
      params.calorieGoal * pct,
      params.proteinGoal * pct,
      params.carbsGoal * pct,
      params.fatGoal * pct,
      seedBase + mi * 11,
    );
    if (entry.items.length < MEAL_TEMPLATES[meal].length) {
      avisos.push(`${meal}: faltan alimentos de alguna categoría en tu base para completar esta comida del todo.`);
    }
    return entry;
  });

  const totalesDia = sumNutrition(entries.map((e) => e.totales));
  return {
    dia,
    entries,
    totalesDia,
    metas: { calorias: params.calorieGoal, proteina: params.proteinGoal, carbos: params.carbsGoal, grasas: params.fatGoal },
    avisos,
  };
}

const MEAL_LABELS_PLAN: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  snack1: "Colación 1",
  snack2: "Colación 2",
  snack3: "Colación 3",
  snack4: "Colación 4",
  cena: "Cena",
};
const ROLE_LABELS: Record<Role, string> = { proteina: "Proteína", carbo: "Carbohidrato", verdura: "Verdura", grasa: "Grasa" };

/** Texto plano listo para descargar (.txt) — sin dependencias nuevas de PDF/etc. */
export function formatMealPlanAsText(plan: MealPlanSuggestion, objetivoLabel: string): string {
  const lines: string[] = [];
  lines.push(`VIDA TOTAL — Sugerencia de comidas (${plan.dia})`);
  lines.push(`Objetivo: ${objetivoLabel}`);
  lines.push(`Meta diaria: ${Math.round(plan.metas.calorias)} kcal · P ${Math.round(plan.metas.proteina)} g · C ${Math.round(plan.metas.carbos)} g · G ${Math.round(plan.metas.grasas)} g`);
  lines.push("");
  for (const entry of plan.entries) {
    lines.push(`— ${MEAL_LABELS_PLAN[entry.meal]} (≈${Math.round(entry.metaCalorias)} kcal) —`);
    for (const item of entry.items) {
      const n = item.nutricion;
      lines.push(`  ${ROLE_LABELS[item.role]}: ${item.food.nombre}, ${item.gramos} g — ${n.calorias} kcal, P ${n.proteina} g, C ${n.carbos} g, G ${n.grasas} g`);
    }
    lines.push(`  Subtotal: ${Math.round(entry.totales.calorias)} kcal, P ${Math.round(entry.totales.proteina)} g, C ${Math.round(entry.totales.carbos)} g, G ${Math.round(entry.totales.grasas)} g`);
    lines.push("");
  }
  lines.push(`TOTAL DEL DÍA: ${Math.round(plan.totalesDia.calorias)} kcal (meta ${Math.round(plan.metas.calorias)}) · P ${Math.round(plan.totalesDia.proteina)} g · C ${Math.round(plan.totalesDia.carbos)} g · G ${Math.round(plan.totalesDia.grasas)} g`);
  if (plan.avisos.length) {
    lines.push("");
    lines.push("Avisos:");
    for (const a of plan.avisos) lines.push(`- ${a}`);
  }
  lines.push("");
  lines.push("Combinación generada a partir de tu propia base de alimentos (USDA FoodData Central + datos regionales,");
  lines.push("ya usada en tu contador de calorías), repartiendo tu meta diaria en comidas (25/30/10/10/25%, convención");
  lines.push("del proyecto). No es un plan de un nutricionista ni reemplaza uno: las cantidades son una aproximación");
  lines.push("para acercarte a tu meta de calorías y macros, no una prescripción médica.");
  return lines.join("\n");
}
