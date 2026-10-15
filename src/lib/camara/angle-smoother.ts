/**
 * Arreglo del conteo de reps (sección 3.1/3.6 del roadmap, docs/roadmap/vision-entrenador.md).
 * Promedio móvil exponencial (EMA) sobre el ángulo medido, para que el ruido de un solo frame
 * (mano borrosa, mala luz, landmark con poca confianza) no se traduzca 1 a 1 en una repetición de
 * más — sin este suavizado, el ángulo crudo de MediaPipe entraba directo a la máquina de estados.
 */

/** Qué tanto pesa la medición nueva contra el valor suavizado anterior — más alto reacciona más
 * rápido al movimiento real pero amortigua menos el ruido; más bajo amortigua más pero atrasa la
 * detección. Criterio propio, ajustado para que siga un movimiento de ~1-2s por repetición sin
 * quedar atrás, no un número de la literatura. */
export const ANGLE_SMOOTHING_ALPHA = 0.35;

/**
 * `prevSmoothed` es `null` antes del primer frame válido (se inicializa directo con `rawAngle`).
 * Un `rawAngle` de `NaN` (frame sin landmarks confiables) no mueve el valor suavizado — se
 * mantiene el último válido en vez de arrastrar basura al promedio.
 */
export function smoothAngle(prevSmoothed: number | null, rawAngle: number, alpha: number = ANGLE_SMOOTHING_ALPHA): number {
  if (Number.isNaN(rawAngle)) return prevSmoothed ?? NaN;
  if (prevSmoothed === null || Number.isNaN(prevSmoothed)) return rawAngle;
  return prevSmoothed + alpha * (rawAngle - prevSmoothed);
}
