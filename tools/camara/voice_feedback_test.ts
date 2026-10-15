// Corrección por voz en tiempo real (roadmap sección 3.5). node tools/3d/verify/run_ts.mjs tools/camara/voice_feedback_test.ts
import { decideVoiceCue, voiceCuePhrase } from "../../src/lib/camara/voice-feedback";
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

function state(phase: RepCounterState["phase"], reps: number): RepCounterState {
  return { phase, visitedOpposite: false, reps };
}

const squat = CAMERA_EXERCISE_CONFIGS.sentadilla;
const deadlift = CAMERA_EXERCISE_CONFIGS.peso_muerto;

// --- repetición contada: siempre se anuncia, con prioridad sobre cualquier otra cosa ---
{
  const cue = decideVoiceCue(state("extending", 2), state("extended", 3), squat, "insufficient", "ok");
  ok(cue?.kind === "rep_count", "repetición contada: anuncia rep_count");
  if (cue?.kind === "rep_count") ok(cue.count === 3, `anuncia el número correcto (dio ${cue.count})`);
  ok(voiceCuePhrase(cue) === "3", 'la frase es el número dicho, "3"');
}

// --- borde de "no llegó a profundidad": solo en sentadilla, solo en el borde ---
{
  const cue = decideVoiceCue(state("flexing", 1), state("extending", 1), squat, "neutral", "insufficient");
  ok(cue?.kind === "shallow_rep", "sentadilla: borde a insufficient dispara shallow_rep");
  ok(voiceCuePhrase(cue) === "más profundo", 'la frase es "más profundo"');
}
{
  // Ya estaba en insufficient el frame anterior: no se repite el aviso cada frame.
  const cue = decideVoiceCue(state("extending", 1), state("extending", 1), squat, "insufficient", "insufficient");
  ok(cue === null, "sentadilla: insufficient sostenido (no es un borde nuevo) no vuelve a avisar");
}
{
  // Peso muerto no tiene hasFormValidation: nunca dispara el aviso de profundidad.
  const cue = decideVoiceCue(state("flexing", 1), state("extending", 1), deadlift, "neutral", "insufficient");
  ok(cue === null, "peso muerto: sin validación de forma, nunca dispara shallow_rep");
}

// --- sin nada que decir ---
{
  const cue = decideVoiceCue(state("flexing", 0), state("flexing", 0), squat, "neutral", "neutral");
  ok(cue === null, "sin cambios relevantes: no hay nada que anunciar");
  ok(voiceCuePhrase(cue) === null, "voiceCuePhrase(null) es null");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
