import { BASE_FOODS, defaultPortions, scaleNutrition } from "@/lib/food-utils";
import type { MealType, Recipe, RecipeIngredient } from "@/lib/types";

/**
 * Rule-based "AI" recipe generator — no real model involved. Matches free-text
 * ingredient names against the local food database (simple substring/fuzzy
 * match), builds a plausible recipe with 1 default portion of each match, and
 * sums up the macros. Intentionally simple and transparent about being a
 * heuristic rather than a real AI suggestion.
 */
export function generateAiRecipe(freeText: string): Omit<Recipe, "id" | "createdAt"> {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const terms = freeText
    .split(/[,\n]/)
    .map((t) => normalize(t.trim()))
    .filter(Boolean);

  const ingredientes: RecipeIngredient[] = [];
  const usedIds = new Set<string>();

  for (const term of terms) {
    const match = BASE_FOODS.find((f) => {
      if (usedIds.has(f.id)) return false;
      const name = normalize(f.nombre);
      return name.includes(term) || term.includes(name.split(" ")[0]);
    });
    if (!match) continue;
    usedIds.add(match.id);
    const portion = defaultPortions(match)[0];
    const nutrition = scaleNutrition(match, portion.gramos);
    ingredientes.push({
      foodId: match.id,
      nombre: match.nombre,
      cantidad: 1,
      porcionNombre: portion.nombre,
      gramos: portion.gramos,
      calorias: nutrition.calorias,
      proteina: nutrition.proteina,
      carbos: nutrition.carbos,
      grasas: nutrition.grasas,
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
