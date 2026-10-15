// Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1).
// node tools/3d/verify/run_ts.mjs tools/camara/pose_landmarks_test.ts
import {
  angleAtVertex,
  kneeAngle,
  hipAngle,
  kneeAngleWithSide,
  kneeAngleOriented,
  elbowAngleOriented,
  detectOrientation,
  pickMoreVisibleSide,
  POSE_LANDMARK_INDEX,
  type Landmark,
  type PoseLandmarks,
} from "../../src/lib/camara/pose-landmarks";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
function close(actual: number, expected: number, tolerance: number, msg: string) {
  ok(!Number.isNaN(actual) && Math.abs(actual - expected) <= tolerance, `${msg} (dio ${actual}, esperaba ≈${expected})`);
}

// --- angleAtVertex: casos geométricos conocidos, sin depender de MediaPipe ---
close(angleAtVertex({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }), 90, 0.01, "ángulo recto (90°) entre ejes perpendiculares");
close(angleAtVertex({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }), 180, 0.01, "puntos opuestos en línea recta = 180°");
close(angleAtVertex({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 0, 0.01, "mismo punto en ambos lados = 0°");
ok(Number.isNaN(angleAtVertex(undefined, { x: 0, y: 0 }, { x: 1, y: 1 })), "landmark faltante devuelve NaN, no un número inventado");
ok(Number.isNaN(angleAtVertex({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })), "dos puntos coincidentes (magnitud 0) devuelve NaN, no divide por cero");

// --- kneeAngle / hipAngle con un esqueleto simulado "parado derecho" ---
function standingSkeleton(): PoseLandmarks {
  const lm: Landmark[] = new Array(33).fill(0).map(() => ({ x: 0, y: 0, visibility: 0 }));
  // Lado derecho bien visible, en línea recta vertical (hombro-cadera-rodilla-tobillo alineados):
  // ángulo de cadera y rodilla deberían salir cerca de 180° (pierna/torso extendidos).
  lm[POSE_LANDMARK_INDEX.rightShoulder] = { x: 0, y: 0, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightHip] = { x: 0, y: 1, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightKnee] = { x: 0, y: 2, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightAnkle] = { x: 0, y: 3, visibility: 1 };
  // Lado izquierdo deliberadamente poco visible (simula estar de perfil, tapado por el propio cuerpo).
  lm[POSE_LANDMARK_INDEX.leftShoulder] = { x: 0.1, y: 0, visibility: 0.1 };
  lm[POSE_LANDMARK_INDEX.leftHip] = { x: 0.1, y: 1, visibility: 0.1 };
  lm[POSE_LANDMARK_INDEX.leftKnee] = { x: 0.1, y: 2, visibility: 0.1 };
  lm[POSE_LANDMARK_INDEX.leftAnkle] = { x: 0.1, y: 3, visibility: 0.1 };
  return lm;
}

{
  const skeleton = standingSkeleton();
  close(kneeAngle(skeleton), 180, 0.01, "parado derecho: ángulo de rodilla ≈180°");
  close(hipAngle(skeleton), 180, 0.01, "parado derecho: ángulo de cadera ≈180°");
  ok(pickMoreVisibleSide(skeleton, { left: [11], right: [12] }) === "right", "elige el lado más visible (derecho) automáticamente");
}

// --- un esqueleto "en sentadilla profunda" (rodilla flexionada ~90°) ---
function deepSquatSkeleton(): PoseLandmarks {
  const lm: Landmark[] = new Array(33).fill(0).map(() => ({ x: 0, y: 0, visibility: 1 }));
  lm[POSE_LANDMARK_INDEX.rightHip] = { x: 0, y: 1, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightKnee] = { x: 0, y: 2, visibility: 1 };
  // Tobillo desplazado en x respecto a la rodilla → el ángulo cadera-rodilla-tobillo se cierra,
  // simulando la flexión real de una sentadilla profunda (no una pierna doblada hacia atrás).
  lm[POSE_LANDMARK_INDEX.rightAnkle] = { x: 1, y: 2, visibility: 1 };
  return lm;
}
{
  const angle = kneeAngle(deepSquatSkeleton(), "right");
  ok(!Number.isNaN(angle) && angle < 100, `sentadilla profunda simulada da ángulo de rodilla flexionado (<100°, dio ${angle})`);
}

// --- kneeAngleWithSide: devuelve el lado elegido, no solo el ángulo ---
{
  const skeleton = standingSkeleton();
  const { angle, side } = kneeAngleWithSide(skeleton);
  close(angle, 180, 0.01, "kneeAngleWithSide: mismo ángulo que kneeAngle");
  ok(side === "right", "kneeAngleWithSide: devuelve el lado más visible (derecho) elegido");
}

// --- detectOrientation (arreglo del conteo de reps, roadmap sección 3.6) ---
function skeletonFor(opts: {
  shoulderWidth: number;
  shoulderZDiff: number;
  hipWidth: number;
  hipZDiff: number;
  visibility?: number;
  withZ?: boolean;
}): PoseLandmarks {
  const { shoulderWidth, shoulderZDiff, hipWidth, hipZDiff, visibility = 1, withZ = true } = opts;
  const lm: Landmark[] = new Array(33).fill(0).map(() => ({ x: 0, y: 0, visibility }));
  lm[POSE_LANDMARK_INDEX.leftShoulder] = { x: -shoulderWidth / 2, y: 0, z: withZ ? -shoulderZDiff / 2 : undefined, visibility };
  lm[POSE_LANDMARK_INDEX.rightShoulder] = { x: shoulderWidth / 2, y: 0, z: withZ ? shoulderZDiff / 2 : undefined, visibility };
  lm[POSE_LANDMARK_INDEX.leftHip] = { x: -hipWidth / 2, y: 1, z: withZ ? -hipZDiff / 2 : undefined, visibility };
  lm[POSE_LANDMARK_INDEX.rightHip] = { x: hipWidth / 2, y: 1, z: withZ ? hipZDiff / 2 : undefined, visibility };
  return lm;
}

{
  // De perfil: hombros/caderas casi superpuestos en la imagen (ancho chico), pero uno mucho más
  // cerca de la cámara que el otro (diferencia de z grande en comparación).
  const profile = skeletonFor({ shoulderWidth: 0.05, shoulderZDiff: 0.6, hipWidth: 0.05, hipZDiff: 0.6 });
  ok(detectOrientation(profile) === "profile", "hombros/caderas angostos en la imagen + mucha diferencia de profundidad: perfil");
}
{
  // De frente: hombros/caderas bien separados en la imagen, profundidad casi igual de los dos lados.
  const frontal = skeletonFor({ shoulderWidth: 0.3, shoulderZDiff: 0.02, hipWidth: 0.25, hipZDiff: 0.02 });
  ok(detectOrientation(frontal) === "frontal", "hombros/caderas separados en la imagen + profundidad pareja: frontal");
}
{
  // Sin coordenada z (modelo no la dio, o landmarks incompletos): no se puede decidir, no se adivina.
  const noZ = skeletonFor({ shoulderWidth: 0.3, shoulderZDiff: 0, hipWidth: 0.3, hipZDiff: 0, withZ: false });
  ok(detectOrientation(noZ) === "unknown", "sin z disponible: unknown, no adivina");
}
{
  // Visibilidad muy baja en todos los landmarks relevantes: tampoco hay base para decidir.
  const lowVis = skeletonFor({ shoulderWidth: 0.3, shoulderZDiff: 0.02, hipWidth: 0.25, hipZDiff: 0.02, visibility: 0.1 });
  ok(detectOrientation(lowVis) === "unknown", "visibilidad baja en hombros/caderas: unknown, no adivina");
}

// --- kneeAngleOriented / elbowAngleOriented ---
{
  const skeleton = standingSkeleton(); // solo el lado derecho tiene datos útiles
  const { angle, trackedSide } = kneeAngleOriented(skeleton, "profile", null);
  close(angle, 180, 0.01, "kneeAngleOriented de perfil sin lado fijado: elige el más visible");
  ok(trackedSide === "right", "kneeAngleOriented de perfil: trackedSide es el lado elegido, no 'both'");
}
{
  const skeleton = standingSkeleton();
  const { trackedSide } = kneeAngleOriented(skeleton, "profile", "left");
  ok(trackedSide === "left", "kneeAngleOriented de perfil CON lado fijado: respeta el lado fijado, no vuelve a elegir");
}
{
  // De frente: promedia ambos lados en vez de devolver solo uno.
  const lm: Landmark[] = new Array(33).fill(0).map(() => ({ x: 0, y: 0, visibility: 1 }));
  lm[POSE_LANDMARK_INDEX.rightHip] = { x: 0, y: 1, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightKnee] = { x: 0, y: 2, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.rightAnkle] = { x: 0, y: 3, visibility: 1 }; // pierna derecha recta (180°)
  lm[POSE_LANDMARK_INDEX.leftHip] = { x: 1, y: 1, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.leftKnee] = { x: 1, y: 2, visibility: 1 };
  lm[POSE_LANDMARK_INDEX.leftAnkle] = { x: 2, y: 2, visibility: 1 }; // pierna izquierda a 90°
  const { angle, trackedSide } = kneeAngleOriented(lm, "frontal", null);
  ok(trackedSide === "both", "kneeAngleOriented de frente: trackedSide es 'both'");
  close(angle, 135, 0.01, "kneeAngleOriented de frente: promedia 180° y 90° → 135°");
}
{
  // elbowAngleOriented sigue el mismo patrón (press de banca/curl).
  const skeleton = standingSkeleton();
  const { trackedSide } = elbowAngleOriented(skeleton, "profile", "right");
  ok(trackedSide === "right", "elbowAngleOriented de perfil respeta el lado fijado");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
