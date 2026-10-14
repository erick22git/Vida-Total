// Pruebas del motor de hipertrofia. Ejecutar: npx tsx tools/gym/hypertrophy_engine_test.ts
import {
  estimated1RM,
  experienceLevelFrom,
  mesocycleWeekTarget,
  plateauDetected,
  volumeLandmarksFor,
  volumeStatus,
  weeklyMuscleVolume,
  weightSuggestion,
} from "../../src/lib/training/hypertrophy-engine";
import type { Exercise, WorkoutSession } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- experienceLevelFrom ----
ok(experienceLevelFrom("menos_6m") === "principiante", "menos_6m -> principiante");
ok(experienceLevelFrom("6m_2a") === "principiante", "6m_2a -> principiante");
ok(experienceLevelFrom("2_5a") === "intermedio", "2_5a -> intermedio");
ok(experienceLevelFrom("mas_5a") === "avanzado", "mas_5a -> avanzado");
ok(experienceLevelFrom(undefined) === "principiante", "sin dato -> principiante (conservador)");

// ---- volumeLandmarksFor ----
const pechoInter = volumeLandmarksFor("Pecho", "intermedio");
ok(eq(pechoInter, { mev: 6, mav: 15, mrv: 22 }), `Pecho intermedio = tabla base (${JSON.stringify(pechoInter)})`);
const pechoPrincipiante = volumeLandmarksFor("Pecho", "principiante");
ok(pechoPrincipiante !== null && pechoPrincipiante.mev < pechoInter!.mev, "principiante tiene MEV menor que intermedio");
const pechoAvanzado = volumeLandmarksFor("Pecho", "avanzado");
ok(pechoAvanzado !== null && pechoAvanzado.mrv > pechoInter!.mrv, "avanzado tiene MRV mayor que intermedio");
ok(volumeLandmarksFor("Abductores", "intermedio") === null, "Abductores sin landmarks -> null (nunca inventado)");
ok(volumeLandmarksFor("Aductores", "avanzado") === null, "Aductores sin landmarks -> null");
ok(volumeLandmarksFor("Cardio", "intermedio") === null, "Cardio sin landmarks -> null");

// ---- volumeStatus ----
const l = { mev: 6, mav: 15, mrv: 22 };
ok(volumeStatus(0, l) === "bajo", "0 series = bajo");
ok(volumeStatus(5, l) === "bajo", "5 < MEV(6) = bajo");
ok(volumeStatus(6, l) === "enRango", "6 = MEV exacto = enRango");
ok(volumeStatus(14, l) === "enRango", "14 < MAV(15) = enRango");
ok(volumeStatus(15, l) === "cercaLimite", "15 = MAV exacto = cercaLimite");
ok(volumeStatus(21, l) === "cercaLimite", "21 < MRV(22) = cercaLimite");
ok(volumeStatus(22, l) === "excedido", "22 = MRV exacto = excedido");
ok(volumeStatus(30, l) === "excedido", "30 > MRV = excedido");

