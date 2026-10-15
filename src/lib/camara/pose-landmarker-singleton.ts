"use client";

/**
 * Una sola instancia de `PoseLandmarker` compartida por toda la app (la calibración de la Fase A
 * y la pantalla en vivo de la Fase C) — crear el modelo de nuevo cada vez que se abre la cámara
 * descargaría/inicializaría WASM otra vez sin necesidad.
 */
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Misma versión que la dependencia instalada (package.json). El bundle JS/TS viene de npm, el
// runtime WASM se sirve desde CDN para no versionar binarios en el repo. Licencia Apache 2.0,
// confirmada en docs/roadmap/vision-entrenador.md sección 2.1.1.
const TASKS_VISION_VERSION = "0.10.14";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let cached: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!cached) {
    cached = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        // Algunos dispositivos/navegadores no tienen delegado GPU disponible para WASM — se cae a
        // CPU en vez de fallar la carga entera por esto.
        return PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
    })();
  }
  return cached;
}
