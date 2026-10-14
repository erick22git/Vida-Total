// Pruebas de la correlación síntoma-alimento del nutriólogo (estadística simple de conteo, no un test de
// alergia). Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/symptom_correlation_test.ts
import { correlateSymptom, correlateAllSymptoms, MIN_SYMPTOM_OCCURRENCES, CORRELATION_WINDOW_HOURS } from "../../src/lib/nutrition/symptom-correlation";
import type { LoggedFood, SymptomEntry } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const HOUR = 60 * 60 * 1000;
function food(id: string, foodId: string, nombre: string, ts: number): LoggedFood {
  return { id, foodId, nombre, calorias: 100, proteina: 1, carbos: 1, grasas: 1, meal: "almuerzo", timestamp: ts, activo: true };
}
function symptom(id: string, loggedFoodId: string, kind: string, ts: number): SymptomEntry {
  return { id, loggedFoodId, kind: kind as SymptomEntry["kind"], timestamp: ts };
}

// --- Menos del mínimo de reportes: sin patrón ---
{
  const now = Date.now();
  const foods = [food("f1", "leche", "Leche", now)];
  const symptoms = [symptom("s1", "f1", "hinchazon", now + 1000)];
  const result = correlateSymptom("hinchazon", symptoms, foods);
  ok(result.datosSuficientes === false, "con 1 reporte (menos del mínimo): datosSuficientes=false");
  ok(result.alimentos.length === 0, "sin datos suficientes: no muestra alimentos todavía");
  ok(MIN_SYMPTOM_OCCURRENCES === 5, "el mínimo documentado sigue siendo 5");
}

// --- Patrón claro: un alimento aparece en la mayoría de los reportes ---
{
  const now = Date.now();
  const foods: LoggedFood[] = [];
  const symptoms: SymptomEntry[] = [];
  for (let i = 0; i < 8; i++) {
    const base = now - i * 24 * HOUR;
    const foodTs = base - HOUR; // 1h antes del síntoma, dentro de la ventana de 4h
    const foodId = `log${i}`;
    foods.push(food(foodId, "leche", "Leche", foodTs));
    // "en 6 de 8" veces comió leche antes; las otras 2 veces, otra cosa.
    if (i >= 6) foods[foods.length - 1] = food(foodId, "pan", "Pan", foodTs);
    symptoms.push(symptom(`s${i}`, foodId, "hinchazon", base));
  }
  const result = correlateSymptom("hinchazon", symptoms, foods);
  ok(result.datosSuficientes === true, "8 reportes (>= mínimo): datosSuficientes=true");
  ok(result.totalOcurrencias === 8, "cuenta las 8 ocurrencias del síntoma");
  const leche = result.alimentos.find((a) => a.foodId === "leche");
  ok(leche?.coincidencias === 6, "leche aparece en 6 de los 8 reportes, dentro de la ventana previa");
  ok(result.alimentos[0].foodId === "leche", "el alimento más coincidente queda primero (orden descendente)");
}

// --- Alimento fuera de la ventana de horas no cuenta ---
{
  const now = Date.now();
  const foods: LoggedFood[] = [];
  const symptoms: SymptomEntry[] = [];
  for (let i = 0; i < 5; i++) {
    const base = now - i * 24 * HOUR;
    const foodId = `log${i}`;
    // comido 6 horas antes: fuera de la ventana de 4 horas.
    foods.push(food(foodId, "cafe", "Café", base - 6 * HOUR));
    symptoms.push(symptom(`s${i}`, foodId, "dolor_cabeza", base));
  }
  const result = correlateSymptom("dolor_cabeza", symptoms, foods);
  ok(result.alimentos.find((a) => a.foodId === "cafe") === undefined, "un alimento fuera de la ventana de horas no se cuenta como coincidencia");
  ok(CORRELATION_WINDOW_HOURS === 4, "la ventana documentada sigue siendo 4 horas");
}

// --- Un alimento comido varias veces antes del MISMO reporte cuenta una sola vez ---
{
  const now = Date.now();
  const foods: LoggedFood[] = [];
  const symptoms: SymptomEntry[] = [];
  for (let i = 0; i < 5; i++) {
    const base = now - i * 24 * HOUR;
    const anchorId = `log${i}-a`;
    foods.push(food(anchorId, "huevo", "Huevo", base - 30 * 60 * 1000));
    foods.push(food(`log${i}-b`, "huevo", "Huevo", base - 60 * 60 * 1000)); // segunda porción, mismo día
    symptoms.push(symptom(`s${i}`, anchorId, "fatiga", base));
  }
  const result = correlateSymptom("fatiga", symptoms, foods);
  const huevo = result.alimentos.find((a) => a.foodId === "huevo");
  ok(huevo?.coincidencias === 5, "dos porciones del mismo alimento antes de un reporte cuentan como una sola coincidencia");
}

// --- correlateAllSymptoms: un resultado por cada tipo de síntoma reportado ---
{
  const now = Date.now();
  const symptoms = [symptom("s1", "f1", "hinchazon", now), symptom("s2", "f2", "fatiga", now)];
  const results = correlateAllSymptoms(symptoms, []);
  ok(results.length === 2, "un resultado por cada kind distinto reportado");
  ok(results.every((r) => r.datosSuficientes === false), "con 1 reporte cada uno, ninguno tiene datos suficientes todavía");
}

console.log(`${checks - fails}/${checks} OK`);
if (fails > 0) process.exit(1);
