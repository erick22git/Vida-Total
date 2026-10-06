// Pruebas del motor de sesión Kegel (lógica pura). Corre con:
//   node tools/3d/verify/run_ts.mjs tools/3d/verify/kegel_engine_test.ts
import { buildSteps, stateFromElapsed, PREPARE_SEC } from "../../../src/lib/gym/kegel-engine";
import { getKegelSession } from "../../../src/lib/gym/kegel-plan";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "ok   " : "FALLA", name, ok ? "" : `  got=${JSON.stringify(got)}  want=${JSON.stringify(want)}`);
}
function ok(name: string, cond: boolean) {
  if (!cond) fails++;
  console.log(cond ? "ok   " : "FALLA", name);
}

// ── sesion-1 (solo L1_RAPID: reps=10, squeeze=1s, relax=1s, sets=3, rest=10s) ──
const def1 = getKegelSession("sesion-1")!;
const steps1 = buildSteps(def1);

// Primer paso siempre es prepare
eq("primer paso = prepare", steps1[0].phase, "prepare");
eq("prepare duration = 3s", steps1[0].duration, PREPARE_SEC);

// Total pasos: prepare + 3 sets × (10 reps × 2 fases) + 2 descansos entre sets
// = 1 + 60 + 2 = 63
eq("steps count sesion-1", steps1.length, 63);

// Orden de fases: prepare, squeeze, relax, squeeze, relax, ...
eq("steps[1].phase = squeeze", steps1[1].phase, "squeeze");
eq("steps[2].phase = relax", steps1[2].phase, "relax");
eq("steps[3].phase = squeeze", steps1[3].phase, "squeeze");

// Último paso antes de done es relax (sin rest después del último set)
const lastStep = steps1[steps1.length - 1];
eq("último step = relax", lastStep.phase, "relax");

// ── stateFromElapsed ──────────────────────────────────────────────────────────

// t=0: fase prepare
const s0 = stateFromElapsed(steps1, 0);
eq("t=0: prepare", s0.phase, "prepare");
eq("t=0: phaseElapsed=0", s0.phaseElapsed, 0);

// t=2: todavía en prepare
const s2 = stateFromElapsed(steps1, 2);
eq("t=2: prepare", s2.phase, "prepare");
eq("t=2: phaseElapsed=2", s2.phaseElapsed, 2);

// t=3: primer squeeze (el PREPARE_SEC se consume exactamente)
const s3 = stateFromElapsed(steps1, PREPARE_SEC);
eq("t=3: squeeze", s3.phase, "squeeze");
eq("t=3: exerciseIndex=0", s3.exerciseIndex, 0);
eq("t=3: setIndex=0", s3.setIndex, 0);
eq("t=3: repIndex=0", s3.repIndex, 0);

// t=4: primer relax
const s4 = stateFromElapsed(steps1, PREPARE_SEC + 1);
eq("t=4: relax", s4.phase, "relax");

// t=23: después de 10 reps set 0 (10×2=20s) entra en rest
const afterSet0 = PREPARE_SEC + 20;
const sRest = stateFromElapsed(steps1, afterSet0);
eq("después de set 0: rest", sRest.phase, "rest");
eq("rest setIndex=0", sRest.setIndex, 0);

// t=33: tras rest (10s) empieza set 1
const afterRest1 = afterSet0 + 10;
const sSet1 = stateFromElapsed(steps1, afterRest1);
eq("tras rest1: squeeze setIndex=1", sSet1.phase, "squeeze");
eq("set1 correcto", sSet1.setIndex, 1);

// done: pasado el total
const totalDur = steps1.reduce((a, s) => a + s.duration, 0);
const sDone = stateFromElapsed(steps1, totalDur + 1);
eq("pasado el total: done", sDone.phase, "done");

// ── Orden de fases completo ───────────────────────────────────────────────────
const phases = steps1.map(s => s.phase);
// No debe haber dos rest consecutivos
for (let i = 0; i < phases.length - 1; i++) {
  if (phases[i] === "rest") {
    ok(`no rest consecutivo en step ${i}`, phases[i + 1] !== "rest");
  }
}

// El prepare solo debe aparecer una vez (al principio)
eq("prepare solo una vez", phases.filter(p => p === "prepare").length, 1);
eq("prepare es el primero", phases[0], "prepare");

// ── sesion con múltiples ejercicios (sesion-3) ────────────────────────────────
const def3 = getKegelSession("sesion-3")!;
const steps3 = buildSteps(def3);
ok("sesion-3 tiene más steps que sesion-1 (2 ejercicios)", steps3.length > steps1.length);

// ── activeSeconds solo cuenta squeeze+relax ───────────────────────────────────
const sAt3 = stateFromElapsed(steps1, PREPARE_SEC);
eq("activeSeconds en squeeze 0: 0 (no hay squeeze completo)", sAt3.activeSeconds, 0);

const sAt4 = stateFromElapsed(steps1, PREPARE_SEC + 1);
eq("activeSeconds tras 1s de squeeze: 1", sAt4.activeSeconds, 1);

const sAt5 = stateFromElapsed(steps1, PREPARE_SEC + 2);
eq("activeSeconds tras squeeze+relax (2s): 2", sAt5.activeSeconds, 2);

const sAtRest = stateFromElapsed(steps1, afterSet0);
eq("activeSeconds no cuenta rest", sAtRest.activeSeconds, 20);

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
