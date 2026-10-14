// Pruebas del glue entre LoggedFood/Food y el motor del nutriólogo (totales diarios de micronutrientes).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/nutriologo_data_test.ts
import { dailyMicronutrientTotals, topFoodsForNutrient } from "../../src/lib/nutrition/nutriologo-data";
import type { Food, LoggedFood } from "../../src/lib/types";

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
const naranja: Food = {
  id: "naranja",
  nombre: "Naranja",
  categoria: "Frutas",
  porcion: "100 g",
  calorias: 47,
  proteina: 1,
  carbos: 12,
  grasas: 0.1,
  micronutrientes: { vitaminaC: 53 },
};
const sinDatos: Food = {
  id: "galleta",
  nombre: "Galleta",
  categoria: "Snacks",
  porcion: "100 g",
  calorias: 480,
  proteina: 5,
  carbos: 65,
  grasas: 20,
};

function entry(daysAgo: number, foodId: string): LoggedFood {
  return {
    id: `e${daysAgo}-${foodId}`,
    foodId,
    nombre: foodId,
    calorias: 0,
    proteina: 0,
    carbos: 0,
    grasas: 0,
    meal: "almuerzo",
    timestamp: Date.now() - daysAgo * DAY_MS,
    gramos: 100,
    activo: true,
  };
}

// --- Un día con dato: cuenta como un punto en el array del nutriente ---
{
  const loggedFoods = [entry(0, "naranja"), entry(1, "naranja")];
  const result = dailyMicronutrientTotals(loggedFoods, [naranja], 14);
  ok(result.vitaminaC?.length === 2, "2 días con naranja: 2 puntos de vitaminaC");
  ok(Math.abs((result.vitaminaC?.[0] ?? 0) - 53) < 0.01, "el total del día con una naranja de 100g es ~53mg de vitaminaC");
}

// --- Día sin ningún alimento con dato de ese nutriente: no agrega un 0 ---
{
  const loggedFoods = [entry(0, "naranja"), entry(1, "galleta")];
  const result = dailyMicronutrientTotals(loggedFoods, [naranja, sinDatos], 14);
  ok(result.vitaminaC?.length === 1, "el día con solo galleta (sin vitaminaC) no agrega un punto en 0 para ese nutriente");
}

// --- Fuera de la ventana no cuenta ---
{
  const loggedFoods = [entry(0, "naranja"), entry(20, "naranja")];
  const result = dailyMicronutrientTotals(loggedFoods, [naranja], 14);
  ok(result.vitaminaC?.length === 1, "un registro de hace 20 días, fuera de una ventana de 14, no se cuenta");
}

// --- Varias porciones el mismo día se suman en un solo punto ---
{
  const loggedFoods = [entry(0, "naranja"), { ...entry(0, "naranja"), id: "e0-naranja-2" }];
  const result = dailyMicronutrientTotals(loggedFoods, [naranja], 14);
  ok(result.vitaminaC?.length === 1, "dos porciones el mismo día quedan en un solo punto (sumado), no dos");
  ok(Math.abs((result.vitaminaC?.[0] ?? 0) - 106) < 0.01, "la suma del día junta las dos porciones (~106mg)");
}

// --- topFoodsForNutrient: ordena de mayor a menor y omite alimentos sin el dato ---
{
  const kiwi: Food = { ...naranja, id: "kiwi", nombre: "Kiwi", micronutrientes: { vitaminaC: 93 } };
  const result = topFoodsForNutrient([naranja, kiwi, sinDatos], "vitaminaC", 5);
  ok(result.length === 2, "solo trae los alimentos que tienen el dato de ese nutriente (2 de 3)");
  ok(result[0].foodId === "kiwi", "el de mayor valor por porción queda primero (kiwi > naranja)");
}
{
  const result = topFoodsForNutrient([naranja, sinDatos], "vitaminaC", 1);
  ok(result.length === 1, "respeta el límite pedido");
}

console.log(`${checks - fails}/${checks} OK`);
if (fails > 0) process.exit(1);
