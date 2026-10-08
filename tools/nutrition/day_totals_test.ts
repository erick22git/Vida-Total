// Pruebas del informe del día (totales + cobertura). Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/day_totals_test.ts
import { nutrientDayReport, nutrientTotalsForLoggedFoods } from "../../src/lib/food-utils";
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
const near = (a: number | undefined, b: number, eps = 0.011) => a !== undefined && Math.abs(a - b) <= eps;

const arroz: Food = {
  id: "arroz", nombre: "Arroz", categoria: "Granos", porcion: "100 g", pesoGramos: 100,
  calorias: 360, proteina: 7, carbos: 80, grasas: 0.6, fibra: 1.3, sodio: 5,
  micronutrientes: { hierro: 0.8, calcio: 9 },
  cocido: { calorias: 130, proteina: 2.7, carbos: 28, grasas: 0.3, fibra: 0.4, sodio: 1, micronutrientes: { hierro: 0.2 } },
};
const pollo: Food = { id: "pollo", nombre: "Pollo", categoria: "Proteínas", porcion: "100 g", pesoGramos: 100, calorias: 165, proteina: 31, carbos: 0, grasas: 3.6, sodio: 74 }; // sin fibra ni micros
const nuevo: Food = { id: "nuevo", nombre: "Sin configurar", categoria: "Otros", porcion: "1 unidad", calorias: 0, proteina: 0, carbos: 0, grasas: 0, configurado: false };
const foods = [arroz, pollo, nuevo];

const e = (foodId: string, gramos: number, extra: Partial<LoggedFood> = {}): LoggedFood => ({ id: `${foodId}-${gramos}`, foodId, nombre: foodId, calorias: 0, proteina: 0, carbos: 0, grasas: 0, meal: "almuerzo", timestamp: 0, gramos, ...extra });

// Crudo vs cocido: el mismo alimento aporta distinto según el estado con que se registró.
const crudo = nutrientDayReport([e("arroz", 200, { cookedState: "crudo" })], foods);
const cocido = nutrientDayReport([e("arroz", 200, { cookedState: "cocido" })], foods);
ok(near(crudo.totals.fibra, 2.6) && near(cocido.totals.fibra, 0.8), "fibra: usa el perfil crudo o cocido de la entrada");
ok(near(crudo.totals.hierro, 1.6) && near(cocido.totals.hierro, 0.4), "micronutriente: perfil crudo o cocido");
ok(cocido.totals.calcio === undefined, "el perfil cocido no trae calcio: queda sin dato (no se rellena con el crudo)");

// Cobertura: 3 alimentos, solo el arroz trae fibra y hierro.
const dia = nutrientDayReport([e("arroz", 100, { cookedState: "crudo" }), e("pollo", 150), e("scan-xyz", 100)], foods);
ok(dia.entries === 3, "cuenta los alimentos activos");
ok(dia.coverage.fibra.con === 1 && dia.coverage.fibra.de === 3, "fibra: 1 de 3 con dato");
ok(dia.coverage.sodio.con === 2 && dia.coverage.sodio.de === 3, "sodio: 2 de 3 (el del escáner IA no tiene catálogo)");
ok(near(dia.totals.sodio, 5 + 111), "sodio: suma solo lo que tiene dato");
ok(dia.coverage.hierro.con === 1, "hierro: 1 de 3");

// Un 0 real SÍ es un dato.
const cero: Food = { ...pollo, id: "cero", grasasTrans: 0 };
const r0 = nutrientDayReport([e("cero", 100)], [cero]);
ok(r0.coverage.grasasTrans.con === 1 && r0.totals.grasasTrans === 0, "0 g de trans es un dato válido");

// Faltante nunca es 0 en silencio.
const sinNada = nutrientDayReport([e("pollo", 100)], foods);
ok(sinNada.totals.vitaminaC === undefined && sinNada.coverage.vitaminaC.con === 0, "sin dato de vitamina C: no aparece como 0");
ok(sinNada.totals.alcohol === undefined && sinNada.coverage.alcohol.con === 0, "alcohol: el esquema no lo tiene → sin dato");
ok(sinNada.totals.carbsNetos === undefined, "carbs netos sin fibra → sin dato");

// Alimento sin configurar: cuenta como sin dato.
const sc = nutrientDayReport([e("nuevo", 100)], foods);
ok(sc.coverage.sodio.con === 0 && sc.coverage.sodio.de === 1, "alimento sin configurar → sin dato");

// Carbs netos con fibra.
const cn = nutrientDayReport([e("arroz", 100, { cookedState: "crudo" })], foods);
ok(near(cn.totals.carbsNetos, 80 - 1.3), "carbs netos = carbos − fibra");

// Campos nuevos: alcohol, EPA/DHA, biotina, yodo, cloruro.
const salmon: Food = { id: "salmon", nombre: "Salmón", categoria: "Proteínas", porcion: "100 g", pesoGramos: 100, calorias: 208, proteina: 20, carbos: 0, grasas: 13, epa: 400, dha: 700, micronutrientes: { yodo: 30, biotina: 5 } };
const vino: Food = { id: "vino", nombre: "Vino", categoria: "Bebidas", porcion: "100 ml", pesoGramos: 100, calorias: 83, proteina: 0.1, carbos: 2.6, grasas: 0, alcohol: 10.6 };
const etiqueta: Food = { id: "etiqueta", nombre: "Cápsula", categoria: "Otros", porcion: "1 unidad (1 g)", pesoGramos: 1, calorias: 9, proteina: 0, carbos: 0, grasas: 1, epaDha: 500 };
const f2 = [...foods, salmon, vino, etiqueta];
const nr = nutrientDayReport([e("salmon", 200), e("vino", 150), e("pollo", 100), e("etiqueta", 1)], f2);
ok(near(nr.totals.epa, 800) && nr.coverage.epa.con === 1 && nr.coverage.epa.de === 4, "EPA: 400 mg/100 g × 200 g = 800 mg, 1 de 4 con dato");
ok(near(nr.totals.epaDha, 2200 + 500) && nr.coverage.epaDha.con === 2, "EPA + DHA = suma de EPA y DHA (2200) + el total escrito de la cápsula (500)");
ok(near(nr.totals.alcohol, 15.9) && nr.coverage.alcohol.con === 1, "alcohol: 10.6 g/100 ml × 150 ml");
ok(near(nr.totals.yodo, 60) && near(nr.totals.biotina, 10) && nr.coverage.yodo.con === 1, "yodo y biotina escalados por gramos");
ok(nr.totals.cloruro === undefined && nr.coverage.cloruro.con === 0, "cloruro: ningún alimento lo trae → sin dato (no 0)");
const soloEpa = nutrientDayReport([e("x", 100)], [{ ...pollo, id: "x", epa: 50 }]);
ok(soloEpa.totals.epa === 50 && soloEpa.totals.epaDha === undefined, "solo EPA: el total EPA + DHA queda sin dato");

// Compatibilidad.
ok(near(nutrientTotalsForLoggedFoods([e("arroz", 100, { cookedState: "crudo" })], foods).fibra, 1.3), "nutrientTotalsForLoggedFoods sigue funcionando");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
