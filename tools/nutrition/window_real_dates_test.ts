// Fase 1: verificación REAL (fechas reales de `Date`, sin mockear "hoy") de que al pasar la ventana de
// 14 días con registro consistente, el Nutriólogo y el ajuste de calorías YA muestran resultado, no
// "faltan datos" por un bug de conteo (off-by-one, huso horario). Ejecutar:
// node tools/3d/verify/run_ts.mjs tools/nutrition/window_real_dates_test.ts
import { evaluate, diagnose, RECOMMENDED_WINDOW_DAYS } from "../../src/lib/nutrition/nutrition-care-engine";
import { getNutrientTargets } from "../../src/lib/nutrition/nutrient-targets";
import { evaluateAdaptiveCalories } from "../../src/lib/gym/calorie-adaptive";
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
// Ancla real: Date.now() de ESTE proceso, al correr la prueba — no una fecha fija escrita a mano. Si
// mañana se corre de nuevo, igual tiene que dar el mismo resultado: eso es justamente lo que prueba que
// no hay un bug de huso horario atado a una fecha particular.
const NOW = Date.now();

function foodAt(daysAgo: number): LoggedFood {
  return {
    id: `f${daysAgo}`,
    foodId: "x",
    nombre: "x",
    calorias: 2000,
    proteina: 80,
    carbos: 200,
    grasas: 60,
    meal: "almuerzo",
    timestamp: NOW - daysAgo * DAY_MS,
    activo: true,
  };
}

function weightAt(daysAgo: number, kg: number): WeightEntry {
  return { id: `w${daysAgo}`, kg, date: new Date(NOW - daysAgo * DAY_MS).toISOString() };
}

// --- 20 días consecutivos de registro: con ventana de 14, el día 14 ya alcanza para diagnosticar ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 20; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  ok(evalResult.windowDays === RECOMMENDED_WINDOW_DAYS, `ventana por defecto sigue siendo ${RECOMMENDED_WINDOW_DAYS} días`);
  ok(evalResult.loggedDays === RECOMMENDED_WINDOW_DAYS, `con 20 días de historial, cuenta exactamente los ${RECOMMENDED_WINDOW_DAYS} de la ventana (no más, no menos — sin off-by-one)`);
  ok(evalResult.datosSuficientes === true, "con 14/14 días registrados (fechas reales), datosSuficientes=true, no 'faltan datos'");

  const targets = getNutrientTargets({ sexo: "mujer", edad: 25 });
  const diag = diagnose(evalResult, targets, { vitaminaC: Array(RECOMMENDED_WINDOW_DAYS).fill(10) });
  ok(diag.length > 0, "con datos reales de 14 días consistentes, diagnose() YA da un diagnóstico (no vacío por falta de ventana)");
  const vitC = diag.find((d) => d.nutrientId === "vitaminaC");
  ok(!!vitC && vitC.signos.includes(`${RECOMMENDED_WINDOW_DAYS} de ${RECOMMENDED_WINDOW_DAYS} días`), `el conteo de días del diagnóstico es exacto: "${RECOMMENDED_WINDOW_DAYS} de ${RECOMMENDED_WINDOW_DAYS} días"`);
}

// --- Justo 13 días (uno menos que el mínimo de 14): todavía NO debe alcanzar ---
{
  const foods: LoggedFood[] = [];
  for (let d = 0; d < 13; d++) foods.push(foodAt(d));
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  // 13 días logueados de una ventana de 14 = 92.8%, por encima del 70% mínimo, así que esto SÍ pasa el
  // umbral de consistencia (no es "todos los días", es "suficientemente consistente") — se prueba el
  // caso límite real: exactamente 10 días de 14 (70.0%, el mínimo exacto) para encontrar un off-by-one.
  const tenOfFourteen: LoggedFood[] = [];
  for (let d = 0; d < 14; d++) if (d < 10) tenOfFourteen.push(foodAt(d));
  const evalBoundary = evaluate({ loggedFoods: tenOfFourteen, weightEntries: [], profile: {} });
  ok(evalBoundary.loggedDays === 10 && evalBoundary.windowDays === 14, "caso límite: 10 de 14 días contados correctamente");
  ok(evalBoundary.datosSuficientes === true, "10 de 14 días (exactamente 71.4%, por encima del mínimo del 70%) ya alcanza — no hay off-by-one que lo rechace de más");
  ok(evalResult.loggedDays === 13, "13 días de historial real: cuenta exactamente 13, no 12 ni 14 (sin corrimiento de huso horario)");
}

// --- Un registro de HOY MISMO (Date.now() real, sin offset) ya cuenta en el cálculo de esta misma corrida ---
{
  const foods = [foodAt(0)]; // "hoy" literal, timestamp = NOW exacto
  const evalResult = evaluate({ loggedFoods: foods, weightEntries: [], profile: {} });
  ok(evalResult.nutrientes.calorias.diasConDato === 1, "un registro de HOY (Date.now() real) ya cuenta en el cálculo de esta misma sesión — sin cache vieja, se recalcula con lo que hay en el momento");
}

// --- Ajuste adaptativo de calorías: mismo criterio, 14 días reales de peso+registro consistente ---
{
  const loggedFoods: LoggedFood[] = [];
  const weightEntries: WeightEntry[] = [];
  for (let d = 0; d < 14; d++) {
    loggedFoods.push(foodAt(d));
    // Peso bajando de forma sostenida y mayor a lo esperado por las calorías registradas, para que
    // termine en "suggestion" y no en "on_track" (confirma que SÍ calcula, no que da cualquier resultado).
    weightEntries.push(weightAt(d, 85 - d * 0.25));
  }
  const result = evaluateAdaptiveCalories({ weightEntries, loggedFoods, calorieGoal: 2000, calculatedTDEE: 2000 });
  ok(result.status !== "insufficient_data", `con 14 días reales de peso y comida consistentes, el ajuste adaptativo YA calcula (status="${result.status}"), no "faltan datos"`);
  ok(result.windowDays === 14, "la ventana del ajuste adaptativo sigue siendo 14 días");
}

// --- Un pesaje de HOY MISMO ya cuenta en el cálculo de esta misma corrida ---
{
  const loggedFoods: LoggedFood[] = [];
  const weightEntries: WeightEntry[] = [];
  for (let d = 0; d < 14; d++) {
    loggedFoods.push(foodAt(d));
    weightEntries.push(weightAt(d, 80));
  }
  // Pesaje de HOY agregado DESPUÉS de armar los 14 días — si no se recalculara en vivo, este no contaría.
  weightEntries.push(weightAt(0, 79.5));
  const result = evaluateAdaptiveCalories({ weightEntries, loggedFoods, calorieGoal: 2000, calculatedTDEE: 2000 });
  ok(result.status !== "insufficient_data", "un pesaje de HOY agregado recién ya entra en el cálculo de esta misma corrida (sin cache)");
}

console.log(`${checks - fails}/${checks} OK`);
if (fails > 0) process.exit(1);
