/**
 * Fase C del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.7). Lógica
 * pura: a partir del estado del contador de reps, decide qué color le toca a cada segmento del
 * esqueleto en este frame. Nunca pinta "todo el esqueleto" en rojo — solo el segmento de la
 * articulación evaluada, y solo para los ejercicios con `hasFormValidation: true`.
 */
import { POSE_LANDMARK_INDEX, type Side, type TrackedSide } from "./pose-landmarks";
import type { RepCounterState } from "./rep-counter";
import type { CameraExerciseConfig } from "./exercise-configs";

export type FormVerdict = "ok" | "insufficient" | "neutral";

/** Todas las conexiones del esqueleto que se dibujan — el resto del cuerpo además de la
 * articulación evaluada, siempre en color neutro (nunca se evalúa su "corrección"). */
export const SKELETON_SEGMENTS: ReadonlyArray<readonly [number, number]> = [
  [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.rightShoulder],
  [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.leftElbow],
  [POSE_LANDMARK_INDEX.leftElbow, POSE_LANDMARK_INDEX.leftWrist],
  [POSE_LANDMARK_INDEX.rightShoulder, POSE_LANDMARK_INDEX.rightElbow],
  [POSE_LANDMARK_INDEX.rightElbow, POSE_LANDMARK_INDEX.rightWrist],
  [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.leftHip],
  [POSE_LANDMARK_INDEX.rightShoulder, POSE_LANDMARK_INDEX.rightHip],
  [POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.rightHip],
  [POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.leftKnee],
  [POSE_LANDMARK_INDEX.leftKnee, POSE_LANDMARK_INDEX.leftAnkle],
  [POSE_LANDMARK_INDEX.rightHip, POSE_LANDMARK_INDEX.rightKnee],
  [POSE_LANDMARK_INDEX.rightKnee, POSE_LANDMARK_INDEX.rightAnkle],
];

const KNEE_SEGMENTS_BY_SIDE: Record<Side, ReadonlyArray<readonly [number, number]>> = {
  left: [
    [POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.leftKnee],
    [POSE_LANDMARK_INDEX.leftKnee, POSE_LANDMARK_INDEX.leftAnkle],
  ],
  right: [
    [POSE_LANDMARK_INDEX.rightHip, POSE_LANDMARK_INDEX.rightKnee],
    [POSE_LANDMARK_INDEX.rightKnee, POSE_LANDMARK_INDEX.rightAnkle],
  ],
};

/**
 * Veredicto de forma para ESTE frame, basado únicamente en si el ángulo ya cruzó el umbral citado
 * de la fuente (sección 2.1.3) en el ciclo de repetición actual — no inventa una franja de
 * precisión que la fuente no da.
 *
 * Importante para quien agregue un ejercicio nuevo con `hasFormValidation: true`: esto solo tiene
 * sentido cuando el extremo "bueno" del movimiento (el opuesto a `startExtreme`) es exactamente el
 * umbral citado — hoy eso es cierto únicamente para sentadilla (profundidad). Peso muerto quedó
 * con `hasFormValidation: false` a propósito: el único número citado (Schellenberg et al. 2013)
 * describe un rango típico durante el levantamiento, no un criterio de corrección — usarlo como
 * umbral de "bien/mal" habría prometido más precisión de la que la fuente da.
 */
export function formVerdict(state: RepCounterState, config: CameraExerciseConfig): FormVerdict {
  if (!config.hasFormValidation) return "neutral";
  if (state.phase === "flexed") return "ok";
  if (state.phase === "extending") return state.visitedOpposite ? "ok" : "insufficient";
  // "extended" (reposo/parado) o "flexing" (bajando, todavía no se sabe si va a llegar): sin
  // evaluación todavía.
  return "neutral";
}

function segmentKey(a: number, b: number): string {
  return `${a}-${b}`;
}

/** Color por segmento para este frame: todo el esqueleto en neutro salvo los segmentos de la
 * articulación evaluada (hoy, rodilla del lado trackeado), que toman `formResult`. `trackedSide`
 * puede ser "both" (cámara de frente, sección 3.6 del roadmap: se promedian ambos lados en vez de
 * fijar uno) — ahí se resaltan las dos rodillas, no solo una. */
export function segmentVerdicts(
  trackedSide: TrackedSide,
  joint: CameraExerciseConfig["joint"],
  formResult: FormVerdict,
): Map<string, FormVerdict> {
  const map = new Map<string, FormVerdict>();
  for (const [a, b] of SKELETON_SEGMENTS) map.set(segmentKey(a, b), "neutral");
  if (joint === "knee") {
    const sides: Side[] = trackedSide === "both" ? ["left", "right"] : [trackedSide];
    for (const s of sides) {
      for (const [a, b] of KNEE_SEGMENTS_BY_SIDE[s]) map.set(segmentKey(a, b), formResult);
    }
  }
  // joint === "elbow" (press de banca / curl): sin segmentos resaltados — hasFormValidation es
  // false para ambos, formResult ya viene "neutral" desde el caller en ese caso.
  return map;
}

export { segmentKey };
