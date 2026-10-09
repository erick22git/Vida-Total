"use client";

import { usePreferencesStore } from "@/lib/store/preferencesStore";

/**
 * Motor de sonido propio de Vida Total — todo sintetizado con Web Audio API
 * (sin archivos de audio). Es el ÚNICO lugar que crea el `AudioContext`:
 * ningún componente debe instanciarlo.
 *
 * Los navegadores bloquean el audio hasta que hay un gesto del usuario, por
 * eso `unlockAudio()` (que reanuda el contexto) se llama desde el primer
 * gesto (`pointerdown`) — ver `useHabitFeedback`. Si el audio está bloqueado
 * o el usuario lo desactivó, todo es silencioso y nunca lanza.
 */
export type SoundName =
  | "press" | "complete" | "milestone" | "level-up" | "navigation" | "error" | "rest-end"
  // Kegel: ascendente al apretar, corto a cuenta atrás, descendente al soltar, cierre al terminar
  | "kegel-squeeze" | "kegel-relax" | "kegel-countdown" | "kegel-done";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function enabled(): boolean {
  return usePreferencesStore.getState().soundEnabled;
}

/** Llamar desde un gesto del usuario para que el navegador permita audio. */
export function unlockAudio(): void {
  try {
    // iOS 17+: pide que el audio se trate como "reproducción" (no "ambiente"),
    // así el interruptor de silencio del iPhone no lo calla. Donde la API no
    // existe (otros navegadores, iOS antiguo) simplemente se ignora.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    const c = getContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  } catch {
    // sin audio disponible — no pasa nada
  }
}

interface ToneOpts {
  freq: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** Si se indica, la frecuencia se desliza hasta este valor durante `dur`. */
  glideTo?: number;
}

function tone(c: AudioContext, o: ToneOpts) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.at);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.at + o.dur);
  g.gain.setValueAtTime(0, o.at);
  g.gain.linearRampToValueAtTime(o.gain, o.at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.03);
}

const RECIPES: Record<SoundName, (c: AudioContext, t: number) => void> = {
  // Tic suave y grave, apenas audible: confirma que el gesto empezó.
  press: (c, t) => tone(c, { freq: 220, glideTo: 170, at: t, dur: 0.07, gain: 0.05 }),
  // Dos tonos en quinta justa — corto, limpio, sin "sonido de videojuego".
  complete: (c, t) => {
    tone(c, { freq: 880, at: t, dur: 0.22, gain: 0.05 });
    tone(c, { freq: 1318.5, at: t + 0.05, dur: 0.26, gain: 0.045 });
  },
  // Arpegio ascendente corto (mayor + octava): más ceremonia que `complete`.
  milestone: (c, t) => {
    [659.25, 830.6, 987.8, 1318.5].forEach((f, i) => tone(c, { freq: f, at: t + i * 0.07, dur: 0.32, gain: 0.05 }));
  },
  "level-up": (c, t) => {
    [523.25, 659.25, 783.99, 1046.5, 1568].forEach((f, i) => tone(c, { freq: f, at: t + i * 0.08, dur: 0.4, gain: 0.05 }));
  },
  // Aviso de fin de descanso: un "ding-dong" de notificación, UNA sola vez (lo constante es la vibración).
  "rest-end": (c, t) => {
    tone(c, { freq: 988, at: t, dur: 0.35, gain: 0.12 });
    tone(c, { freq: 740, at: t + 0.22, dur: 0.5, gain: 0.12 });
  },
  navigation: (c, t) => tone(c, { freq: 520, glideTo: 640, at: t, dur: 0.06, gain: 0.035 }),
  error: (c, t) => tone(c, { freq: 200, glideTo: 140, at: t, dur: 0.16, gain: 0.05, type: "triangle" }),
  // Kegel — tono ascendente al contraer
  "kegel-squeeze": (c, t) => tone(c, { freq: 440, glideTo: 660, at: t, dur: 0.18, gain: 0.06 }),
  // Kegel — tono descendente al soltar
  "kegel-relax": (c, t) => tone(c, { freq: 550, glideTo: 330, at: t, dur: 0.22, gain: 0.05 }),
  // Kegel — tic suave de cuenta atrás
  "kegel-countdown": (c, t) => tone(c, { freq: 880, at: t, dur: 0.06, gain: 0.04 }),
  // Kegel — acorde de cierre (tercera mayor)
  "kegel-done": (c, t) => {
    tone(c, { freq: 523.25, at: t, dur: 0.35, gain: 0.06 });
    tone(c, { freq: 659.25, at: t + 0.12, dur: 0.35, gain: 0.055 });
    tone(c, { freq: 783.99, at: t + 0.24, dur: 0.4, gain: 0.05 });
  },
};

