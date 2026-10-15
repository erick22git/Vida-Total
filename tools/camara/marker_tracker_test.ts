// Seguimiento de barra/mancuerna por marcador de color (roadmap sección 3.4/3.6).
// node tools/3d/verify/run_ts.mjs tools/camara/marker_tracker_test.ts
import { rgbToHsv, hueDistance, findMarker, DEFAULT_MARKER_CONFIG, type RgbColor } from "../../src/lib/camara/marker-tracker";

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
  ok(Math.abs(actual - expected) <= tolerance, `${msg} (dio ${actual}, esperaba ≈${expected})`);
}

// --- rgbToHsv: colores conocidos ---
close(rgbToHsv({ r: 255, g: 0, b: 0 }).h, 0, 0.1, "rojo puro: matiz 0°");
close(rgbToHsv({ r: 0, g: 255, b: 0 }).h, 120, 0.1, "verde puro: matiz 120°");
close(rgbToHsv({ r: 0, g: 0, b: 255 }).h, 240, 0.1, "azul puro: matiz 240°");
close(rgbToHsv({ r: 255, g: 0, b: 255 }).h, 300, 0.1, "magenta puro: matiz 300°");
{
  const grey = rgbToHsv({ r: 128, g: 128, b: 128 });
  ok(grey.s === 0, "gris: saturación 0 (sin color definido)");
}

// --- hueDistance: circular, 0°/360° son el mismo color ---
close(hueDistance(10, 350), 20, 0.1, "10° y 350° están a 20° de distancia (cruzando el 0°), no a 340°");
close(hueDistance(0, 180), 180, 0.1, "0° y 180° son opuestos: 180° de distancia (el máximo posible)");
close(hueDistance(40, 50), 10, 0.1, "distancia simple cuando no cruza el 0°");

// --- findMarker: buffer sintético (RGBA) con un bloque de color conocido en una posición conocida ---
function makeBuffer(width: number, height: number, bg: RgbColor, markerRect: { x0: number; y0: number; x1: number; y1: number; color: RgbColor } | null): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inMarker = markerRect && x >= markerRect.x0 && x < markerRect.x1 && y >= markerRect.y0 && y < markerRect.y1;
      const color = inMarker ? markerRect!.color : bg;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }
  return data;
}

const HOT_PINK: RgbColor = { r: 255, g: 20, b: 180 };
const GREY_BG: RgbColor = { r: 100, g: 100, b: 100 };

{
  const width = 100;
  const height = 100;
  const data = makeBuffer(width, height, GREY_BG, { x0: 40, y0: 40, x1: 60, y1: 60, color: HOT_PINK });
  const config = { ...DEFAULT_MARKER_CONFIG, targetColor: HOT_PINK };
  const pos = findMarker(data, width, height, config);
  ok(pos !== null, "encuentra el marcador cuando está presente en el frame");
  if (pos) {
    close(pos.xNorm, 0.5, 0.05, "centro del marcador en x ≈ 0.5 (está en el centro del frame)");
    close(pos.yNorm, 0.5, 0.05, "centro del marcador en y ≈ 0.5");
  }
}
{
  // Marcador desplazado a una esquina — el centroide debe seguirlo.
  const width = 100;
  const height = 100;
  const data = makeBuffer(width, height, GREY_BG, { x0: 0, y0: 0, x1: 25, y1: 25, color: HOT_PINK });
  const config = { ...DEFAULT_MARKER_CONFIG, targetColor: HOT_PINK };
  const pos = findMarker(data, width, height, config);
  ok(pos !== null && pos.xNorm < 0.3 && pos.yNorm < 0.3, `marcador en la esquina superior izquierda: centroide ahí también (dio ${JSON.stringify(pos)})`);
}
{
  // Sin marcador en el frame: no inventa una posición.
  const width = 100;
  const height = 100;
  const data = makeBuffer(width, height, GREY_BG, null);
  const config = { ...DEFAULT_MARKER_CONFIG, targetColor: HOT_PINK };
  const pos = findMarker(data, width, height, config);
  ok(pos === null, "sin marcador en el frame: devuelve null, no una posición inventada");
}
{
  // Un color MUY distinto al calibrado (verde vs. rosa) tampoco matchea.
  const width = 100;
  const height = 100;
  const data = makeBuffer(width, height, GREY_BG, { x0: 40, y0: 40, x1: 60, y1: 60, color: { r: 0, g: 255, b: 0 } });
  const config = { ...DEFAULT_MARKER_CONFIG, targetColor: HOT_PINK };
  const pos = findMarker(data, width, height, config);
  ok(pos === null, "un bloque verde no matchea un marcador calibrado en rosa");
}
{
  // Un bloque demasiado chico (menos que minMatchingPixels tras el muestreo) no cuenta como encontrado.
  const width = 100;
  const height = 100;
  const data = makeBuffer(width, height, GREY_BG, { x0: 50, y0: 50, x1: 52, y1: 52, color: HOT_PINK });
  const config = { ...DEFAULT_MARKER_CONFIG, targetColor: HOT_PINK };
  const pos = findMarker(data, width, height, config);
  ok(pos === null, "un bloque demasiado chico (ruido, no el marcador real) no cuenta como encontrado");
}

console.log(`\n${checks - fails}/${checks} checks OK`);
if (fails > 0) {
  console.log(`${fails} FALLARON`);
  process.exit(1);
}
