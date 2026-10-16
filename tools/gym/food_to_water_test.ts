// Pruebas del vínculo alimento-líquido ↔ meta de agua. Ejecutar: npx tsx tools/gym/food_to_water_test.ts
import { buildDrinkNameIndex, waterLinkForLoggedFood } from "../../src/lib/gym/food-to-water";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

const idx = buildDrinkNameIndex();

// --- match exacto (sin tildes/mayúsculas) ---
{
  const r = waterLinkForLoggedFood("Agua", 250, idx);
  ok(r !== null && r.aguaMl === 250, `"Agua" 250g: 100% hidratación = 250ml (dio ${r?.aguaMl})`);
}
{
  const r = waterLinkForLoggedFood("agua", 250, idx); // sin mayúscula
  ok(r !== null && r.drink.id === "agua", "normaliza mayúsculas/tildes al buscar");
}

// --- alcohol cuenta mucho menos (efecto diurético real, no 1:1) ---
{
  const r = waterLinkForLoggedFood("Cerveza", 355, idx);
  ok(r !== null && r.aguaMl === Math.round(355 * 0.35), `cerveza 355g: solo 35% hidratación (dio ${r?.aguaMl})`);
  ok(r!.aguaMl < 355, "nunca cuenta 1:1 para alcohol");
}

// --- sin match en el catálogo: no se vincula nada (nunca inventa) ---
{
  ok(waterLinkForLoggedFood("Pechuga de pollo", 150, idx) === null, "un alimento sólido sin match no vincula nada");
}

// --- sin gramos: no se puede calcular ---
{
  ok(waterLinkForLoggedFood("Agua", undefined, idx) === null, "sin gramos registrados: null, no asume un valor");
  ok(waterLinkForLoggedFood("Agua", 0, idx) === null, "0 gramos: null");
}

// --- override de nombre: matchea por el nombre que el usuario le puso ---
{
  const idxRenombrado = buildDrinkNameIndex({ agua: { nombre: "Agüita" } });
  ok(waterLinkForLoggedFood("Agüita", 250, idxRenombrado)?.drink.id === "agua", "matchea por el nombre renombrado por el usuario");
  ok(waterLinkForLoggedFood("Agua", 250, idxRenombrado) === null, "ya no matchea por el nombre viejo tras renombrar");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
