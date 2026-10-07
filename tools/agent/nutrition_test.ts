// Pruebas de las herramientas de agua y comidas del agente: validación, límites y que NUNCA cree alimentos ni registre con duda.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/agent/nutrition_test.ts
import { getTool } from "../../src/lib/agent/tools/registry";
import { decide } from "../../src/lib/agent/permissions";
import { defaultAgentConfig } from "../../src/lib/agent/config";
import { dayFromKey, dayTotals, inferMeal, outcomeData, planFoodItems } from "../../src/lib/agent/actions/nutrition-pure";
import { BASE_FOODS } from "../../src/lib/food-utils";
import { getResolverIndex } from "../../src/lib/nutrition/food-resolver";
import type { LoggedFood, WaterEntry } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const v = (tool: string, args: unknown) => getTool(tool)!.validate(args);
const ctx = (config = defaultAgentConfig()) => ({ channel: "app" as const, origin: "user" as const, config, now: Date.now(), recentWrites: [] });

// ── agua ───────────────────────────────────────────────────────────
ok(v("water_add", { ml: 250 }).ok, "water_add 250");
ok(!v("water_add", { ml: 0 }).ok && !v("water_add", { ml: 6000 }).ok && !v("water_add", {}).ok && !v("water_add", { ml: "250" }).ok, "water_add inválida");
ok(decide("water_add", { ml: 2000 }, ctx()).action === "deny", "2000 ml supera el límite por acción (1500 por defecto)");
ok(decide("water_add", { ml: 250 }, ctx()).action === "ask", "250 ml pregunta por defecto");
const allow = { ...defaultAgentConfig(), mode: "auto_safe" as const, levels: { app: { water_add: "allow" as const }, telegram: {} } };
ok(decide("water_add", { ml: 250 }, ctx(allow)).action === "allow", "250 ml pasa si está permitida");
const low = { ...allow, limits: { ...allow.limits, waterMaxMl: 300 } };
ok(decide("water_add", { ml: 400 }, ctx(low)).action === "deny", "el límite de agua es configurable");

// ── validación de comidas ──────────────────────────────────────────
ok(v("food_log", { items: [{ texto: "arroz", gramos: 150 }] }).ok, "food_log básica");
ok(!v("food_log", { items: [] }).ok && !v("food_log", {}).ok, "food_log sin items");
ok(!v("food_log", { items: Array(9).fill({ texto: "x" }) }).ok, "más de 8 items");
ok(!v("food_log", { items: [{ gramos: 3 }] }).ok, "item sin texto");
ok(!v("food_log", { items: [{ texto: "x", gramos: -5 }] }).ok, "gramos negativos");
ok(!v("food_log", { meal: "merienda", items: [{ texto: "x" }] }).ok, "comida inválida");
const allowFood = { ...defaultAgentConfig(), mode: "auto_safe" as const, levels: { app: { food_log: "allow" as const }, telegram: {} } };
ok(decide("food_log", { items: [{ texto: "arroz" }, { texto: "pollo" }, { texto: "palta" }] }, ctx(allowFood)).action === "allow", "3 alimentos (N=3) pasa si está permitida");
ok(decide("food_log", { items: [{ texto: "a" }, { texto: "b" }, { texto: "c" }, { texto: "d" }] }, ctx(allowFood)).action === "ask", "4 alimentos (>N) siempre pregunta");

// ── resolución: nunca inventa ──────────────────────────────────────
const idx = getResolverIndex(BASE_FOODS, []);
const plan = (items: Array<Record<string, unknown>>, caloriesMax = 1500) => planFoodItems(items, "almuerzo", idx, { caloriesMax });
const clear = plan([{ texto: "huevo", cantidad: 2 }]);
ok(clear[0].kind === "ok" || clear[0].kind === "ambiguous", "un alimento común se resuelve o se pregunta (nunca se inventa)");
const none = plan([{ texto: "zzzqqq inexistente xyz" }]);
ok(none[0].kind === "not_found", "alimento inexistente → not_found (no se crea)");
const data = outcomeData(none);
ok((data[0] as { registrado: unknown }).registrado === false, "no se registra lo que no existe");
const tight = plan([{ texto: "arroz", gramos: 2000 }], 100);
ok(tight.every((o) => o.kind !== "ok"), "supera el límite de calorías por entrada → no se registra");
const okRes = plan([{ texto: "arroz blanco", gramos: 100 }]);
const first = okRes[0];
if (first.kind === "ok") {
  ok(first.draft.gramos === 100 && first.calorias > 0, "gramos pedidos respetados");
  ok(first.draft.tipo === "alimento" && !!first.draft.foodId, "usa un alimento real de la base (foodId)");
} else {
  ok(first.kind === "ambiguous", "arroz blanco: o se resuelve o se pregunta");
}
const cant = plan([{ texto: "huevo", cantidad: 2 }]);
const one = plan([{ texto: "huevo", cantidad: 1 }]);
if (cant[0].kind === "ok" && one[0].kind === "ok") ok(Math.abs(cant[0].draft.gramos - 2 * one[0].draft.gramos) < 0.2, "cantidad multiplica la porción por defecto");

// ── comida por hora y totales ──────────────────────────────────────
ok(inferMeal(8) === "desayuno" && inferMeal(13) === "almuerzo" && inferMeal(17) === "snack1" && inferMeal(21) === "cena", "inferMeal");
const day = dayFromKey("2026-10-07");
const mk = (id: string, day2: string, kcal: number, activo = true): LoggedFood => ({
  id,
  foodId: "f",
  nombre: "x",
  calorias: kcal,
  proteina: 10,
  carbos: 20,
  grasas: 5,
  meal: "almuerzo",
  timestamp: dayFromKey(day2).getTime(),
  activo,
});
const w = (id: string, day2: string, ml: number): WaterEntry => ({ id, ml, timestamp: dayFromKey(day2).getTime() });
const t = dayTotals(
  [mk("1", "2026-10-07", 300), mk("2", "2026-10-07", 200, false), mk("3", "2026-10-06", 999)],
  [w("a", "2026-10-07", 250), w("b", "2026-10-07", 500), w("c", "2026-10-06", 900)],
  day,
  "2026-10-07",
);
ok(t.calorias === 300 && t.aguaMl === 750 && t.proteina === 10, "totales del día: solo ese día y solo activos");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
