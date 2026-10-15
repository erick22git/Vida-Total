// Pruebas del estimado de calorías por entrenamiento. Ejecutar: npx tsx tools/gym/exercise_calorie_burn_test.ts
import {
  effortBucketForSet,
  assumedSetActiveSeconds,
  estimateSetCalories,
  estimateSessionCalories,
  RESISTANCE_MET,
} from "../../src/lib/gym/exercise-calorie-burn";
import type { WorkoutSession, WorkoutSet } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// --- bucket de esfuerzo por reps ---
{
  ok(effortBucketForSet(5, false) === "vigoroso", "≤6 reps sin fallo: vigoroso");
  ok(effortBucketForSet(10, false) === "moderado", "7-12 reps sin fallo: moderado");
  ok(effortBucketForSet(15, false) === "ligero", "13+ reps sin fallo: ligero");
  ok(effortBucketForSet(15, true) === "moderado", "13+ reps al fallo: sube a moderado");
  ok(effortBucketForSet(10, true) === "vigoroso", "7-12 reps al fallo: sube a vigoroso");
  ok(effortBucketForSet(5, true) === "vigoroso", "≤6 reps al fallo: se queda en vigoroso (tope)");
}

// --- duración asumida de una serie ---
{
  ok(assumedSetActiveSeconds(10) === 110, "10 reps: 10 + 10*10 = 110s");
  ok(assumedSetActiveSeconds(0) === 10, "0 reps: mínimo 10s, nunca 0 ni negativo");
}

// --- calorías de una serie: sin peso corporal, 0 ---
{
  ok(estimateSetCalories({ reps: 10, alFallo: false, restSecondsAfter: 90 }, 0) === 0, "sin peso corporal: 0 kcal, nunca NaN");
}

// --- calorías de una serie: verificable a mano ---
{
  // 10 reps moderado (5.0 MET), activo = 110s = 110/3600h; peso 80kg; descanso 90s = 90/3600h a 1.3 MET.
  const kcal = estimateSetCalories({ reps: 10, alFallo: false, restSecondsAfter: 90 }, 80);
  const esperado = RESISTANCE_MET.moderado * 80 * (110 / 3600) + 1.3 * 80 * (90 / 3600);
  ok(Math.abs(kcal - esperado) < 0.001, `cálculo verificable a mano (dio ${kcal}, esperado ${esperado})`);
}

// --- sesión completa: ignora calentamiento, suma por ejercicio ---
{
  function setOf(peso: number, reps: number, tipo?: WorkoutSet["tipo"], completado = true, fallo = false): WorkoutSet {
    return { id: `s${Math.random()}`, peso, reps, completado, fallo, tipo };
  }
  const session: WorkoutSession = {
    id: "s1",
    date: "2026-10-15",
    grupoMuscular: "Pecho",
    completado: true,
    ejercicios: [
      {
        exerciseId: "press-banca",
        restSeconds: 90,
        sets: [setOf(20, 15, "calentamiento"), setOf(60, 10), setOf(60, 10)],
      },
      {
        exerciseId: "sentadilla",
        restSeconds: 120,
        sets: [setOf(80, 8), setOf(80, 8)],
      },
    ],
  };
  const result = estimateSessionCalories(session, 80);
  ok(result.porEjercicio.length === 2, `un desglose por cada ejercicio con series de trabajo (dio ${result.porEjercicio.length})`);
  ok(result.porEjercicio.find((e) => e.exerciseId === "press-banca") !== undefined, "incluye press-banca");
  ok(result.totalKcal > 0, `total > 0 (dio ${result.totalKcal})`);

  const sessionSoloCalentamiento: WorkoutSession = {
    id: "s2",
    date: "2026-10-15",
    grupoMuscular: "Pecho",
    completado: true,
    ejercicios: [{ exerciseId: "press-banca", sets: [setOf(20, 15, "calentamiento")] }],
  };
  const r2 = estimateSessionCalories(sessionSoloCalentamiento, 80);
  ok(r2.totalKcal === 0 && r2.porEjercicio.length === 0, "solo calentamiento: no suma nada (el calentamiento no cuenta)");

  const sessionNoCompletado: WorkoutSession = {
    id: "s3",
    date: "2026-10-15",
    grupoMuscular: "Pecho",
    completado: false,
    ejercicios: [{ exerciseId: "press-banca", sets: [setOf(60, 10, "normal", false)] }],
  };
  ok(estimateSessionCalories(sessionNoCompletado, 80).totalKcal === 0, "series no completadas no suman calorías");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
