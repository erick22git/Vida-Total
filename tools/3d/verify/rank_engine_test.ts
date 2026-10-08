// Prueba de rank-engine.ts (1RM, percentiles, rangos y agregación). Se corre con:
//   node tools/3d/verify/run_ts.mjs tools/3d/verify/rank_engine_test.ts
import {
  anchorsFor,
  computeRankProfile,
  estimate1RM,
  MAX_STEP,
  missingBodyInfo,
  normCdf,
  normInv,
  percentileToValue,
  rankExercise,
  rankFromPercentile,
  rankFromValue,
  rankFromScore,
  standardForExercise,
  valueToPercentile,
  weightForOneRepMax,
} from "../../../src/lib/gym/rank-engine";
import { STANDARDS, DIRECT, DERIVED } from "../../../src/lib/gym/rank-standards";
import { RANK_TIER_DEFS } from "../../../src/lib/gym/rank-config";
import type { WorkoutSession } from "../../../src/lib/types";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `${JSON.stringify(got)} esperado ${JSON.stringify(want)}`);
}
function near(name: string, got: number, want: number, tol: number) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `${got} esperado ${want} ±${tol}`);
}

function session(exerciseId: string, sets: { peso: number; reps: number; tipo?: string; completado?: boolean }[]): WorkoutSession {
  return {
    id: "s-" + Math.random(),
    fecha: "2026-10-01T10:00:00.000Z",
    ejercicios: [
      {
        exerciseId,
        sets: sets.map((s, i) => ({ id: "x" + i, peso: s.peso, reps: s.reps, completado: s.completado ?? true, fallo: false, tipo: (s.tipo ?? "normal") as never })),
      },
    ],
  } as unknown as WorkoutSession;
}

// 1) Normal estándar
near("normInv(0.5)", normInv(0.5), 0, 1e-9);
near("normInv(0.975)", normInv(0.975), 1.959964, 1e-5);
near("normCdf(1.644854)", normCdf(1.644854), 0.95, 1e-4);
near("ida y vuelta 0.2", normCdf(normInv(0.2)), 0.2, 1e-6);

// 2) Epley con tope de reps
near("Epley 100x10", estimate1RM(100, 10).value, 133.333, 0.01);
eq("Epley 1 rep = el peso", estimate1RM(100, 1).value, 100);
eq("Epley 12 reps no está topada", estimate1RM(100, 12).capped, false);
eq("Epley 20 reps está topada", estimate1RM(100, 20).capped, true);
eq("Epley 20 reps usa 12", estimate1RM(100, 20).value, estimate1RM(100, 12).value);
eq("Epley sin peso o sin reps = 0", [estimate1RM(0, 10).value, estimate1RM(50, 0).value], [0, 0]);
near("inversa de Epley", weightForOneRepMax(133.333, 10), 100, 0.01);

// 3) Estándares: interpolación por peso corporal
eq("press de banca, hombre 80 kg = fila de la tabla", anchorsFor(STANDARDS.bench, "hombre", 80).map(Math.round), [56, 75, 98, 124, 151]);
const a70 = anchorsFor(STANDARDS.bench, "hombre", 70);
eq("hombre 70 kg queda entre las filas de 60 y 80", a70.every((v, i) => v > STANDARDS.bench.hombre[0][1][i] && v < STANDARDS.bench.hombre[1][1][i]), true);
eq("hombre 40 kg (fuera de tabla) usa el cociente de 60 kg", Math.round(anchorsFor(STANDARDS.bench, "hombre", 40)[2]), Math.round((72 / 60) * 40));
eq("dominadas (reps) hombre 80 kg", anchorsFor(STANDARDS["pull-ups"], "hombre", 80), [1, 7, 13, 21, 29]);

// 4) Percentiles: en cada ancla vale 5/20/50/80/95 y es monótono
const anchors = anchorsFor(STANDARDS.squat, "hombre", 80);
[5, 20, 50, 80, 95].forEach((p, i) => near(`sentadilla P${p} -> percentil ${p}`, valueToPercentile(anchors[i], anchors), p, 0.05));
let prev = -1;
let mono = true;
for (let v = 0; v <= 320; v += 5) {
  const p = valueToPercentile(v, anchors);
  if (p < prev) mono = false;
  prev = p;
}
eq("percentil crece con el peso levantado", mono, true);
near("inversa: percentil 80 -> valor de la ancla", percentileToValue(80, anchors), anchors[3], 0.05);
eq("peso enorme no pasa de 99,9 %", valueToPercentile(2000, anchors) < 100, true);

