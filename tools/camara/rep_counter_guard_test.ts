// Arreglo del conteo de reps (roadmap sección 3.1/3.6). node tools/3d/verify/run_ts.mjs tools/camara/rep_counter_guard_test.ts
import { initGuardedRepCounter, stepGuardedRepCounter } from "../../src/lib/camara/rep-counter-guard";
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

// --- una repetición normal, con tiempo de sobra entre frames: cuenta igual que el core sin guard ---
{
  let state = initGuardedRepCounter(squat);
  let t = 0;
  for (const angle of [170, 120, 90, 120, 170]) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500);
    t += 300; // 300ms entre frames, bien espaciado
  }
  ok(state.core.reps === 1, `repetición normal espaciada en el tiempo: cuenta 1 (dio ${state.core.reps})`);
}

// --- dos repeticiones "contadas" en una fracción de segundo (el bug reportado): la segunda NO cuenta ---
{
  let state = initGuardedRepCounter(squat);
  const fastRep = [170, 120, 90, 120, 170];
  let t = 0;
  for (const angle of fastRep) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500);
    t += 20; // 20ms entre frames: la "repetición" completa en 80ms, fisicamente imposible
  }
  for (const angle of fastRep.slice(1)) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500);
    t += 20;
  }
  ok(state.core.reps === 1, `dos ciclos completos en <500ms: solo se cuenta 1 (ruido rápido no duplica el conteo, dio ${state.core.reps})`);
}

// --- la PRIMERA repetición siempre cuenta (no hay una anterior contra la que compararla), pero una
//     segunda pegada inmediatamente después sí se rechaza, y una tercera bien espaciada ya cuenta ---
{
  let state = initGuardedRepCounter(squat);
  state = stepGuardedRepCounter(state, 170, squat, 0, 500);
  state = stepGuardedRepCounter(state, 120, squat, 20, 500);
  state = stepGuardedRepCounter(state, 90, squat, 40, 500);
  state = stepGuardedRepCounter(state, 120, squat, 60, 500);
  state = stepGuardedRepCounter(state, 170, squat, 80, 500); // primera rep: sin referencia previa, cuenta
  ok(state.core.reps === 1, `primera repetición (sin referencia previa): cuenta igual (dio ${state.core.reps})`);

  // Pegada inmediatamente después (90ms), misma oscilación rápida: no cuenta.
  state = stepGuardedRepCounter(state, 120, squat, 90, 500);
  state = stepGuardedRepCounter(state, 90, squat, 120, 500);
  state = stepGuardedRepCounter(state, 120, squat, 150, 500);
  state = stepGuardedRepCounter(state, 170, squat, 170, 500);
  ok(state.core.reps === 1, `segunda rep pegada a la primera (ruido rápido): se rechaza, sigue en 1 (dio ${state.core.reps})`);

  // Una repetición real, bien espaciada en el tiempo, sí vuelve a contar.
  let t = 1000;
  for (const angle of [120, 90, 120, 170]) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500);
    t += 300;
  }
  ok(state.core.reps === 2, `repetición real posterior, bien espaciada, sí cuenta (dio ${state.core.reps})`);
}

// --- ventana de arranque: una repetición completa DENTRO de la ventana no cuenta, pero la fase
//     se respeta igual (no queda "trabado" en un estado inconsistente) ---
{
  let state = initGuardedRepCounter(squat);
  const graceEndAt = 1500;
  let t = 0;
  for (const angle of [170, 120, 90, 120, 170]) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500, graceEndAt);
    t += 300;
  }
  ok(state.core.reps === 0, `repetición completa DENTRO de la ventana de arranque: no cuenta (dio ${state.core.reps})`);
  ok(state.core.phase === "extended", "la fase sí queda consistente con el ángulo real (parado), aunque no se haya contado");

  // Después de la ventana, una repetición real sí cuenta.
  for (const angle of [120, 90, 120, 170]) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500, graceEndAt);
    t += 300;
  }
  ok(state.core.reps === 1, `repetición después de la ventana de arranque: cuenta normal (dio ${state.core.reps})`);
}
{
  // graceEndAt=0 (default): sin ventana de arranque, comportamiento igual que antes de este cambio.
  let state = initGuardedRepCounter(squat);
  let t = 0;
  for (const angle of [170, 120, 90, 120, 170]) {
    state = stepGuardedRepCounter(state, angle, squat, t, 500);
    t += 300;
  }
  ok(state.core.reps === 1, `sin graceEndAt (default): cuenta como siempre (dio ${state.core.reps})`);
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
