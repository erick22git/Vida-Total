/**
 * Seguimiento de barra/mancuerna por marcador de color (roadmap sección 3.4/3.6, punto 4).
 * Visión clásica, no un modelo de IA: convertir cada píxel a HSV, quedarse con los que caen cerca
 * del color calibrado, y promediar sus posiciones — el mismo algoritmo que usan los proyectos de
 * bar-path citados en el roadmap. Puro: recibe un buffer de píxeles ya leído (`getImageData`), no
 * toca el DOM ni la cámara — eso es trabajo del caller en la pantalla de cámara.
 *
 * Por qué HSV y no comparar RGB directo: el matiz (hue) se mantiene razonablemente estable aunque
 * cambie la iluminación (una cinta fosforescente rosa se ve "más clara" o "más oscura" según la
 * luz, pero el matiz casi no cambia) — comparar RGB directo sería mucho más sensible a eso.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HsvColor {
  /** grados, [0, 360). */
  h: number;
  /** [0, 1]. */
  s: number;
  /** [0, 1]. */
  v: number;
}

export function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/** Distancia circular entre dos matices (0°/360° son el mismo color, no están "lejos"). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface MarkerTrackerConfig {
  targetColor: RgbColor;
  /** grados — qué tan lejos del matiz calibrado todavía cuenta como "el marcador". Criterio
   * propio: lo bastante angosto para no confundirse con otros colores del cuadro, lo bastante
   * ancho para tolerar variación real de iluminación. */
  hueTolerance: number;
  /** Rechaza píxeles grises/oscuros que por casualidad caen cerca del matiz pero no son el
   * marcador real (un marcador fluorescente es, por definición, saturado y claro). */
  minSaturation: number;
  minValue: number;
  /** Cada cuántos píxeles se muestrea en cada eje — no se recorre el frame entero por
   * rendimiento; un marcador ocupa muchos píxeles, así que muestrear alcanza para encontrarlo. */
  sampleStride: number;
  /** Mínimo de píxeles que tienen que matchear para considerar que el marcador fue encontrado —
   * sin esto, un puñado de píxeles sueltos de otro objeto parecido contaría como "lo encontré". */
  minMatchingPixels: number;
}

export const DEFAULT_MARKER_CONFIG: Omit<MarkerTrackerConfig, "targetColor"> = {
  hueTolerance: 18,
  minSaturation: 0.35,
  minValue: 0.3,
  sampleStride: 4,
  minMatchingPixels: 12,
};

export interface MarkerPosition {
  /** [0, 1] normalizado al ancho/alto del buffer que se le pasó. */
  xNorm: number;
  yNorm: number;
  matchingPixels: number;
}

/** `pixels` es RGBA (4 valores por píxel, como devuelve `ImageData.data`). */
export function findMarker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: MarkerTrackerConfig,
): MarkerPosition | null {
  const targetHsv = rgbToHsv(config.targetColor);
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < height; y += config.sampleStride) {
    for (let x = 0; x < width; x += config.sampleStride) {
      const idx = (y * width + x) * 4;
      const hsv = rgbToHsv({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
      if (hsv.s < config.minSaturation || hsv.v < config.minValue) continue;
      if (hueDistance(hsv.h, targetHsv.h) > config.hueTolerance) continue;
      sumX += x;
      sumY += y;
      count++;
    }
  }

  if (count < config.minMatchingPixels) return null;
  return { xNorm: sumX / count / width, yNorm: sumY / count / height, matchingPixels: count };
}
