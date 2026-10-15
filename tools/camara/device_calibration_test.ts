// Fase A del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.9).
// Prueba la lógica pura de auto-medición/degradación con fps simulados — sin cámara ni DOM.
// node tools/3d/verify/run_ts.mjs tools/camara/device_calibration_test.ts
import {
  FPS_THRESHOLD,
  DEGRADE_RESOLUTIONS,
  computeFps,
  decideCalibrationStep,
  deviceFingerprint,
  shouldRecalibrate,
  type DeviceCalibrationResult,
} from "../../src/lib/camara/device-calibration";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}

// --- computeFps ---
ok(computeFps(30, 1000) === 30, "30 frames en 1000ms = 30fps");
ok(computeFps(15, 1000) === 15, "15 frames en 1000ms = 15fps justo en el umbral");
ok(computeFps(0, 2500) === 0, "0 frames procesados = 0fps, no NaN");
ok(computeFps(10, 0) === 0, "elapsedMs <= 0 no divide por cero");
ok(Math.abs(computeFps(37, 2500) - 14.8) < 0.001, "37 frames en 2500ms ≈ 14.8fps");

// --- decideCalibrationStep: resolución inicial (índice 0) ---
{
  const outcome = decideCalibrationStep(30, 0);
  ok(outcome.kind === "accept", "30fps en res. 0 (≥15) acepta");
  if (outcome.kind === "accept") {
    ok(outcome.resolution.width === DEGRADE_RESOLUTIONS[0].width, "acepta con la resolución 640x480");
  }
}
{
  const outcome = decideCalibrationStep(FPS_THRESHOLD, 0);
  ok(outcome.kind === "accept", "exactamente en el umbral (15fps) se acepta, no se degrada");
}
{
  const outcome = decideCalibrationStep(14.9, 0);
  ok(outcome.kind === "degrade", "14.9fps (justo debajo del umbral) en res. 0 degrada a la siguiente");
  if (outcome.kind === "degrade") {
    ok(outcome.nextResolution.width === DEGRADE_RESOLUTIONS[1].width, "la siguiente resolución es 320x240");
  }
}

// --- decideCalibrationStep: último escalón (índice = length-1) ---
const lastIndex = DEGRADE_RESOLUTIONS.length - 1;
{
  const outcome = decideCalibrationStep(5, lastIndex);
  ok(outcome.kind === "fallback_manual", "5fps en el último escalón cae a manual, no hay más abajo");
}
{
  const outcome = decideCalibrationStep(FPS_THRESHOLD + 1, lastIndex);
  ok(outcome.kind === "accept", "si el último escalón SÍ alcanza el umbral, se acepta ahí también");
}

// --- índice fuera de rango: error explícito, no un resultado silenciosamente incorrecto ---
{
  let threw = false;
  try {
    decideCalibrationStep(30, DEGRADE_RESOLUTIONS.length);
  } catch {
    threw = true;
  }
  ok(threw, "resolutionIndex fuera de rango tira, no devuelve basura");
}

// --- deviceFingerprint / shouldRecalibrate ---
const fpA = deviceFingerprint("UA-A", 390, 844);
const fpB = deviceFingerprint("UA-A", 390, 844);
const fpC = deviceFingerprint("UA-B", 390, 844);
ok(fpA === fpB, "mismo userAgent + misma pantalla = mismo fingerprint");
ok(fpA !== fpC, "distinto userAgent = distinto fingerprint");

ok(shouldRecalibrate(null, fpA) === true, "sin calibración guardada, siempre hay que calibrar");

const stored: DeviceCalibrationResult = {
  deviceFingerprint: fpA,
  passed: true,
  resolution: DEGRADE_RESOLUTIONS[0],
  fps: 30,
  calibratedAt: Date.now(),
};
ok(shouldRecalibrate(stored, fpA) === false, "mismo fingerprint que lo guardado: no hace falta recalibrar");
ok(shouldRecalibrate(stored, fpC) === true, "fingerprint distinto (otro dispositivo/navegador): sí hay que recalibrar");

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
