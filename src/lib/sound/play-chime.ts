"use client";

import { playSound } from "./sound-engine";

/** Atajo histórico — el sonido de "completar". Toda la síntesis vive en
 * `sound-engine.ts` (único dueño del AudioContext). */
export function playChime(): void {
  playSound("complete");
}
