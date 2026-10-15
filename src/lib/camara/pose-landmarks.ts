/**
 * Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1).
 *
 * Cálculo de ángulos articulares a partir de los 33 landmarks que devuelve MediaPipe Pose
 * Landmarker (topología BlazePose). Puro: recibe landmarks ya calculados, no toca la cámara ni el
 * modelo — eso es trabajo de `run-calibration.ts` / lo que conecte esto a `detectForVideo` en la
 * Fase C.
 *
 * Deliberadamente en 2D (x, y), no 3D: el documento de roadmap (sección 2.1.2) deja explícito que
 * esto mide ángulos articulares desde una sola cámara, no reconstrucción volumétrica real — la
 * coordenada `z` que da MediaPipe es una estimación de profundidad del propio modelo, no una
 * medición estereoscópica, así que no se usa para el ángulo que se le muestra al usuario.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  /** 0–1, qué tan confiable es este punto en este frame (oclusión, fuera de cuadro, etc). */
  visibility?: number;
}

export type PoseLandmarks = readonly Landmark[];

export type Side = "left" | "right";

/** Índices de la topología BlazePose/MediaPipe Pose (33 puntos) — solo los que usa este módulo. */
export const POSE_LANDMARK_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/** Ángulo en grados [0, 180] en el vértice `b`, entre los segmentos b→a y b→c. NaN si algún punto
 * no existe (landmarks incompleto) — el caller decide qué hacer con NaN, esto no inventa un valor. */
export function angleAtVertex(a: Landmark | undefined, b: Landmark | undefined, c: Landmark | undefined): number {
  if (!a || !b || !c) return NaN;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function averageVisibility(landmarks: PoseLandmarks, indices: readonly number[]): number {
  const values = indices.map((i) => landmarks[i]?.visibility ?? 0);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Elige el lado (izquierdo/derecho) cuyos puntos relevantes son, en promedio, más visibles en
 * este frame — ej. si el usuario está de perfil y un lado queda tapado por el propio cuerpo. */
export function pickMoreVisibleSide(
  landmarks: PoseLandmarks,
  jointIndices: { left: readonly number[]; right: readonly number[] },
): Side {
  const leftVis = averageVisibility(landmarks, jointIndices.left);
  const rightVis = averageVisibility(landmarks, jointIndices.right);
  return rightVis >= leftVis ? "right" : "left";
}

const KNEE_JOINTS = {
  left: [POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.leftKnee, POSE_LANDMARK_INDEX.leftAnkle] as const,
  right: [POSE_LANDMARK_INDEX.rightHip, POSE_LANDMARK_INDEX.rightKnee, POSE_LANDMARK_INDEX.rightAnkle] as const,
};

const HIP_JOINTS = {
  left: [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.leftKnee] as const,
  right: [POSE_LANDMARK_INDEX.rightShoulder, POSE_LANDMARK_INDEX.rightHip, POSE_LANDMARK_INDEX.rightKnee] as const,
};

const ELBOW_JOINTS = {
  left: [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.leftElbow, POSE_LANDMARK_INDEX.leftWrist] as const,
  right: [POSE_LANDMARK_INDEX.rightShoulder, POSE_LANDMARK_INDEX.rightElbow, POSE_LANDMARK_INDEX.rightWrist] as const,
};

/** Ángulo de rodilla (cadera-rodilla-tobillo) — usado por sentadilla y peso muerto. */
export function kneeAngle(landmarks: PoseLandmarks, side?: Side): number {
  const s = side ?? pickMoreVisibleSide(landmarks, KNEE_JOINTS);
  const [hipIdx, kneeIdx, ankleIdx] = KNEE_JOINTS[s];
  return angleAtVertex(landmarks[hipIdx], landmarks[kneeIdx], landmarks[ankleIdx]);
}

/** Ángulo de cadera (hombro-cadera-rodilla) — para la validación de forma de sentadilla/peso muerto
 * (profundidad y flexión de tronco), complementario al de rodilla. */
export function hipAngle(landmarks: PoseLandmarks, side?: Side): number {
  const s = side ?? pickMoreVisibleSide(landmarks, HIP_JOINTS);
  const [shoulderIdx, hipIdx, kneeIdx] = HIP_JOINTS[s];
  return angleAtVertex(landmarks[shoulderIdx], landmarks[hipIdx], landmarks[kneeIdx]);
}

/** Ángulo de codo (hombro-codo-muñeca) — preparado para press de banca/curl (conteo de reps, sin
 * validación de forma por ahora: sección 2.1.3 del roadmap). */
export function elbowAngle(landmarks: PoseLandmarks, side?: Side): number {
  const s = side ?? pickMoreVisibleSide(landmarks, ELBOW_JOINTS);
  const [shoulderIdx, elbowIdx, wristIdx] = ELBOW_JOINTS[s];
  return angleAtVertex(landmarks[shoulderIdx], landmarks[elbowIdx], landmarks[wristIdx]);
}