// 5) Percentil -> rango y nivel
const lbl = (p: number) => rankFromPercentile(p).label;
eq("percentil 0 = HIERRO I", lbl(0), "HIERRO I");
eq("percentil 20 = HIERRO III", lbl(20), "HIERRO III");
eq("percentil 21 = COBRE I", lbl(21), "COBRE I");
eq("percentil 50 = PLATA II", lbl(50), "PLATA II");
eq("percentil 80 = ZAFIRO II", lbl(80), "ZAFIRO II");
eq("percentil 69 = ESMERALDA I", lbl(69), "ESMERALDA I");
eq("percentil 89 = DIAMANTE I", lbl(89), "DIAMANTE I");
eq("percentil 95 = CAMPEÓN I", lbl(95), "CAMPEÓN I");
eq("percentil 99 = SIMÉTRICO (sin niveles)", lbl(99), "SIMÉTRICO");
eq("Simétrico no tiene nivel", rankFromPercentile(99.5).level, null);
let stepsOk = true;
let last = -1;
for (let p = 0; p < 100; p += 0.5) {
  const s = rankFromPercentile(p).step;
  if (s < last) stepsOk = false;
  last = s;
}
eq("el escalón nunca baja al subir el percentil", stepsOk, true);
eq("10 rangos, 28 escalones (27 + Simétrico)", [RANK_TIER_DEFS.length, MAX_STEP + 1], [10, 28]);
eq("rankFromScore(0) = HIERRO I", rankFromScore(0).label, "HIERRO I");
eq("rankFromScore(27) = SIMÉTRICO", rankFromScore(27).label, "SIMÉTRICO");
eq("rankFromScore(8.5) = PLATA III", rankFromScore(8.5).label, "PLATA III");

// 6) Un ejercicio completo
const male80 = { sexo: "hombre" as const, pesoKg: 80 };
const female65 = { sexo: "mujer" as const, pesoKg: 65 };
const bench = rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 100, reps: 5 }])], male80)!;
near("banca 100x5 (1RM 116.7) está entre P50 y P80", bench.rank.percentile, 66, 12);
eq("banca no es estimado", bench.estimated, false);
eq("banca tiene siguiente nivel con peso faltante > 0", bench.next !== null && bench.next.missing > 0, true);
const benchF = rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 100, reps: 5 }])], female65)!;
eq("la misma marca vale más rango en mujer 65 kg que en hombre 80 kg", benchF.rank.step > bench.rank.step, true);
eq("press cerrado es estimado", standardForExercise("press-cerrado")?.estimated, true);
eq("ejercicio sin estándar no tiene rango", rankExercise("plancha", [session("plancha", [{ peso: 0, reps: 60 }])], male80), null);
eq("calentamiento no cuenta", rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 100, reps: 5, tipo: "calentamiento" }])], male80), null);
eq("serie sin completar no cuenta", rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 100, reps: 5, completado: false }])], male80), null);
const pull = rankExercise("dominadas", [session("dominadas", [{ peso: 0, reps: 13 }])], male80)!;
near("dominadas 13 reps (hombre 80) = P50", pull.rank.percentile, 50, 0.5);
eq("dominadas es de repeticiones", pull.kind, "reps");
const capped = rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 60, reps: 20 }])], male80)!;
eq("20 reps se marca como estimación topada", capped.performance.capped, true);

// 6b) La calculadora usa el mismo cálculo que el historial
const calc = rankFromValue(standardForExercise("press-banca-barra")!, estimate1RM(100, 5).value, male80);
eq("calculadora == historial (banca 100x5)", calc.rank.label, bench.rank.label);
eq("calculadora: siguiente nivel igual", calc.next?.label, bench.next?.label);

