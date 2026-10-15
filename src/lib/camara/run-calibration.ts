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
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getPoseLandmarker } from "./pose-landmarker-singleton";
import {
  CALIBRATION_WINDOW_MS,
  DEGRADE_RESOLUTIONS,
  computeFps,
  decideCalibrationStep,
  deviceFingerprint,
  type DeviceCalibrationResult,
} from "./device-calibration";

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
  const landmarker = await getPoseLandmarker();
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