export function playSound(name: SoundName): void {
  if (!enabled()) return;
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    RECIPES[name](c, c.currentTime);
  } catch {
    // Bloqueado por el navegador — silencioso a propósito.
  }
}

// Agua (PROVISIONAL — ver docs/sound/README.md): no se encontró un archivo CC0 de agua cayendo/salpicón,
// así que esto sigue sintetizado con un buffer de ruido filtrado en vez de una grabación real.
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const length = c.sampleRate; // 1 s de ruido blanco — se reproduce en loop para pours más largos
  const buf = c.createBuffer(1, length, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** Chorro de agua cayendo: dura `durationMs` (pensado para ser proporcional a los ml servidos) y
 * sube/baja de volumen al principio/final para no "cortar" de golpe. */
export function playWaterPour(durationMs: number, volumeScale = 1): void {
  if (!enabled()) return;
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    const dur = Math.max(0.15, Math.min(2.5, durationMs / 1000));
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    src.loop = true;
    const bandpass = c.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 0.7;
    const g = c.createGain();
    const peak = 0.05 * Math.min(1.4, Math.max(0.2, volumeScale));
    const attack = Math.min(0.08, dur * 0.25);
    const release = Math.min(0.12, dur * 0.3);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(peak, c.currentTime + attack);
    g.gain.setValueAtTime(peak, c.currentTime + dur - release);
    g.gain.linearRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(bandpass);
    bandpass.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + dur + 0.05);
  } catch {
    // sin audio disponible — silencioso a propósito
  }
}

/** Salpicón corto, para cuando el nivel del vaso llega a la marca servida. */
export function playWaterSplash(volumeScale = 1): void {
  if (!enabled()) return;
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const g = c.createGain();
    const peak = 0.09 * Math.min(1.4, Math.max(0.2, volumeScale));
    g.gain.setValueAtTime(peak, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    src.connect(hp);
    hp.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 0.2);
    tone(c, { freq: 1800, glideTo: 900, at: c.currentTime, dur: 0.1, gain: 0.03 * volumeScale });
  } catch {
    // sin audio disponible — silencioso a propósito
  }
}

/**
 * Sonido continuo mientras se mantiene presionado: un tono muy suave cuyo
 * tono sube con el progreso (0..1). Devuelve `update` y `stop`. Si el audio
 * no está disponible devuelve funciones vacías.
 */
export function startHoldSound(): { update: (progress: number) => void; stop: () => void } {
  const noop = { update: () => {}, stop: () => {} };
  if (!enabled()) return noop;
  try {
    const c = getContext();
    if (!c) return noop;
    if (c.state === "suspended") c.resume().catch(() => {});
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 196;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.02, c.currentTime + 0.08);
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    return {
      update: (p) => {
        try {
          osc.frequency.setTargetAtTime(196 + 260 * p, c.currentTime, 0.03);
        } catch {}
      },
      stop: () => {
        try {
          g.gain.cancelScheduledValues(c.currentTime);
          g.gain.setTargetAtTime(0, c.currentTime, 0.03);
          osc.stop(c.currentTime + 0.15);
        } catch {}
      },
    };
  } catch {
    return noop;
  }
}
