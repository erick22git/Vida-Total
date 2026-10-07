/**
 * Lógica PURA de comidas y agua del agente: de lo que dijo el usuario a alimentos resueltos con el resolvedor de la app
 * (`food-resolver.ts`). Regla de oro: si hay ambigüedad o no existe, NO se registra y se devuelven opciones para que el
 * agente pregunte; el agente NUNCA crea alimentos nuevos (eso exige confirmación del usuario en la pantalla de alimentos).
 */
import { draftFromResult, liveMacros, type DraftItem } from "@/lib/nutrition/draft-item";
import { resolveFoodText, type ResolverIndex } from "@/lib/nutrition/food-resolver";
import { activeLoggedFoods } from "@/lib/food-utils";
import type { LoggedFood, MealType, WaterEntry } from "@/lib/types";
import type { Args } from "../tools/meta";

export type FoodOutcome =
  | { kind: "ok"; draft: DraftItem; calorias: number }
  | { kind: "ambiguous"; texto: string; options: string[] }
  | { kind: "not_found"; texto: string }
  | { kind: "too_big"; texto: string; nombre: string; calorias: number };

/** Comida por defecto según la hora local (0-23) cuando el usuario no la dijo. */
export function inferMeal(hour: number): MealType {
  if (hour < 11) return "desayuno";
  if (hour < 16) return "almuerzo";
  if (hour < 19) return "snack1";
  return "cena";
}

export interface FoodPlanOptions {
  usage?: Map<string, number>;
  /** Calorías máximas por entrada (límite configurable del agente). */
  caloriesMax: number;
}

export function planFoodItems(items: Args[], meal: MealType, idx: ResolverIndex, opts: FoodPlanOptions): FoodOutcome[] {
  return items.map((it): FoodOutcome => {
    const texto = String(it.texto);
    const gramos = typeof it.gramos === "number" ? it.gramos : null;
    const cantidad = typeof it.cantidad === "number" ? it.cantidad : null;
    const r = resolveFoodText(texto, idx, { usage: opts.usage, gramos });
    if (r.tipo === "sin_resultado" || !r.chosen) {
      const options = r.candidates.slice(0, 3).map((c) => c.nombre);
      return options.length ? { kind: "ambiguous", texto, options } : { kind: "not_found", texto };
    }
    // Solo se registra solo cuando la coincidencia es clara; con duda, se pregunta.
    if (r.confidence !== "alta") return { kind: "ambiguous", texto, options: r.candidates.slice(0, 3).map((c) => c.nombre) };
    const draft = draftFromResult(meal, texto, r);
    if (!draft) return { kind: "not_found", texto };
    // "2 huevos" sin gramos: la cantidad multiplica la porción por defecto.
    if (gramos === null && cantidad !== null) draft.gramos = Math.round(draft.gramos * cantidad * 10) / 10;
    const calorias = Math.round(liveMacros(draft).calorias);
    if (calorias > opts.caloriesMax) return { kind: "too_big", texto, nombre: draft.nombre, calorias };
    return { kind: "ok", draft, calorias };
  });
}

/** Lo que se le devuelve al modelo tras un `food_log`. */
export function outcomeData(outcomes: FoodOutcome[]) {
  return outcomes.map((o) =>
    o.kind === "ok"
      ? { texto: o.draft.texto, registrado: o.draft.nombre, gramos: o.draft.gramos, calorias: o.calorias }
      : o.kind === "ambiguous"
        ? { texto: o.texto, registrado: false, motivo: "ambiguo: pregunta al usuario cuál es", opciones: o.options }
        : o.kind === "not_found"
          ? { texto: o.texto, registrado: false, motivo: "no está en la base; el usuario puede crearlo desde la pantalla de alimentos" }
          : { texto: o.texto, registrado: false, motivo: `${o.nombre} suma ${o.calorias} kcal y supera tu límite por entrada` },
  );
}

export interface DayTotals {
  fecha: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  aguaMl: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function dayTotals(foods: LoggedFood[], water: WaterEntry[], day: Date, fecha: string): DayTotals {
  const sameDay = (ts: number) => {
    const d = new Date(ts);
    return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
  };
  const f = activeLoggedFoods(foods.filter((x) => sameDay(x.timestamp)));
  return {
    fecha,
    calorias: Math.round(f.reduce((s, x) => s + x.calorias, 0)),
    proteina: r1(f.reduce((s, x) => s + x.proteina, 0)),
    carbos: r1(f.reduce((s, x) => s + x.carbos, 0)),
    grasas: r1(f.reduce((s, x) => s + x.grasas, 0)),
    aguaMl: water.filter((w) => sameDay(w.timestamp)).reduce((s, w) => s + w.ml, 0),
  };
}

/** Fecha local yyyy-MM-dd → Date a las 12:00 local (evita saltos por zona horaria). */
export function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
