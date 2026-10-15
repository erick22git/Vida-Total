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
 *
 * La coordenada `z` SÍ se usa para otra cosa (sección 3.6 del roadmap): detectar si la cámara está
 * de perfil o de frente respecto al movimiento (`detectOrientation`), para elegir entre fijar un
 * lado o promediar ambos — ver el comentario de esa función.
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

/** Igual que `kneeAngle`, pero además devuelve qué lado terminó usando — lo necesita el overlay
 * (Fase C) para saber qué segmentos del esqueleto resaltar. */
export function kneeAngleWithSide(landmarks: PoseLandmarks, side?: Side): { angle: number; side: Side } {
  const s = side ?? pickMoreVisibleSide(landmarks, KNEE_JOINTS);
  return { angle: kneeAngle(landmarks, s), side: s };
}

/** Igual que `elbowAngle`, pero además devuelve qué lado terminó usando. */
export function elbowAngleWithSide(landmarks: PoseLandmarks, side?: Side): { angle: number; side: Side } {
  const s = side ?? pickMoreVisibleSide(landmarks, ELBOW_JOINTS);
  return { angle: elbowAngle(landmarks, s), side: s };
}

// --- Orientación de cámara (sección 3.6 del roadmap: arreglo del conteo de reps) ---

export type Orientation = "profile" | "frontal" | "unknown";

/** De perfil, un lado del cuerpo queda mucho más cerca de la cámara que el otro — por eso se puede
 * detectar sin un modelo nuevo, comparando la `z` (profundidad que ya da MediaPipe) de cada
 * articulación contra su par del otro lado. Umbral propio (no de la literatura): la diferencia de
 * profundidad entre hombros/caderas, normalizada por el ancho real entre ellos en la imagen (para
 * que no dependa de qué tan cerca está la persona de la cámara), tiene que superar esta fracción
 * para considerarse "de perfil" en vez de ruido normal de la estimación de profundidad. */
export const PROFILE_Z_RATIO_THRESHOLD = 0.35;

/** Visibilidad mínima para confiar en un landmark al decidir orientación — más estricto que el
 * elegir-el-lado-más-visible de `pickMoreVisibleSide`, porque acá un landmark poco confiable puede
 * hacer pasar un "de frente" por "de perfil" (o viceversa), no solo elegir mal un lado. */
export const MIN_ORIENTATION_VISIBILITY = 0.5;

function xyDistance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const ORIENTATION_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [POSE_LANDMARK_INDEX.leftShoulder, POSE_LANDMARK_INDEX.rightShoulder],
  [POSE_LANDMARK_INDEX.leftHip, POSE_LANDMARK_INDEX.rightHip],
];

/**
 * "profile" (de perfil/lateral), "frontal" (de frente a la cámara), o "unknown" si no hay
 * suficiente señal confiable para decidir — en ese caso el caller debe avisar en pantalla en vez
 * de adivinar y arriesgarse a contar mal (sección 3.6 del roadmap).
 */
export function detectOrientation(landmarks: PoseLandmarks): Orientation {
  const ratios: number[] = [];
  for (const [leftIdx, rightIdx] of ORIENTATION_PAIRS) {
    const left = landmarks[leftIdx];
    const right = landmarks[rightIdx];
    if (!left || !right) continue;
    if ((left.visibility ?? 1) < MIN_ORIENTATION_VISIBILITY || (right.visibility ?? 1) < MIN_ORIENTATION_VISIBILITY) continue;
    if (left.z === undefined || right.z === undefined) continue;
    const width = xyDistance(left, right);
    if (width <= 0) continue;
    ratios.push(Math.abs(left.z - right.z) / width);
  }
  // Si ninguno de los pares (hombros, caderas) dio una lectura confiable, no hay base para decidir.
  if (ratios.length === 0) return "unknown";
  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  if (avgRatio >= PROFILE_Z_RATIO_THRESHOLD) return "profile";
  // "frontal" solo si TODOS los pares pudieron medirse — si alguno quedó afuera por baja
  // visibilidad, la lectura es parcial y no alcanza la confianza para decidir "frontal" tampoco.
  if (ratios.length < ORIENTATION_PAIRS.length) return "unknown";
  return "frontal";
}

export type TrackedSide = Side | "both";

function averageDefinedAngles(a: number, b: number): number {
  const values = [a, b].filter((v) => !Number.isNaN(v));
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Ángulo de rodilla ya resuelto según la orientación detectada: de perfil fija el lado que el
 * caller ya eligió (`lockedSide`, normalmente una sola vez por serie — ver `detectOrientation`),
 * de frente promedia ambos lados en vez de "parpadear" entre uno y otro cada frame (la causa real
 * del sobre-conteo reportado en press de banca, sección 3.1 del roadmap).
 */
export function kneeAngleOriented(
  landmarks: PoseLandmarks,
  orientation: Orientation,
  lockedSide: Side | null,
): { angle: number; trackedSide: TrackedSide } {
  if (orientation === "frontal") {
    return { angle: averageDefinedAngles(kneeAngle(landmarks, "left"), kneeAngle(landmarks, "right")), trackedSide: "both" };
  }
  const side = lockedSide ?? pickMoreVisibleSide(landmarks, KNEE_JOINTS);
  return { angle: kneeAngle(landmarks, side), trackedSide: side };
}

/** Igual que `kneeAngleOriented`, para el ángulo de codo (press de banca, curl). */
export function elbowAngleOriented(
  landmarks: PoseLandmarks,
  orientation: Orientation,
  lockedSide: Side | null,
): { angle: number; trackedSide: TrackedSide } {
  if (orientation === "frontal") {
    return { angle: averageDefinedAngles(elbowAngle(landmarks, "left"), elbowAngle(landmarks, "right")), trackedSide: "both" };
  }
  const side = lockedSide ?? pickMoreVisibleSide(landmarks, ELBOW_JOINTS);
  return { angle: elbowAngle(landmarks, side), trackedSide: side };
}
