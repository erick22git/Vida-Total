// Pruebas del motor del nutriólogo virtual (Nutrition Care Process: evaluación, diagnóstico PES,
// intervención, monitoreo). Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/nutrition_care_engine_test.ts
import { evaluate, diagnose, buildIntervention, monitor, RECOMMENDED_WINDOW_DAYS } from "../../src/lib/nutrition/nutrition-care-engine";
import { getNutrientTargets } from "../../src/lib/nutrition/nutrient-targets";
import type { LoggedFood, WeightEntry } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const DAY_MS = 86400000;
function foodAt(daysAgo: number, overrides: Partial<LoggedFood> = {}): LoggedFood {
  return {
    id: `f${daysAgo}-${Math.random()}`,
    foodId: "x",
    nombre: "x",
    calorias: 2000,
    proteina: 80,
    carbos: 200,
    grasas: 60,
    meal: "almuerzo",
    timestamp: Date.now() - daysAgo * DAY_MS,
    activo: true,
    ...overrides,
  };
}

// --- Evaluación: ventana insuficiente ---
{
  const foods = [foodAt(0), foodAt(1)]; // solo 2 de 14 días registrados
  const result = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  ok(result.datosSuficientes === false, "ventana con pocos días registrados: datosSuficientes=false");
  ok(result.windowDays === RECOMMENDED_WINDOW_DAYS, "windowDays por defecto es el recomendado (14)");
}

// --- Evaluación: ventana consistente ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d, { proteina: 80, calorias: 2000 }));
  const result = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  ok(result.datosSuficientes === true, "14/14 días registrados: datosSuficientes=true");
  ok(Math.abs(result.nutrientes.proteina.promedioDiario - 80) < 0.01, "promedio diario de proteína correcto");
  ok(Math.abs(result.nutrientes.calorias.promedioDiario - 2000) < 0.01, "promedio diario de calorías correcto");
}

// --- Evaluación: peso de tendencia ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const weightEntries: WeightEntry[] = [
    { id: "w1", kg: 80, date: new Date(Date.now() - 1 * DAY_MS).toISOString() },
    { id: "w2", kg: 82, date: new Date(Date.now() - 3 * DAY_MS).toISOString() },
  ];
  const result = evaluate({ loggedFoods: foods, weightEntries, profile: {} });
  ok(result.pesoTendenciaKg !== null && Math.abs(result.pesoTendenciaKg - 81) < 0.01, "peso de tendencia: promedio de los pesajes de la ventana");
}

// --- Diagnóstico: no corre con datos insuficientes ---
{
  const foods = [foodAt(0)];
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(14).fill(10) });
  ok(diag.length === 0, "sin datos suficientes: diagnose() devuelve [] (no fuerza un diagnóstico)");
}

// --- Diagnóstico: riesgo de inadecuación sostenido ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 }); // RDA vitamina C mujer: 75 mg
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(14).fill(20) });
  const vitC = diag.find((d) => d.nutrientId === "vitaminaC");
  ok(!!vitC, "detecta riesgo de ingesta inadecuada de vitamina C muy por debajo de la RDA");
  ok(vitC?.kind === "riesgo_inadecuado", "tipo de diagnóstico: riesgo_inadecuado");
  ok(!vitC!.problema.toLowerCase().includes("escorbuto"), "el mensaje nunca nombra una enfermedad");
  ok(vitC!.diasFueraDeRango === 14 && vitC!.diasEnVentana === 14, "cuenta los 14 de 14 días por debajo de la RDA");
  ok(vitC!.signos.includes("14 de 14 días"), "los signos reportan el conteo de días, no solo el promedio");
}

// --- Diagnóstico: un solo día malo aislado (ruido) no alcanza para diagnosticar ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const dias = Array(14).fill(90); // por encima de la RDA (75) casi todos los días
  dias[0] = 5; // un solo día muy bajo
  const diag = diagnose(evalResult, targets, { vitaminaC: dias });
  ok(diag.find((d) => d.nutrientId === "vitaminaC") === undefined, "un día aislado bajo no basta: no es un patrón sostenido");
}

// --- Diagnóstico: riesgo de exceso sobre UL ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "hombre", edad: 25 }); // UL vitamina A 19-30: 3000
  const diag = diagnose(evalResult, targets, { vitaminaA: Array(14).fill(5000) });
  const vitA = diag.find((d) => d.nutrientId === "vitaminaA" && d.kind === "riesgo_exceso");
  ok(!!vitA, "detecta riesgo de exceso de vitamina A sobre el UL");
}

// --- Diagnóstico: ingesta normal, sin diagnóstico ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(14).fill(90) }); // por encima de la RDA (75), bajo el UL
  ok(diag.find((d) => d.nutrientId === "vitaminaC") === undefined, "ingesta dentro de rango: sin diagnóstico para ese nutriente");
}

// --- Intervención ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(14).fill(20) });
  const vitC = diag.find((d) => d.nutrientId === "vitaminaC")!;
  const intervention = buildIntervention(vitC, ["naranja", "kiwi"]);
  ok(intervention.alimentosSugeridosIds.length === 2, "la intervención lleva los alimentos sugeridos tal cual se le pasan");
  ok(intervention.mensaje.includes("mg") || intervention.mensaje.length > 0, "la intervención trae un mensaje accionable");
}

// --- Monitoreo ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(14).fill(20) })[0];
  ok(monitor(diag, 60).status === "mejoro", "subir la ingesta de un nutriente bajo cuenta como mejoró");
  ok(monitor(diag, 21).status === "igual", "cambio dentro de la tolerancia cuenta como igual");
  ok(monitor(diag, 5).status === "empeoro", "bajar aún más la ingesta de un nutriente ya bajo cuenta como empeoró");
}

console.log(`${checks - fails}/${checks} OK`);
if (fails > 0) process.exit(1);
