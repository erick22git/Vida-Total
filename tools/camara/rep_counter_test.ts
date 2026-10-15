// Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, secciones 2.1.3/2.1.8).
// node tools/3d/verify/run_ts.mjs tools/camara/rep_counter_test.ts
import { initRepCounter, stepRepCounter, type RepCounterState, type RepCounterConfig } from "../../src/lib/camara/rep-counter";
import { CAMERA_EXERCISE_CONFIGS } from "../../src/lib/camara/exercise-configs";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

function run(config: RepCounterConfig, angles: number[]): RepCounterState {
  let state = initRepCounter(config);
  for (const angle of angles) state = stepRepCounter(state, angle, config);
  return state;
}

// --- sentadilla: arranca parado (extended), 1 repetición completa = bajar y volver a subir ---
const squat = CAMERA_EXERCISE_CONFIGS.sentadilla;
{
  const angles = [170, 170, 140, 110, 90, 85, 90, 120, 150, 170, 170];
  const state = run(squat, angles);
  ok(state.reps === 1, `sentadilla: 1 ciclo completo (parado→abajo→parado) cuenta 1 rep (dio ${state.reps})`);
}
{
  // Dos repeticiones seguidas.
  const oneRep = [170, 120, 90, 120, 170];
  const angles = [...oneRep, ...oneRep.slice(1)];
  const state = run(squat, angles);
  ok(state.reps === 2, `sentadilla: dos ciclos completos cuentan 2 reps (dio ${state.reps})`);
}
{
  // Nunca llega a flexionar de verdad (ej. ruido del tracking cerca de "parado") — no debe contar.
  const angles = [170, 165, 170, 162, 170, 168, 170];
  const state = run(squat, angles);
  ok(state.reps === 0, `sentadilla: tiembla cerca de "parado" sin bajar de verdad → 0 reps (dio ${state.reps})`);
}
{
  // Repetición parcial: baja pero no llega al umbral de flexión real (ej. "media sentadilla") — no cuenta como completa.
  const angles = [170, 150, 130, 150, 170];
  const state = run(squat, angles);
  ok(state.reps === 0, `sentadilla: bajada parcial que no llega a flexedThreshold → 0 reps (dio ${state.reps})`);
}

// --- peso muerto: arranca agachado (flexed), 1 repetición completa = subir a lockout y volver a bajar ---
const deadlift = CAMERA_EXERCISE_CONFIGS.peso_muerto;
{
  const angles = [105, 108, 130, 160, 170, 175, 170, 150, 120, 108, 105];
  const state = run(deadlift, angles);
  ok(state.reps === 1, `peso muerto: 1 ciclo completo (agachado→lockout→agachado) cuenta 1 rep (dio ${state.reps})`);
}

// --- initRepCounter valida la config ---
{
  let threw = false;
  try {
    initRepCounter({ extendedThreshold: 90, flexedThreshold: 100, startExtreme: "extended" });
  } catch {
    threw = true;
  }
  ok(threw, "initRepCounter rechaza una config con extendedThreshold <= flexedThreshold");
}

// --- frames con ángulo NaN (landmarks poco confiables) no rompen el conteo ni se pierden como repetición ---
{
  const angles = [170, 120, NaN, NaN, 90, NaN, 120, 170];
  const state = run(squat, angles);
  ok(state.reps === 1, `sentadilla: frames NaN intercalados no impiden contar la repetición real (dio ${state.reps})`);
}

// --- sanity de las 4 configs: extendedThreshold siempre mayor que flexedThreshold ---
for (const [id, config] of Object.entries(CAMERA_EXERCISE_CONFIGS)) {
  ok(config.extendedThreshold > config.flexedThreshold, `${id}: extendedThreshold > flexedThreshold`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
