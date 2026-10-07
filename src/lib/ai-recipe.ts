import { BASE_FOODS } from "@/lib/food-utils";
import { getResolverIndex, nutritionForResult, resolveFoodText } from "@/lib/nutrition/food-resolver";
import type { Food, MealType, Recipe, RecipeIngredient } from "@/lib/types";

/**
 * Generador de recetas por reglas — no hay ningún modelo de IA de por medio. Cada ingrediente escrito se resuelve
 * contra la base de alimentos con el resolvedor común (`lib/nutrition/food-resolver.ts`: alias, plurales, tildes,
 * errores de tipeo), con la porción por defecto de cada uno (o la cantidad si se escribió "arroz 150 g"), y se suman
 * los macros. Es deliberadamente simple y transparente sobre ser una heurística.
 */
export function generateAiRecipe(freeText: string, foods: Food[] = BASE_FOODS): Omit<Recipe, "id" | "createdAt"> {
  const idx = getResolverIndex(foods);
  const terms = freeText
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ingredientes: RecipeIngredient[] = [];
  const usedIds = new Set<string>();

  for (const term of terms) {
    const r = resolveFoodText(term, idx, { foodsOnly: true, maxCandidates: 1 });
    const food = r.tipo === "alimento" ? r.chosen?.food : undefined;
    if (!food || usedIds.has(food.id)) continue;
    const n = nutritionForResult(r);
    if (!n) continue;
    usedIds.add(food.id);
    ingredientes.push({
      foodId: food.id,
      nombre: food.nombre,
      cantidad: 1,
      porcionNombre: `${Math.round(n.gramos * 10) / 10} g`,
      gramos: n.gramos,
      calorias: n.calorias,
      proteina: n.proteina,
      carbos: n.carbos,
      grasas: n.grasas,
    });
  }

  const totales = ingredientes.reduce(
    (acc, i) => ({
      calorias: acc.calorias + i.calorias,
      proteina: acc.proteina + i.proteina,
      carbos: acc.carbos + i.carbos,
      grasas: acc.grasas + i.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  const nombre = ingredientes.length > 0 ? `${ingredientes.map((i) => i.nombre).slice(0, 3).join(" con ")}` : "Receta con IA";

  const tipos: MealType[] = totales.calorias > 500 ? ["almuerzo", "cena"] : ["desayuno", "snack1"];

  const instrucciones =
    ingredientes.length > 0
      ? [
          "Prepara y porciona cada ingrediente según la cantidad indicada.",
          `Combina ${ingredientes.map((i) => i.nombre.toLowerCase()).join(", ")} en un mismo plato.`,
          "Cocina o mezcla al gusto y sirve caliente o frío según el ingrediente principal.",
        ]
      : ["Agrega ingredientes reconocidos por la base de datos para generar los pasos automáticamente."];

  return {
    nombre,
    foto: null,
    porciones: 1,
    tiempoPrepMin: 15,
    tipos,
    ingredientes,
    instrucciones,
    totales,
    favorito: false,
    fuente: "ia",
  };
}
