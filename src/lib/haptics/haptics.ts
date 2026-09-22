/**
 * Patrones de vibración con nombre — inspirados en cómo se siente el
 * haptic feedback de Not Boring Habits al completar una acción: breve, con
 * "textura" (varios pulsos cortos), nunca una vibración larga y genérica.
 * Ajustar estos números por prueba y error en un teléfono real.
 */
export const HAPTIC_PATTERNS = {
  /** Al empezar a mantener presionado el check — un toque casi imperceptible,
   * solo para confirmar que el gesto arrancó. */
  pressStart: [10],
  /** Al completar un hábito/paso — 2 pulsos cortos separados. */
  habitComplete: [25, 40, 25],
  /** Al cruzar un milestone de racha — un poco más largo/marcado, pero
   * sigue siendo corto (nunca más de ~300ms en total). */
  milestone: [30, 50, 30, 50, 60],
} as const;

export function vibrate(pattern: readonly number[]): void {
  if (typeof navigator === "undefined") return;
  navigator.vibrate?.(pattern as number[]);
}
