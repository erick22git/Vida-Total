/**
 * Fase D del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.3/2.1.8).
 *
 * Mapeo EXPLÍCITO y conservador de `id` del catálogo (`src/lib/data/exercises.json`) a los 4
 * ejercicios de la primera tanda — a propósito, solo la variante "canónica" de cada uno.
 * Variantes como sentadilla búlgara, peso muerto rumano/sumo, press en multipower, etc. tienen una
 * biomecánica distinta a la investigada en el roadmap (ángulos, rango de movimiento), así que NO
 * se mapean acá: agregarlas requeriría su propia investigación citada, no asumir que el mismo
 * umbral aplica.
 */
import type { CameraExerciseId } from "./exercise-configs";

export const CATALOG_ID_TO_CAMERA_EXERCISE: Readonly<Record<string, CameraExerciseId>> = {
  "sentadilla-barra": "sentadilla",
  "peso-muerto": "peso_muerto",
  "press-banca-barra": "press_banca",
  "curl-biceps-barra": "curl_biceps",
};

export function cameraExerciseIdFor(catalogExerciseId: string): CameraExerciseId | null {
  return CATALOG_ID_TO_CAMERA_EXERCISE[catalogExerciseId] ?? null;
}
