// Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1).
// node tools/3d/verify/run_ts.mjs tools/camara/pose_landmarks_test.ts
import {
  angleAtVertex,
  kneeAngle,
  hipAngle,
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

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
