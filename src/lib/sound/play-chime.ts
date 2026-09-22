"use client";

import { usePreferencesStore } from "@/lib/store/preferencesStore";

/**
 * "Ding" corto sintetizado con Web Audio API — sin archivo de audio que
 * mantener ni licencia que verificar. Dos tonos (un intervalo de 5ª,
 * como un mini carillón) con una envolvente rápida de attack/decay,
 * ~280ms en total. Reemplazable después por un .mp3 si se quiere un
 * timbre más rico, sin tocar quien lo llama (`playChime()`).
 *
 * Nunca fuerza audio: si el navegador bloquea el AudioContext (autoplay
 * policy) o el usuario desactivó el sonido en preferencias, no hace nada
 * y no lanza.
 */
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

function tone(ctx: AudioContext, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function playChime(): void {
  if (!usePreferencesStore.getState().soundEnabled) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    tone(ctx, 880, now, 0.22, 0.05); // A5
    tone(ctx, 1318.5, now + 0.05, 0.24, 0.045); // E6 — quinta justa, efecto "campanita"
  } catch {
    // Bloqueado por el navegador (autoplay) o AudioContext no disponible —
    // silencioso a propósito, nunca debe romper la interacción.
  }
}
