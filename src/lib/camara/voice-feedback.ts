/**
 * Corrección por voz en tiempo real (roadmap sección 3.5): la mejora más barata de las cuatro
 * pedidas — no necesita modelo nuevo, ya calculamos todo lo necesario (conteo de reps, veredicto
 * de forma). Esto decide QUÉ decir y CUÁNDO, puro y testeable sin `speechSynthesis` — hablar de
 * verdad es trabajo de `voice-speak.ts` (navegador).
 */
import type { RepCounterState } from "./rep-counter";
import type { CameraExerciseConfig } from "./exercise-configs";
import type { FormVerdict } from "./overlay-segments";

export type VoiceCue = { kind: "rep_count"; count: number } | { kind: "shallow_rep" } | null;

/**
 * Prioridad: una repetición contada siempre se anuncia. El aviso de "no llegaste a profundidad"
 * solo dispara en el BORDE (el frame donde el veredicto pasa a "insufficient" por primera vez),
 * nunca en cada frame mientras se mantiene — si no, hablaría sin parar durante toda la subida.
 */
export function decideVoiceCue(
  prevState: RepCounterState,
  nextState: RepCounterState,
  config: CameraExerciseConfig,
  prevVerdict: FormVerdict,
  nextVerdict: FormVerdict,
): VoiceCue {
  if (nextState.reps > prevState.reps) {
    return { kind: "rep_count", count: nextState.reps };
  }
  if (config.hasFormValidation && nextVerdict === "insufficient" && prevVerdict !== "insufficient") {
    return { kind: "shallow_rep" };
  }
  return null;
}

export function voiceCuePhrase(cue: VoiceCue): string | null {
  if (!cue) return null;
  if (cue.kind === "rep_count") return String(cue.count);
  return "más profundo";
}
