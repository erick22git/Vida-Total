"use client";

/** Ejecutores de agua y comidas del agente EN LA APP (usan los stores de Gym). */
import { format } from "date-fns";
import { mergeFoods } from "@/lib/food-utils";
import { buildUsageMap, getResolverIndex } from "@/lib/nutrition/food-resolver";
import { commitDraftItems } from "@/lib/nutrition/draft-item";
import { useGymStore } from "@/lib/store/gymStore";
import { useAgentStore } from "@/lib/store/agentStore";
import type { LoggedFood, MealType } from "@/lib/types";
import type { Args } from "../tools/meta";
import type { ExecResult } from "./client";
import { dayFromKey, dayTotals, inferMeal, outcomeData, planFoodItems } from "./nutrition-pure";

const gym = () => useGymStore.getState();

export const NUTRITION_EXECUTORS: Record<string, (args: Args) => ExecResult> = {
  water_add: (a) => {
    const ml = a.ml as number;
    gym().addWater(ml);
    const created = gym().waterEntries[gym().waterEntries.length - 1];
    return { ok: true, summary: `Agua +${ml} ml`, undo: created ? { kind: "remove_water", id: created.id } : undefined, after: `+${ml} ml` };
  },
  food_log: (a) => {
    const g = gym();
    const meal = (a.meal as MealType | undefined) ?? inferMeal(new Date().getHours());
    const idx = getResolverIndex(mergeFoods(g.customFoods), g.recipes);
    const caloriesMax = useAgentStore.getState().config.limits.caloriesMaxPerEntry;
    const outcomes = planFoodItems(a.items as Args[], meal, idx, { usage: buildUsageMap(g.loggedFoods), caloriesMax });
    const oks = outcomes.flatMap((o) => (o.kind === "ok" ? [o.draft] : []));
    const created: LoggedFood[] = [];
    if (oks.length) {
      commitDraftItems(oks, {
        addLoggedFood: (f) => {
          const c = g.addLoggedFood(f);
          created.push(c);
          return c;
        },
        // El agente no crea alimentos: los borradores "nuevo" nunca llegan aquí (planFoodItems los descarta).
        addCustomFood: () => {
          throw new Error("El agente no crea alimentos nuevos.");
        },
      });
    }
    const kcal = created.reduce((s, f) => s + f.calorias, 0);
    const skipped = outcomes.length - oks.length;
    const summary = oks.length
      ? `Registré ${created.length} alimento(s) en ${meal} (${kcal} kcal)${skipped ? `; ${skipped} sin registrar` : ""}`
      : "No registré nada: hay dudas o no encontré los alimentos";
    return {
      ok: oks.length > 0,
      summary,
      data: { comida: meal, resultados: outcomeData(outcomes) },
      undo: created.length ? { kind: "remove_foods", ids: created.map((c) => c.id) } : undefined,
      after: oks.map((d) => `${d.nombre} ${d.gramos} g`).join(", ") || undefined,
    };
  },
  day_totals: (a) => {
    const g = gym();
    const fecha = (a.fecha as string | undefined) ?? format(new Date(), "yyyy-MM-dd");
    const t = dayTotals(g.loggedFoods, g.waterEntries, dayFromKey(fecha), fecha);
    return {
      ok: true,
      summary: `${t.calorias} kcal · ${t.aguaMl} ml de agua`,
      data: { ...t, metas: { calorias: g.calorieGoal, proteina: g.proteinGoal, carbos: g.carbsGoal, grasas: g.fatGoal, aguaMl: g.waterGoalMl } },
    };
  },
};

/** Vista previa "antes → después" para las tarjetas de permiso. */
export const NUTRITION_PREVIEWS: Record<string, (args: Args) => { before?: string; after?: string } | null> = {
  water_add: (a) => {
    const g = gym();
    const today = dayTotals(g.loggedFoods, g.waterEntries, new Date(), "").aguaMl;
    return { before: `${today} ml hoy`, after: `${today + (a.ml as number)} ml hoy` };
  },
  food_log: (a) => {
    const g = gym();
    const meal = (a.meal as MealType | undefined) ?? inferMeal(new Date().getHours());
    const idx = getResolverIndex(mergeFoods(g.customFoods), g.recipes);
    const caloriesMax = useAgentStore.getState().config.limits.caloriesMaxPerEntry;
    const outcomes = planFoodItems(a.items as Args[], meal, idx, { usage: buildUsageMap(g.loggedFoods), caloriesMax });
    const today = dayTotals(g.loggedFoods, g.waterEntries, new Date(), "").calorias;
    const add = outcomes.reduce((s, o) => s + (o.kind === "ok" ? o.calorias : 0), 0);
    const names = outcomes.map((o) => (o.kind === "ok" ? `${o.draft.nombre} (${o.draft.gramos} g)` : `¿${o.texto}? (sin registrar)`)).join(", ");
    return { before: `${today} kcal hoy`, after: `${today + add} kcal hoy · ${names}` };
  },
};
