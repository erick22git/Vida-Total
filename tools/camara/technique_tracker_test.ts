// Fase E del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md).
// node tools/3d/verify/run_ts.mjs tools/camara/technique_tracker_test.ts
import { nextShallowRepStreak, shouldSuggestTechniqueNote, SHALLOW_REP_STREAK_THRESHOLD } from "../../src/lib/camara/technique-tracker";
import { initRepCounter, stepRepCounter, type RepCounterState } from "../../src/lib/camara/rep-counter";
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

const squat = CAMERA_EXERCISE_CONFIGS.sentadilla;
const deadlift = CAMERA_EXERCISE_CONFIGS.peso_muerto;

/** Corre una secuencia de ángulos y devuelve la racha final de repeticiones flojas. */
function runStreak(config = squat, angles: number[]): number {
  let state = initRepCounter(config);
  let streak = 0;
  for (const angle of angles) {
    const next = stepRepCounter(state, angle, config);
    streak = nextShallowRepStreak(state, next, config, streak);
    state = next;
  }
  return streak;
}

// --- 1 sentadilla profunda completa: no suma racha ---
ok(runStreak(squat, [170, 120, 90, 120, 170]) === 0, "1 sentadilla profunda completa: racha en 0");

// --- 1 sentadilla parcial (nunca llega a 100°): suma 1 a la racha ---
ok(runStreak(squat, [170, 150, 130, 150, 170]) === 1, "1 sentadilla parcial: racha sube a 1");

// --- 2 sentadillas parciales seguidas: racha en 2, ya alcanza el umbral de aviso ---
{
  const partial = [170, 150, 130, 150, 170];
  const streak = runStreak(squat, [...partial, ...partial.slice(1)]);
  ok(streak === 2, `2 parciales seguidas: racha en 2 (dio ${streak})`);
  ok(shouldSuggestTechniqueNote(streak), "racha de 2 alcanza el umbral de sugerencia");
}

// --- parcial, luego una buena: la buena reinicia la racha a 0 ---
{
  const partial = [170, 150, 130, 150, 170];
  const good = [120, 90, 120, 170];
  const streak = runStreak(squat, [...partial, ...good]);
  ok(streak === 0, `parcial seguida de una buena: la racha vuelve a 0 (dio ${streak})`);
}

// --- por debajo del umbral no sugiere nada ---
ok(!shouldSuggestTechniqueNote(SHALLOW_REP_STREAK_THRESHOLD - 1), "una racha por debajo del umbral no sugiere la nota");
ok(shouldSuggestTechniqueNote(SHALLOW_REP_STREAK_THRESHOLD), "la racha EN el umbral sí sugiere");

// --- peso muerto: hasFormValidation false, la racha nunca avanza aunque "parezca" floja ---
{
  const neverReachesLockout = [105, 120, 140, 120, 105, 120, 140, 120, 105];
  const streak = runStreak(deadlift, neverReachesLockout);
  ok(streak === 0, "peso muerto: sin fuente para juzgar forma, la racha se queda en 0 siempre");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
