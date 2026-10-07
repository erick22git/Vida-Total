/**
 * "Guardar como receta" desde una comida registrada: arma una receta REAL (ingredientes vinculados a la base,
 * cantidades en gramos y totales) a partir de los alimentos de esa comida. Puro: el menú decide si crea o actualiza.
 * Las recetas nuevas o editadas entran SIEMPRE con `verificado: false` — verificar es una acción manual aparte.
 */
import { defaultPortions, parsePorcionGramos } from "@/lib/food-utils";
import { normalizeText, resolveFoodText, type ResolverIndex } from "@/lib/nutrition/food-resolver";
import type { Food, LoggedFood, MealType, Recipe, RecipeIngredient } from "@/lib/types";

export type NewRecipe = Omit<Recipe, "id" | "createdAt">;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Un alimento registrado → ingrediente de receta (vinculado a la base por id, o por nombre si el id ya no existe). */
export function loggedFoodToIngredient(f: LoggedFood, idx: ResolverIndex): RecipeIngredient {
  let food: Food | undefined = idx.byId.get(f.foodId);
  if (!food) {
    const r = resolveFoodText(f.nombre, idx, { foodsOnly: true, maxCandidates: 1 });
    if (r.tipo === "alimento" && r.chosen && r.chosen.score >= 60) food = r.chosen.food;
  }
  const porcionGramos = food ? (defaultPortions(food)[0]?.gramos ?? parsePorcionGramos(food)) : 100;
  const gramos = f.gramos ?? (f.cantidad ? f.cantidad * porcionGramos : porcionGramos);
  return {
    foodId: food?.id ?? f.foodId,
    nombre: food?.nombre ?? f.nombre,
    cantidad: f.cantidad ?? 1,
    porcionNombre: f.porcionNombre ?? `${r1(gramos)} g`,
    gramos: r1(gramos),
    // Los macros son los que el usuario registró (ya con su estado crudo/cocido y sus gramos).
    calorias: f.calorias,
    proteina: f.proteina,
    carbos: f.carbos,
    grasas: f.grasas,
  };
}

export function sumIngredients(ings: RecipeIngredient[]): Recipe["totales"] {
  const t = ings.reduce(
    (a, i) => ({ calorias: a.calorias + i.calorias, proteina: a.proteina + i.proteina, carbos: a.carbos + i.carbos, grasas: a.grasas + i.grasas }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );
  return { calorias: Math.round(t.calorias), proteina: r1(t.proteina), carbos: r1(t.carbos), grasas: r1(t.grasas) };
}

/** Receta nueva (verificado = false) a partir de los alimentos activos de una comida. */
export function buildRecipeFromLogged(nombre: string, meal: MealType, foods: LoggedFood[], idx: ResolverIndex): NewRecipe {
  const ingredientes = foods.filter((f) => f.activo !== false).map((f) => loggedFoodToIngredient(f, idx));
  return {
    nombre: nombre.trim(),
    porciones: 1,
    tiempoPrepMin: 10,
    tipos: [meal],
    ingredientes,
    instrucciones: [],
    totales: sumIngredients(ingredientes),
    fuente: "manual",
    verificado: false,
  };
}

/** Receta existente con el mismo nombre (sin tildes, mayúsculas ni espacios de más), si hay. */
export function findRecipeByName(recipes: Recipe[], nombre: string): Recipe | undefined {
  const key = normalizeText(nombre);
  if (!key) return undefined;
  return recipes.find((r) => normalizeText(r.nombre) === key);
}

/** Qué se le cambia a una receta existente al "actualizarla" con una comida: ingredientes y totales nuevos, el tipo de
 * comida se suma (no se pierden los que ya tenía) y vuelve a "sin verificar" porque cambiaron los valores. */
export function updatePatchFromLogged(existing: Recipe, fresh: NewRecipe): Partial<Recipe> {
  const tipos = Array.from(new Set([...existing.tipos, ...fresh.tipos]));
  return { ingredientes: fresh.ingredientes, totales: fresh.totales, tipos, verificado: false };
}
