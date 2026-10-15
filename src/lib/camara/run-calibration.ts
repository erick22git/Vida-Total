"use client";

/**
 * Glue de navegador para la Fase A (docs/roadmap/vision-entrenador.md, sección 2.1.9): acá sí se
 * toca MediaPipe y el `<video>` real. La decisión de qué hacer con cada medición vive en
 * `device-calibration.ts` (puro, testeado sin cámara) — este archivo solo mide y aplica.
 *
 * Privacidad: todo corre en el dispositivo. El único tráfico de red es la descarga, una vez, del
 * runtime WASM y el modelo `.task` (archivos estáticos de Google, no datos del usuario) — el video
 * nunca sale del dispositivo.
 */
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  CALIBRATION_WINDOW_MS,
  DEGRADE_RESOLUTIONS,
  computeFps,
  decideCalibrationStep,
  deviceFingerprint,
  type DeviceCalibrationResult,
} from "./device-calibration";

// Misma versión que la dependencia instalada (package.json) — el bundle JS/TS viene de npm, pero el
// runtime WASM se sirve desde CDN para no versionar binarios en el repo. Licencia Apache 2.0,
// confirmada en docs/roadmap/vision-entrenador.md sección 2.1.1.
const TASKS_VISION_VERSION = "0.10.14";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let cachedLandmarker: Promise<PoseLandmarker> | null = null;

async function getLandmarker(): Promise<PoseLandmarker> {
  if (!cachedLandmarker) {
    cachedLandmarker = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        // Algunos dispositivos/navegadores no tienen delegado GPU disponible para WASM — se cae a
        // CPU en vez de fallar la calibración entera por esto.
        return PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
    })();
  }
  return cachedLandmarker;
}

function measureFpsWindow(video: HTMLVideoElement, landmarker: PoseLandmarker): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    function tick() {
      const now = performance.now();
      if (now - start >= CALIBRATION_WINDOW_MS) {
        resolve(computeFps(frames, now - start));
        return;
      }
      if (video.readyState >= 2) {
        landmarker.detectForVideo(video, now);
        frames++;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Mide fps real en `video`/`track` durante `CALIBRATION_WINDOW_MS`, degradando resolución según
 * `decideCalibrationStep` hasta aceptar un escalón o caer a manual. No persiste nada — el caller
 * (la pantalla de cámara, Fase C) guarda el resultado con `useCameraCalibrationStore`.
 */
export async function calibrateDevice(
  video: HTMLVideoElement,
  track: MediaStreamTrack,
): Promise<DeviceCalibrationResult> {
  const landmarker = await getLandmarker();
  const fingerprint = deviceFingerprint(navigator.userAgent, window.innerWidth, window.innerHeight);

  let resolutionIndex = 0;
  while (resolutionIndex < DEGRADE_RESOLUTIONS.length) {
    const target = DEGRADE_RESOLUTIONS[resolutionIndex];
    try {
      await track.applyConstraints({ width: { ideal: target.width }, height: { ideal: target.height } });
    } catch {
      // Si el dispositivo no acepta exactamente esta resolución, se sigue midiendo con la que el
      // track ya tenga aplicada — no es motivo para abortar la calibración.
    }

    const fps = await measureFpsWindow(video, landmarker);
    const outcome = decideCalibrationStep(fps, resolutionIndex);

    if (outcome.kind === "accept") {
      return {
        deviceFingerprint: fingerprint,
        passed: true,
        resolution: outcome.resolution,
        fps: outcome.fps,
        calibratedAt: Date.now(),
      };
    }
    if (outcome.kind === "fallback_manual") {
      return {
        deviceFingerprint: fingerprint,
        passed: false,
        resolution: null,
        fps: outcome.fps,
        calibratedAt: Date.now(),
      };
    }
    resolutionIndex += 1;
  }

  // No debería llegarse acá (decideCalibrationStep siempre devuelve fallback_manual en el último
  // escalón), pero por tipado se cubre el caso.
  return {
    deviceFingerprint: fingerprint,
    passed: false,
    resolution: null,
    fps: 0,
    calibratedAt: Date.now(),
  };
}
