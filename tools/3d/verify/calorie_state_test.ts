// Prueba de calorie-state.ts: debe reproducir EXACTAMENTE lo que el arco calculaba antes del refactor.
// Se corre con: node tools/3d/verify/run_ts.mjs tools/3d/verify/calorie_state_test.ts
import { arcSegments, calorieFillFraction, calorieRange, calorieSmoothColor, calorieState, RANGE_COLORS } from "../../../src/lib/gym/calorie-state";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `${JSON.stringify(got)} esperado ${JSON.stringify(want)}`);
}

// ---- COPIA LITERAL del cálculo que tenía calorie-arc-visual.tsx antes del refactor (referencia dorada) ----
function oldFill(value: number, low: number, high: number): number {
  if (value <= 0) return 0;
  if (value <= low) return low > 0 ? (value / low) * 0.3 : 0.3;
  if (value <= high) return 0.3 + ((value - low) / (high - low || 1)) * 0.4;
  const veryHigh = high + (high - low || high);
  if (value <= veryHigh) return 0.7 + ((value - high) / (veryHigh - high || 1)) * 0.3;
  return 1;
}
const oldLens = (fraction: number) => ({
  yellow: Math.max(0, Math.min(fraction, 0.3)),
  green: Math.max(0, Math.min(fraction - 0.3, 0.4)),
  red: Math.max(0, Math.min(fraction - 0.7, 0.3)),
});

// 1) Mismos números que el arco, para muchas metas y consumos (incluye bordes exactos)
let same = true;
let mism = "";
for (const goal of [1200, 1500, 1800, 2000, 2137, 2500, 3200, 4000]) {
  const lowOld = Math.round(goal * 0.9);
  const highOld = Math.round(goal * 1.1);
  const r = calorieRange(goal);
  if (r.low !== lowOld || r.high !== highOld) { same = false; mism = `rango ${goal}`; }
  for (let kcal = -50; kcal <= goal * 2.5; kcal += 7) {
    const a = calorieFillFraction(kcal, lowOld, highOld);
    const b = oldFill(kcal, lowOld, highOld);
    const s = calorieState(kcal, goal);
    const segOld = oldLens(b);
    const segNew = arcSegments(s.arcFraction);
    if (a !== b || s.arcFraction !== b || JSON.stringify(segOld) !== JSON.stringify(segNew) || s.over !== kcal > highOld) {
      same = false; mism = `goal ${goal} kcal ${kcal}`;
    }
  }
  for (const kcal of [0, lowOld - 1, lowOld, goal, highOld, highOld + 1]) {
    const s = calorieState(kcal, goal);
    if (s.over !== kcal > highOld || s.arcFraction !== oldFill(kcal, lowOld, highOld)) { same = false; mism = `borde ${goal}/${kcal}`; }
  }
}
eq("idéntico al arco original (8 metas × todo el rango de consumo)", [same, mism], [true, ""]);

// 2) Estados y colores según la meta (no kcal fijas)
const st = (kcal: number, goal: number) => calorieState(kcal, goal).status;
eq("0 kcal = vacío", st(0, 2000), "vacio");
eq("bajo el mínimo = bajo (amarillo)", st(1000, 2000), "bajo");
eq("justo en el mínimo = en rango", st(1800, 2000), "enRango");
eq("meta alcanzada = en rango (verde)", st(2000, 2000), "enRango");
eq("en el máximo = en rango", st(2200, 2000), "enRango");
eq("pasado el máximo = sobre (rojo)", st(2201, 2000), "sobre");
eq("los mismos porcentajes con otra meta (1500)", [st(0, 1500), st(750, 1500), st(1500, 1500), st(1651, 1500)], ["vacio", "bajo", "enRango", "sobre"]);
eq("color del estado", [calorieState(0, 2000).color, calorieState(1000, 2000).color, calorieState(2000, 2000).color, calorieState(2500, 2000).color], [RANGE_COLORS.vacio, RANGE_COLORS.bajo, RANGE_COLORS.enRango, RANGE_COLORS.sobre]);

// 3) Nivel del recipiente: kcal / meta, topado
eq("nivel 0 / 25 / 50 / 100 % / exceso", [0, 500, 1000, 2000, 3000].map((k) => calorieState(k, 2000).level), [0, 0.25, 0.5, 1, 1]);
eq("meta 0 no rompe", [calorieState(500, 0).level, calorieState(500, 0).percentOfGoal], [0, 0]);

// 4) Color continuo: extremos = colores del estado, en medio se mezcla sin saltos
eq("suave: vacío/bajo/sobre coinciden con la paleta", [calorieSmoothColor(0, 1800, 2200), calorieSmoothColor(900, 1800, 2200), calorieSmoothColor(2300, 1800, 2200)], [RANGE_COLORS.vacio, RANGE_COLORS.bajo, RANGE_COLORS.sobre]);
eq("suave: en la meta ya es verde", calorieSmoothColor(2000, 1800, 2200), RANGE_COLORS.enRango);
eq("suave: al entrar al rango empieza amarillo", calorieSmoothColor(1800, 1800, 2200), RANGE_COLORS.bajo);
const mid = calorieSmoothColor(1900, 1800, 2200);
eq("suave: a mitad de camino es intermedio", mid !== RANGE_COLORS.bajo && mid !== RANGE_COLORS.enRango, true);
let maxJump = 0;
let prev = calorieSmoothColor(1800, 1800, 2200);
const dist = (a: string, b: string) => [16, 8, 0].reduce((s, sh) => s + Math.abs(((parseInt(a.slice(1), 16) >> sh) & 255) - ((parseInt(b.slice(1), 16) >> sh) & 255)), 0);
for (let k = 1801; k <= 2200; k++) { const c = calorieSmoothColor(k, 1800, 2200); maxJump = Math.max(maxJump, dist(prev, c)); prev = c; }
eq("suave: sin saltos bruscos dentro del rango (<= 8 por kcal)", maxJump <= 8, true);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