// ---- weeklyMuscleVolume ----
const exercises: Exercise[] = [
  { id: "press-banca", nombre: "Press banca", categoria: "Pecho", musculoPrimario: "Pectoral", musculosSecundarios: ["Triceps", "Hombros"], equipo: "barra", nivel: "Intermedio", instrucciones: [] },
  { id: "curl-biceps", nombre: "Curl biceps", categoria: "Biceps", musculoPrimario: "Biceps", musculosSecundarios: [], equipo: "mancuerna", nivel: "Principiante", instrucciones: [] },
];
const sesion = (date: string, sets: number, exerciseId: string, completadas = sets): WorkoutSession => ({
  id: `s-${date}-${exerciseId}`,
  date,
  grupoMuscular: "Pecho",
  completado: true,
  ejercicios: [
    {
      exerciseId,
      sets: Array.from({ length: sets }, (_, i) => ({ id: `${i}`, peso: 50, reps: 10, completado: i < completadas, fallo: false })),
    },
  ],
});
const sessions: WorkoutSession[] = [
  sesion("2026-10-12", 4, "press-banca"), // dentro de la semana
  sesion("2026-10-13", 3, "curl-biceps"),
  sesion("2026-10-05", 10, "press-banca"), // semana anterior, no debe contar
  sesion("2026-10-12", 4, "press-banca", 2), // solo 2 de 4 completadas
];
const vol = weeklyMuscleVolume(sessions, exercises, "2026-10-12");
ok(vol.Pecho === 6, `Pecho: 4 directas + 2 directas (solo completadas) = 6 (obtuvo ${vol.Pecho})`);
ok(vol.Triceps === 3, `Triceps: 6 series de press banca x 0.5 indirecto = 3 (obtuvo ${vol.Triceps})`);
ok(vol.Hombros === 3, `Hombros: indirecto igual que Triceps (obtuvo ${vol.Hombros})`);
ok(vol.Biceps === 3, `Biceps: 3 directas de curl (obtuvo ${vol.Biceps})`);

// ---- weightSuggestion ----
ok(weightSuggestion({ avgRir: 4, hitTargetReps: true, anyFailure: false }) === "subir", "RIR alto + objetivo cumplido -> subir");
ok(weightSuggestion({ avgRir: 2, hitTargetReps: true, anyFailure: false }) === "mantener", "RIR medio -> mantener");
ok(weightSuggestion({ avgRir: 0, hitTargetReps: true, anyFailure: false }) === "mantener", "RIR 0 pero cumplió objetivo -> mantener");
ok(weightSuggestion({ avgRir: 0, hitTargetReps: false, anyFailure: false }) === "bajar", "RIR 0 y no cumplió objetivo -> bajar");
ok(weightSuggestion({ avgRir: 1, hitTargetReps: false, anyFailure: true }) === "bajar", "fallo explícito y no cumplió -> bajar");

// ---- estimated1RM (Epley) ----
ok(estimated1RM(100, 1) === 100 * (1 + 1 / 30), "1RM con 1 rep ~= peso");
ok(estimated1RM(100, 10) === 100 * (1 + 10 / 30), "Epley: peso x (1 + reps/30)");
ok(estimated1RM(0, 10) === 0, "peso 0 -> 0 (sin dato, no inventado)");
ok(estimated1RM(100, 0) === 0, "reps 0 -> 0");

// ---- plateauDetected ----
ok(plateauDetected([100, 105, 110, 110, 108, 109], 3) === true, "sin nuevo máximo en las últimas 3 sesiones -> meseta");
ok(plateauDetected([100, 105, 110, 112, 115, 118], 3) === false, "sigue subiendo -> no es meseta");
ok(plateauDetected([100, 105], 3) === false, "menos sesiones que la ventana -> no se puede afirmar meseta");

// ---- mesocycleWeekTarget ----
const landmarks = { mev: 6, mav: 15, mrv: 22 };
ok(eq(mesocycleWeekTarget(landmarks, 1, false), { phase: "acumulacion", targetSets: 6 }), "semana 1 = MEV");
ok(eq(mesocycleWeekTarget(landmarks, 5, false), { phase: "acumulacion", targetSets: 10 }), "semana 5 = MEV + 4");
ok(eq(mesocycleWeekTarget(landmarks, 11, false), { phase: "acumulacion", targetSets: 15 }), "tope en MAV, no sigue subiendo solo (raw 16 > mav 15, aun < mrv 22)");
ok(mesocycleWeekTarget(landmarks, 17, false).phase === "deload", "semana que llegaría a MRV o más -> deload");
ok(mesocycleWeekTarget(landmarks, 2, true).phase === "deload", "meseta detectada -> deload aunque sea temprano en el mesociclo");

console.log(checks - fails, "/", checks, "OK");
if (fails > 0) {
  console.log(fails, "FALLARON");
  process.exit(1);
}
