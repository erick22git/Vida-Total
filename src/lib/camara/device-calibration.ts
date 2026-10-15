/**
 * Fase A del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.9).
 *
 * Lógica pura de auto-medición y degradación: nada acá toca `navigator.mediaDevices`, el DOM ni
 * MediaPipe directamente — eso vive en `run-calibration.ts`. Separado así para poder testear la
 * decisión (¿degradar? ¿caer a manual? ¿hace falta recalibrar?) sin un dispositivo real.
 */

/** Umbral mínimo de fps para que el overlay se sienta "en vivo" — criterio técnico propio,
 * documentado en el roadmap (sección 2.1.9), no un número de la literatura. */
export const FPS_THRESHOLD = 15;

/** Ventana de medición: 2.5s de inferencia real antes de decidir. */
export const CALIBRATION_WINDOW_MS = 2500;

export interface CalibrationResolution {
  readonly width: number;
  readonly height: number;
}

/** Orden de degradación: se prueba primero a resolución normal: si no alcanza, se baja un escalón
 * y se vuelve a medir. Cuando se acaban los escalones, se cae a manual. */
export const DEGRADE_RESOLUTIONS: readonly CalibrationResolution[] = [
  { width: 640, height: 480 },
  { width: 320, height: 240 },
];

export type CalibrationOutcome =
  /** El fps en esta resolución alcanza el umbral: se queda en ella. */
  | { kind: "accept"; resolution: CalibrationResolution; fps: number }
  /** No alcanza, pero hay un escalón más bajo para probar. */
  | { kind: "degrade"; nextResolution: CalibrationResolution; fps: number }
  /** No alcanza ni en el escalón más bajo: cae al registro manual. */
  | { kind: "fallback_manual"; fps: number };

/** fps efectivo a partir de frames procesados y tiempo real transcurrido (no asumido). */
export function computeFps(framesProcessed: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (framesProcessed / elapsedMs) * 1000;
}

/**
 * Decide qué hacer después de medir `fps` en el escalón `resolutionIndex` de `DEGRADE_RESOLUTIONS`.
 * Pura: el runner es quien vuelve a llamar a `detectForVideo` en la resolución nueva si el
 * resultado es "degrade", y quien dispara el fallback visible si es "fallback_manual".
 */
export function decideCalibrationStep(fps: number, resolutionIndex: number): CalibrationOutcome {
  const current = DEGRADE_RESOLUTIONS[resolutionIndex];
  if (!current) {
    throw new Error(`decideCalibrationStep: resolutionIndex ${resolutionIndex} fuera de rango`);
  }
  if (fps >= FPS_THRESHOLD) {
    return { kind: "accept", resolution: current, fps };
  }
  const next = DEGRADE_RESOLUTIONS[resolutionIndex + 1];
  if (next) {
    return { kind: "degrade", nextResolution: next, fps };
  }
  return { kind: "fallback_manual", fps };
}

export interface DeviceCalibrationResult {
  /** Identifica el dispositivo/navegador para saber cuándo hay que volver a medir. */
  deviceFingerprint: string;
  /** true si terminó aceptando una resolución (modo cámara disponible), false si cayó a manual. */
  passed: boolean;
  /** Resolución final usada si `passed`; `null` si cayó a manual. */
  resolution: CalibrationResolution | null;
  /** Último fps medido (en la resolución final, sea cual sea el resultado). */
  fps: number;
  /** `Date.now()` de cuándo se calibró. */
  calibratedAt: number;
}

/** Combina userAgent + tamaño de pantalla real en una key estable para detectar cambio de
 * dispositivo/navegador — no es un hash criptográfico, solo una key de comparación. */
export function deviceFingerprint(userAgent: string, screenWidth: number, screenHeight: number): string {
  return `${userAgent}|${screenWidth}x${screenHeight}`;
}

/** true si hay que volver a correr la calibración: no hay resultado guardado, o el dispositivo
 * actual no es el mismo que el que se calibró la última vez. */
export function shouldRecalibrate(
  stored: DeviceCalibrationResult | null,
  currentFingerprint: string,
): boolean {
  if (!stored) return true;
  return stored.deviceFingerprint !== currentFingerprint;
}
