// Pruebas de las páginas del bloque de nutrientes (altura fija, filas por capacidad, «sin dato»).
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/info_pages_test.ts
import { buildInfoPages, formatInfoValue, rowsThatFit } from "../../src/lib/nutrition/info-pages";
import type { ScaledNutrition } from "../../src/lib/food-utils";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

ok(rowsThatFit(174, 24, 6) === 6, "174 px con filas de 24 y separación 6 → 6 filas");
ok(rowsThatFit(10, 24, 6) === 1, "nunca menos de 1 fila");
ok(rowsThatFit(100, 20, 0) === 5, "sin separación");

const n: ScaledNutrition = { calorias: 130, proteina: 2.7, carbos: 28, grasas: 0.3, fibra: 0.4, sodio: 1 };
const micro = { hierro: 0.2, vitaminaC: 5 };

for (const per of [3, 4, 6, 8]) {
  const pages = buildInfoPages(n, micro, per);
  ok(pages.every((p) => p.rows.length <= per && p.rows.length > 0), `ninguna página pasa de ${per} filas`);
  ok(pages.reduce((s, p) => s + p.rows.length, 0) === 39, `con ${per} filas por página siguen estando las 39 filas`);
  ok(new Set(pages.map((p) => p.id)).size === pages.length, `ids de página únicos (${per})`);
}
ok(buildInfoPages(n, micro, 6).length === 9, "6 filas por página → 9 páginas (los puntos salen de los datos)");
ok(buildInfoPages(n, micro, 4).length === 12, "4 filas por página → 12 páginas");
ok(buildInfoPages(n, micro, 6)[0].rows[0].big === true && buildInfoPages(n, micro, 6)[0].title === "Calorías y macros", "primera página: kcal y macros");

// Orden pedido: macros / grasas / carbos-fibra-sodio / vitaminas liposolubles / B y C / minerales / otros.
const ids = buildInfoPages(n, micro, 6).map((p) => p.id);
ok(ids[0] === "macros" && ids[1] === "grasas" && ids[2] === "carbos" && ids[3] === "vit-liposolubles" && ids[4] === "vit-b-c-1" && ids[ids.length - 1] === "otros", "orden de las páginas");

// «sin dato»: nunca 0 ni se omite.
const todas = buildInfoPages(n, micro, 6).flatMap((p) => p.rows);
const hierro = todas.find((r) => r.key === "hierro")!;
const calcio = todas.find((r) => r.key === "calcio")!;
ok(hierro.value === 0.2 && formatInfoValue(hierro) === "0.2 mg", "con dato: número y unidad");
ok(calcio.value === undefined && formatInfoValue(calcio) === "sin dato", "sin dato → «sin dato», no 0");
ok(todas.find((r) => r.key === "colina") !== undefined && todas.find((r) => r.key === "omega3Ala") !== undefined, "colina y omega-3 están en «Otros»");
const cero = buildInfoPages({ ...n, grasasTrans: 0 }, micro, 6).flatMap((p) => p.rows).find((r) => r.key === "grasasTrans")!;
ok(cero.value === 0 && formatInfoValue(cero) === "0 g", "un 0 real se muestra como 0");
ok(formatInfoValue(todas.find((r) => r.key === "sodio")!, 2300) === "1 mg / 2300mg", "con valor de referencia diario");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
