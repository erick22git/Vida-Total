/**
 * Borrador de un alimento ya resuelto (Lista, Escáner, Voz): lo que el usuario ve y edita antes de guardar. Los macros
 * se guardan para `base.gramos` y se escalan en vivo al cambiar `gramos` (todo es lineal). Compartido para que las tres
 * entradas se comporten igual — la lógica de "qué es este texto" vive solo en `food-resolver.ts`.
 */
import { nutritionForResult, type Candidate, type ResolveResult, type ResolvedIngredient } from "@/lib/nutrition/food-resolver";
import type { CookedState, Food, LoggedFood, MealType } from "@/lib/types";

export interface Macros {
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

/** alimento = de la base · receta = receta del usuario · nuevo = sin equivalente (se crea "sin configurar" al guardar)
 *  · ia = sin equivalente en la base, se conserva la estimación de la IA del Escáner. */
export type DraftTipo = "alimento" | "receta" | "nuevo" | "ia";

export interface DraftItem {
  id: string;
  meal: MealType;
  /** Lo que escribió/dictó/detectó la IA (sin la cantidad). */
  texto: string;
  tipo: DraftTipo;
  nombre: string;
  foodId?: string;
  recipeId?: string;
  cookedState?: CookedState;
  gramos: number;
  base: Macros & { gramos: number };
  ingredientesBase?: ResolvedIngredient[];
  /** Para el chip "cambiar": hasta 4 alternativas del resolvedor. */
  candidates: Candidate[];
}

export const MAX_CANDIDATES = 4;

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function liveMacros(it: DraftItem): Macros {
  const f = it.base.gramos > 0 ? it.gramos / it.base.gramos : 0;
  return {
    calorias: it.base.calorias * f,
    proteina: it.base.proteina * f,
    carbos: it.base.carbos * f,
    grasas: it.base.grasas * f,
  };
}

export function sumMacros(items: DraftItem[]): Macros {
  return items.reduce<Macros>(
    (acc, it) => {
      const m = liveMacros(it);
      return { calorias: acc.calorias + m.calorias, proteina: acc.proteina + m.proteina, carbos: acc.carbos + m.carbos, grasas: acc.grasas + m.grasas };
    },
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );
}

/** Borrador a partir de un resultado del resolvedor; null si fue "sin resultado". */
export function draftFromResult(meal: MealType, texto: string, r: ResolveResult, id = uid()): DraftItem | null {
  if (!r.chosen || r.tipo === "sin_resultado") return null;
  const candidates = r.candidates.slice(0, MAX_CANDIDATES);
  if (r.tipo === "receta" && r.ingredientes) {
    const tot = r.ingredientes.reduce(
      (a, i) => ({ calorias: a.calorias + i.calorias, proteina: a.proteina + i.proteina, carbos: a.carbos + i.carbos, grasas: a.grasas + i.grasas }),
      { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
    );
    return {
      id, meal, texto, tipo: "receta", nombre: r.chosen.nombre, recipeId: r.recipeId, gramos: r.gramos,
      base: { gramos: r.gramos, ...tot }, ingredientesBase: r.ingredientes, candidates,
    };
  }
  // Macros de referencia a 100 g (más precisos al escalar que partir de una porción chica ya redondeada).
  const n = nutritionForResult(r, 100);
  if (!n || !r.chosen.food) return null;
  return {
    id, meal, texto, tipo: "alimento", nombre: r.chosen.food.nombre, foodId: r.chosen.food.id, cookedState: r.cookedState, gramos: r.gramos,
    base: { gramos: 100, calorias: n.calorias, proteina: n.proteina, carbos: n.carbos, grasas: n.grasas },
    candidates,
  };
}

export function draftNuevo(meal: MealType, texto: string, gramos: number | null, candidates: Candidate[], id = uid()): DraftItem {
  return {
    id, meal, texto, tipo: "nuevo", nombre: texto.trim(), gramos: gramos ?? 100,
    base: { gramos: gramos ?? 100, calorias: 0, proteina: 0, carbos: 0, grasas: 0 }, candidates,
  };
}

/** Sin equivalente en la base pero la IA trajo una estimación para `gramos` g: se conserva. */
export function draftIa(meal: MealType, texto: string, gramos: number, estimado: Macros, candidates: Candidate[], id = uid()): DraftItem {
  return { id, meal, texto, tipo: "ia", nombre: texto.trim() || "Alimento", gramos, base: { gramos, ...estimado }, candidates };
}

type AddLoggedFood = (food: Omit<LoggedFood, "id" | "timestamp">) => LoggedFood;
type AddCustomFood = (food: Omit<Food, "id" | "creadoPorUsuario">) => Food;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Guarda los borradores en el store. Las recetas se registran como sus ingredientes (cada uno con su alimento y
 * micronutrientes) con el vínculo `recipeId`; "nuevo" crea el alimento "sin configurar" recién acá, al confirmar. */
export function commitDraftItems(
  items: DraftItem[],
  deps: { addLoggedFood: AddLoggedFood; addCustomFood: AddCustomFood },
  extra?: (it: DraftItem) => Partial<Omit<LoggedFood, "id" | "timestamp">>,
): { saved: number; failed: number } {
  let saved = 0;
  let failed = 0;
  // Cada ítem se guarda en su propio try/catch: si uno falla (dato inesperado de la IA, etc.) los
  // demás igual se guardan — antes un error a mitad de la lista cortaba el `for` y solo quedaban
  // guardados los ítems anteriores a ese, sin ningún aviso (parecía que "solo se guardó 1 de 5").
  for (const it of items) {
    try {
      const gr = r1(it.gramos);
      const more = extra?.(it) ?? {};
      if (it.tipo === "receta" && it.ingredientesBase) {
        const f = it.base.gramos > 0 ? it.gramos / it.base.gramos : 0;
        for (const ing of it.ingredientesBase) {
          deps.addLoggedFood({
            foodId: ing.foodId,
            nombre: ing.nombre,
            calorias: Math.round(ing.calorias * f),
            proteina: r1(ing.proteina * f),
            carbos: r1(ing.carbos * f),
            grasas: r1(ing.grasas * f),
            meal: it.meal,
            gramos: r1(ing.gramos * f),
            porcionNombre: `${r1(ing.gramos * f)} g`,
            recipeId: it.recipeId,
            ...more,
          });
        }
        saved++;
        continue;
      }
      let foodId = it.foodId;
      if (it.tipo === "nuevo") {
        const placeholder = deps.addCustomFood({
          nombre: it.nombre, categoria: "Otros", porcion: "1 unidad", calorias: 0, proteina: 0, carbos: 0, grasas: 0, configurado: false,
        });
        foodId = placeholder.id;
      }
      const m = liveMacros(it);
      deps.addLoggedFood({
        foodId: foodId ?? `scan-${it.id}`,
        nombre: it.nombre,
        calorias: Math.round(m.calorias),
        proteina: r1(m.proteina),
        carbos: r1(m.carbos),
        grasas: r1(m.grasas),
        meal: it.meal,
        gramos: gr,
        porcionNombre: `${gr} g`,
        cookedState: it.cookedState,
        ...more,
      });
      saved++;
    } catch (err) {
      console.error("[commitDraftItems] no se pudo guardar un ítem", it, err);
      failed++;
    }
  }
  return { saved, failed };
}
