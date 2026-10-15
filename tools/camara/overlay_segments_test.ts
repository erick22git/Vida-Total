// Fase C del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.7).
// node tools/3d/verify/run_ts.mjs tools/camara/overlay_segments_test.ts
import { formVerdict, segmentVerdicts, SKELETON_SEGMENTS } from "../../src/lib/camara/overlay-segments";
import { CAMERA_EXERCISE_CONFIGS } from "../../src/lib/camara/exercise-configs";
import type { RepCounterState } from "../../src/lib/camara/rep-counter";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

function state(phase: RepCounterState["phase"], visitedOpposite: boolean): RepCounterState {
  return { phase, visitedOpposite, reps: 0 };
}

// --- sentadilla: tiene hasFormValidation true ---
const squat = CAMERA_EXERCISE_CONFIGS.sentadilla;
ok(formVerdict(state("extended", false), squat) === "neutral", "sentadilla parado: neutral (nada que evaluar en reposo)");
ok(formVerdict(state("flexing", false), squat) === "neutral", "sentadilla bajando: neutral (todavía no se sabe si llega a profundidad)");
ok(formVerdict(state("flexed", false), squat) === "ok", "sentadilla llegó a profundidad citada: ok (verde)");
ok(formVerdict(state("extending", true), squat) === "ok", "sentadilla subiendo HABIENDO llegado a profundidad: ok");
ok(formVerdict(state("extending", false), squat) === "insufficient", "sentadilla subiendo SIN haber llegado a profundidad: insufficient (rojo)");

// --- peso muerto: hasFormValidation false a propósito (fuente no da un criterio de corrección) ---
const deadlift = CAMERA_EXERCISE_CONFIGS.peso_muerto;
ok(formVerdict(state("flexed", false), deadlift) === "neutral", "peso muerto: siempre neutral, sin fuente para juzgar forma");
ok(formVerdict(state("extending", false), deadlift) === "neutral", "peso muerto: neutral incluso en el caso que sería 'insufficient' en sentadilla");

// --- press de banca / curl: hasFormValidation false ---
ok(formVerdict(state("extending", false), CAMERA_EXERCISE_CONFIGS.press_banca) === "neutral", "press de banca: siempre neutral");
ok(formVerdict(state("extending", false), CAMERA_EXERCISE_CONFIGS.curl_biceps) === "neutral", "curl: siempre neutral");

// --- segmentVerdicts: solo los 2 segmentos de la rodilla del lado trackeado cambian de color ---
{
  const verdicts = segmentVerdicts("right", "knee", "insufficient");
  let neutralCount = 0;
  let insufficientCount = 0;
  for (const v of verdicts.values()) {
    if (v === "neutral") neutralCount++;
    if (v === "insufficient") insufficientCount++;
  }
  ok(insufficientCount === 2, `exactamente 2 segmentos (hip-rodilla, rodilla-tobillo) toman el veredicto, no todo el esqueleto (dio ${insufficientCount})`);
  ok(neutralCount === SKELETON_SEGMENTS.length - 2, "el resto del esqueleto se queda neutral");
}
{
  // El lado NO trackeado nunca cambia, aunque el veredicto sea "insufficient".
  const verdicts = segmentVerdicts("right", "knee", "insufficient");
  ok(verdicts.get("23-25") === "neutral", "rodilla izquierda (no trackeada) se queda neutral aunque el veredicto del lado derecho sea insufficient");
}
{
  // Ejercicio de codo: nunca resalta la rodilla (no tiene sentido para press/curl).
  const verdicts = segmentVerdicts("right", "elbow", "neutral");
  let anyNonNeutral = false;
  for (const v of verdicts.values()) if (v !== "neutral") anyNonNeutral = true;
  ok(!anyNonNeutral, "ejercicio de codo: ningún segmento se resalta (sin validación de forma para press/curl)");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