// 7) Agregación: músculo = promedio de sus 3 mejores; grupo = músculos con datos; sin datos = null
const exercises = [
  { id: "press-banca-barra", categoria: "Pecho" },
  { id: "press-inclinado-barra", categoria: "Pecho" },
  { id: "aperturas-mancuernas", categoria: "Pecho" },
  { id: "flexiones", categoria: "Pecho" },
  { id: "dominadas", categoria: "Espalda" },
  { id: "cinta-correr", categoria: "Cardio" },
  { id: "plancha", categoria: "Abdomen" },
];
const sessions = [
  session("press-banca-barra", [{ peso: 100, reps: 5 }]),
  session("press-inclinado-barra", [{ peso: 40, reps: 8 }]),
  session("aperturas-mancuernas", [{ peso: 8, reps: 10 }]),
  session("flexiones", [{ peso: 0, reps: 40 }]),
];
const prof = computeRankProfile({ exercises, sessions, body: male80 });
eq("ejercicios con rango", Object.keys(prof.byExercise).sort(), ["aperturas-mancuernas", "flexiones", "press-banca-barra", "press-inclinado-barra"]);
const top3 = ["press-banca-barra", "press-inclinado-barra", "aperturas-mancuernas", "flexiones"]
  .map((id) => prof.byExercise[id].rank.score)
  .sort((a, b) => b - a)
  .slice(0, 3);
near("Pecho = promedio de sus 3 mejores", prof.byMuscle.Pecho.rank!.score, top3.reduce((a, b) => a + b, 0) / 3, 1e-9);
eq("Espalda sin datos = null (gris)", prof.byMuscle.Espalda.rank, null);
eq("Abdomen sin datos = null", prof.byMuscle.Abdomen.rank, null);
eq("Cardio no cuenta como músculo", "Cardio" in prof.byMuscle, false);
near("grupo Pecho = rango del músculo Pecho", prof.byGroup.pecho.rank!.score, prof.byMuscle.Pecho.rank!.score, 1e-9);
eq("grupo Espalda sin datos = null", prof.byGroup.espalda.rank, null);
near("general = promedio de grupos con datos (solo Pecho)", prof.general.rank!.score, prof.byGroup.pecho.rank!.score, 1e-9);
const excl = computeRankProfile({ exercises, sessions, body: male80, excluded: ["press-banca-barra", "press-inclinado-barra", "aperturas-mancuernas", "flexiones"] });
eq("si se excluyen todos, el músculo queda sin rango pero el ejercicio conserva el suyo", [excl.byMuscle.Pecho.rank, !!excl.byExercise["press-banca-barra"]], [null, true]);

// 8) Datos: todos los ids referenciados existen
eq("DIRECT apunta solo a estándares existentes", Object.values(DIRECT).every((id) => STANDARDS[id]), true);
eq("DERIVED apunta solo a estándares existentes", Object.values(DERIVED).every((d) => STANDARDS[d.base] && d.factor > 0), true);
eq("cada estándar crece de P5 a P95", Object.values(STANDARDS).every((s) => [...s.hombre, ...s.mujer].every(([, f]) => f.every((v, i) => i === 0 || v >= f[i - 1]))), true);
eq("faltan sexo y peso", missingBodyInfo({}), ["sexo", "peso"]);
eq("solo falta el peso", missingBodyInfo({ sexo: "hombre" }), ["peso"]);
eq("no falta nada", missingBodyInfo({ sexo: "mujer", pesoKg: 60 }), []);

// TODO (documentado, no bloquea nada): chequeo de cordura con datos reales del usuario. Cuando existan:
//   - press de pecho 60 kg x 10 -> Esmeralda II en otra app (1RM Epley 80 kg)
//   - peso muerto 100 kg x 10 -> Diamante I en otra app (1RM Epley 133 kg)
//   Falta su peso corporal y el ejercicio exacto de peso muerto. Con esos datos agregar:
//   const r = rankExercise("press-banca-barra", [session("press-banca-barra", [{ peso: 60, reps: 10 }])], { sexo: "hombre", pesoKg: <PESO> });
//   y comparar `r.rank.label` con "ESMERALDA II" SOLO como orden de magnitud (otra app usa otras tablas).

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLA(S)`);
process.exit(fails === 0 ? 0 : 1);
