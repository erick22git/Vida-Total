// Pruebas de kegel-plan.ts (modelo parametrizado). Corre con:
//   node tools/3d/verify/run_ts.mjs tools/3d/verify/kegel_plan_test.ts
import {
  KEGEL_SESSIONS,
  KEGEL_LIMITS,
  LEVEL_DAY_THRESHOLDS,
  MAX_KEGEL_LEVEL,
  suggestedLevel,
  getKegelSession,
  formatDuration,
} from "../../../src/lib/gym/kegel-plan";

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

// ── IDs de sesión retrocompatibles ──────────────────────────────────────────
const ids = KEGEL_SESSIONS.map(s => s.id);
eq("sesion-1 existe", ids.includes("sesion-1"), true);
eq("sesion-2 existe", ids.includes("sesion-2"), true);
eq("sesion-3 existe", ids.includes("sesion-3"), true);
eq("ejercicios existe", ids.includes("ejercicios"), true);
eq("respiracion existe", ids.includes("respiracion"), true);
eq("exactamente 5 sesiones", KEGEL_SESSIONS.length, 5);

// ── Cada sesión tiene ejercicios y fases ─────────────────────────────────────
for (const s of KEGEL_SESSIONS) {
  ok(`${s.id}: tiene exercises`, s.exercises.length > 0);
  ok(`${s.id}: tiene phases`, s.phases.length > 0);
  ok(`${s.id}: durationSec > 0`, s.durationSec > 0);
}

// ── Límites de seguridad en las sesiones ─────────────────────────────────────
for (const s of KEGEL_SESSIONS) {
  for (const ex of s.exercises) {
    ok(`${s.id} squeezeSeconds ≤ 10`, ex.squeezeSeconds <= KEGEL_LIMITS.maxHoldSec);
    ok(`${s.id} reps ≤ 10`, ex.reps <= KEGEL_LIMITS.maxRepsPerSet);
    ok(`${s.id} sets ≤ 6`, ex.sets <= KEGEL_LIMITS.maxSets);
  }
}

// ── Fases válidas ─────────────────────────────────────────────────────────────
for (const s of KEGEL_SESSIONS) {
  for (const p of s.phases) {
    ok(`${s.id} phase.seconds > 0`, p.seconds > 0);
    ok(`${s.id} phase.amp en [0,1]`, p.amp >= 0 && p.amp <= 1);
  }
}

// ── getKegelSession ───────────────────────────────────────────────────────────
eq("getKegelSession sesion-1 devuelve objeto", getKegelSession("sesion-1")?.id, "sesion-1");
eq("getKegelSession inexistente → undefined", getKegelSession("no-existe"), undefined);

// ── formatDuration ────────────────────────────────────────────────────────────
eq("formatDuration 0", formatDuration(0), "0 sec");
eq("formatDuration 30s", formatDuration(30), "30 sec");
eq("formatDuration 60s", formatDuration(60), "1 min");
eq("formatDuration 90s", formatDuration(90), "1 min 30 sec");
eq("formatDuration 240s", formatDuration(240), "4 min");

// ── suggestedLevel ────────────────────────────────────────────────────────────
eq("0 días → nivel 1", suggestedLevel(0), 1);
eq("6 días → nivel 1 (umbral 7)", suggestedLevel(6), 1);
eq("7 días → nivel 2", suggestedLevel(7), 2);
eq("20 días → nivel 2", suggestedLevel(20), 2);
eq("21 días → nivel 3", suggestedLevel(21), 3);
eq("42 días → nivel 4", suggestedLevel(42), 4);
eq("314 días → nivel 9 (umbral 315 para nivel 10)", suggestedLevel(314), 9);
eq("315 días → nivel 10", suggestedLevel(315), 10);
eq("999 días → máximo 10", suggestedLevel(999), MAX_KEGEL_LEVEL);

// ── Umbrales crecientes ───────────────────────────────────────────────────────
for (let i = 1; i < LEVEL_DAY_THRESHOLDS.length; i++) {
  ok(`umbral[${i}] > umbral[${i-1}]`, LEVEL_DAY_THRESHOLDS[i] > LEVEL_DAY_THRESHOLDS[i - 1]);
}

console.log(fails ? `\n${fails} FALLAS` : "\nTODO OK");
process.exit(fails ? 1 : 0);
