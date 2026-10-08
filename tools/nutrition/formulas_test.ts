// Fórmulas de la meta calórica contra lo PUBLICADO. No cambia ninguna cifra: deja por escrito qué coincide y qué difiere.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/nutrition/formulas_test.ts
import { ACTIVITY_LEVELS, GOAL_INTENSITY_PRESETS, calcBMRKatchMcArdle, calcBMRMifflin, calcCalorieGoal } from "../../src/lib/gym/calorie-calc";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// ── Mifflin y cols., Am J Clin Nutr 1990;51:241-7 ─────────────────────────────
// Ecuación general del resumen: 9,99 W + 6,25 H − 4,92 A + 166 S − 161 (S = 1 hombre, 0 mujer).
const general = (sexo: "hombre" | "mujer", w: number, h: number, a: number) => 9.99 * w + 6.25 * h - 4.92 * a + 166 * (sexo === "hombre" ? 1 : 0) - 161;
ok(calcBMRMifflin("hombre", 80, 180, 30) === 1780, "hombre 80 kg, 180 cm, 30 años: 10·80 + 6,25·180 − 5·30 + 5 = 1780");
ok(near(calcBMRMifflin("mujer", 60, 165, 28), 1330.25, 0.001), "mujer 60 kg, 165 cm, 28 años: 1330,25");
// La versión por sexo del propio artículo (10 / 5) difiere de la general (9,99 / 4,92) en pocas kcal.
let maxDiff = 0;
for (const sexo of ["hombre", "mujer"] as const) for (const w of [45, 60, 80, 110]) for (const h of [150, 170, 190]) for (const a of [19, 30, 50, 78]) maxDiff = Math.max(maxDiff, Math.abs(calcBMRMifflin(sexo, w, h, a) - general(sexo, w, h, a)));
ok(maxDiff < 6, `la ecuación por sexo y la general del artículo difieren menos de 6 kcal/día (máx. ${maxDiff.toFixed(1)})`);

// ── Cunningham, Am J Clin Nutr 1991;54:963-9: REE = 370 + 21,6 × FFM ───────────────
ok(near(calcBMRKatchMcArdle(80, 20), 370 + 21.6 * 64, 0.001), "80 kg con 20 % de grasa: 370 + 21,6 × 64 = 1752,4");
ok(near(calcBMRKatchMcArdle(70, 0), 370 + 21.6 * 70, 0.001), "sin grasa: toda la masa es magra");
// La ecuación anterior (Cunningham 1980) era otra: 500 + 22 × LBM. Difiere de la que usa la app.
ok(near(500 + 22 * 64 - calcBMRKatchMcArdle(80, 20), 1908 - 1752.4, 0.001), "Cunningham 1980 (500 + 22·LBM) da +155,6 kcal más que la 1991 para 64 kg de masa magra");

// ── Factores de actividad: CONVENCIÓN, no FAO/OMS ─────────────────────────────
const factors = ACTIVITY_LEVELS.map((a) => a.multiplier);
ok(JSON.stringify(factors) === JSON.stringify([1.2, 1.375, 1.55, 1.725, 1.9]), "factores actuales: 1,2 · 1,375 · 1,55 · 1,725 · 1,9 (convención clásica)");
// FAO/OMS/UNU 2001, Tabla 5.3: PAL sedentario o ligero 1,40–1,69 · activo 1,70–1,99 · vigoroso 2,00–2,40.
const FAO = [
  { nombre: "sedentario o ligero", min: 1.4, max: 1.69 },
  { nombre: "activo o moderadamente activo", min: 1.7, max: 1.99 },
  { nombre: "vigoroso", min: 2.0, max: 2.4 },
];
ok(factors[0] < FAO[0].min && near(FAO[0].min / factors[0] - 1, 0.1667, 0.001), "el mínimo FAO (1,40) es 16,7 % mayor que el «sedentario» de la app (1,2)");
ok(factors[1] < FAO[0].min && factors[2] >= FAO[0].min && factors[2] <= FAO[0].max, "«moderado» (1,55) cae en el rango FAO de sedentario o ligero, no en el de moderado");
ok(factors[3] >= FAO[1].min && factors[3] <= FAO[1].max && factors[4] >= FAO[1].min && factors[4] <= FAO[1].max, "«intenso» (1,725) y «muy intenso» (1,9) caen en el rango FAO de activo");
ok(factors[4] < FAO[2].min, "ningún factor llega al rango FAO de vigoroso (≥ 2,00)");

// ── Déficit y superávit: convención ─────────────────────────────────────────
ok(JSON.stringify(GOAL_INTENSITY_PRESETS.perder.map((p) => p.pct)) === JSON.stringify([-0.1, -0.2, -0.25]), "perder: −10 / −20 / −25 %");
ok(JSON.stringify(GOAL_INTENSITY_PRESETS.ganar.map((p) => p.pct)) === JSON.stringify([0.1, 0.15, 0.2]), "ganar: +10 / +15 / +20 %");
ok(JSON.stringify(GOAL_INTENSITY_PRESETS.mantener.map((p) => p.pct)) === JSON.stringify([0, -0.05]), "mantener: 0 / −5 %");

// Meta completa (ejemplo): hombre 80 kg, 180 cm, 30 años, moderado, perder moderado.
const r = calcCalorieGoal({ sexo: "hombre", pesoKg: 80, alturaCm: 180, edad: 30, nivelActividad: "moderado", objetivoCalorico: "perder", intensidadObjetivo: "moderado" });
ok(r.bmr === 1780 && near(r.tdee, 1780 * 1.55, 0.001) && r.calorieGoal === Math.round(1780 * 1.55 * 0.8), "ejemplo completo: BMR 1780 → TDEE 2759 → meta 2207");

console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
