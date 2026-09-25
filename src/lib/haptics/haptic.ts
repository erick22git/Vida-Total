import { HAPTIC_PATTERNS } from "./haptics";

/**
 * Feedback háptico con nombre. Usa la Vibration API solo si el dispositivo
 * la soporta (Android/Chrome sí; iOS Safari no la expone). Si no existe no
 * hace nada ni lanza: el feedback visual y el sonido siguen funcionando.
 */
export type HapticKind = "light" | "medium" | "success" | "milestone";

const PATTERNS: Record<HapticKind, readonly number[]> = {
  light: HAPTIC_PATTERNS.pressStart,
  medium: [20],
  success: HAPTIC_PATTERNS.habitComplete,
  milestone: HAPTIC_PATTERNS.milestone,
};

export function isHapticSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind: HapticKind): void {
  if (!isHapticSupported()) return;
  try {
    navigator.vibrate(PATTERNS[kind] as number[]);
  } catch {
    // Algunos navegadores lanzan si no hubo gesto previo — ignorar.
  }
}
