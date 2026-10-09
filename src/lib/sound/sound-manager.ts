"use client";

/**
 * Gestor de sonido REALISTA basado en archivos (public/sounds/manifest.json) — distinto del motor
 * sintetizado de `sound-engine.ts` (que sigue existiendo tal cual para Hábitos/Kegel/descanso, sin
 * tocar). Este gestor cubre los eventos nuevos: pickers, carruseles, modales, notificaciones, etc.
 *
 * Diseño:
 * - Nada se carga (ni `howler` ni el manifiesto) hasta que el sonido está PRENDIDO y hay un primer
 *   gesto del usuario (`unlockSoundManager`, igual de intención que `unlockAudio` del motor viejo).
 * - Cada evento tiene 1-3 variantes de archivo (manifest `files`), con volumen propio y variación de
 *   tono aleatoria (`pitchVariance`, Howler `rate()`) para que no suene idéntico cada vez.
 * - Fundido de entrada corto (`fade`) para no "clickear" al arrancar.
 * - Límite de reproducciones simultáneas (`MAX_SIMULTANEOUS`) para no saturar si varios eventos
 *   disparan sonido casi a la vez (p. ej. abrir una notificación mientras se cierra un modal).
 * - Eventos marcados `synth: "provisional"` en el manifiesto (hoy: agua) no tienen archivo real
 *   todavía — ver docs/sound/README.md — y se resuelven con el motor sintetizado viejo.
 */
import { usePreferencesStore } from "@/lib/store/preferencesStore";
import { playWaterPour, playWaterSplash } from "./sound-engine";

export type SoundEvent =
  | "button-tap"
  | "picker-step"
  | "carousel-change"
  | "scroll-snap"
  | "screen-enter"
  | "task-complete"
  | "milestone"
  | "add-item"
  | "modal-open"
  | "modal-close"
  | "notification-appear"
  | "notification-expand"
  | "notification-collapse"
  | "notification-dismiss"
  | "permission-prompt"
  | "error"
  | "goal-reached"
  | "water-pour"
  | "water-splash";

interface ManifestEntry {
  files: string[];
  volume: number;
  pitchVariance: number;
  synth?: "provisional";
  source: string;
}
interface Manifest {
  events: Record<string, ManifestEntry>;
}

const MAX_SIMULTANEOUS = 6;
/** Fundido de entrada en ms — evita el "click" de arrancar un sample a mitad de su onda. */
const FADE_IN_MS = 15;

let manifestPromise: Promise<Manifest> | null = null;
// Importado solo bajo demanda: el bundle inicial no carga howler si el sonido nunca se prende.
let howlerModPromise: Promise<typeof import("howler")> | null = null;
const howlCache = new Map<string, import("howler").Howl>();
let activeCount = 0;

function soundEnabled(): boolean {
  return usePreferencesStore.getState().soundEnabled;
}

function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch("/sounds/manifest.json")
      .then((r) => r.json())
      .catch(() => ({ events: {} }) as Manifest);
  }
  return manifestPromise;
}

function loadHowler() {
  if (!howlerModPromise) howlerModPromise = import("howler");
  return howlerModPromise;
}

/**
 * Llamar en el primer gesto del usuario tras prender el sonido (mismo rol que `unlockAudio` del
 * motor sintetizado). Precarga el manifiesto y resuelve el `AudioContext` compartido de Howler para
 * que iOS no lo bloquee, y lo marca como "playback" para que el interruptor de silencio no lo calle.
 */
export function unlockSoundManager(): void {
  if (!soundEnabled()) return;
  void loadManifest();
  void loadHowler().then(({ Howler }) => {
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
      Howler.ctx?.resume().catch(() => {});
    } catch {
      // sin audio disponible — no pasa nada
    }
  });
}

function pickFile(files: string[]): string | null {
  if (files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

/**
 * Reproduce un evento del manifiesto. `volumeScale` escala el volumen base del evento (0..~1.4);
 * `durationMs` solo lo usan los eventos de agua (duración del chorro, proporcional a los ml).
 * Silencioso si el sonido está apagado, el evento no existe, el audio está bloqueado, o se llegó al
 * límite de sonidos simultáneos — nunca lanza.
 */
export async function playEvent(name: SoundEvent, opts?: { volumeScale?: number; durationMs?: number }): Promise<void> {
  if (!soundEnabled()) return;
  try {
    const manifest = await loadManifest();
    const entry = manifest.events[name];
    if (!entry) return;

    if (entry.synth === "provisional") {
      if (name === "water-pour") playWaterPour(opts?.durationMs ?? 600, opts?.volumeScale ?? 1);
      else if (name === "water-splash") playWaterSplash(opts?.volumeScale ?? 1);
      return;
    }

    if (activeCount >= MAX_SIMULTANEOUS) return;
    const file = pickFile(entry.files);
    if (!file) return;

    const { Howl } = await loadHowler();
    let howl = howlCache.get(file);
    if (!howl) {
      howl = new Howl({ src: [`/sounds/${file}.ogg`, `/sounds/${file}.mp3`], preload: true });
      howlCache.set(file, howl);
    }

    const volume = entry.volume * (opts?.volumeScale ?? 1);
    const pitch = 1 + (Math.random() * 2 - 1) * entry.pitchVariance;
    const id = howl.play();
    howl.rate(pitch, id);
    howl.volume(0, id);
    howl.fade(0, volume, FADE_IN_MS, id);
    activeCount++;
    const release = () => {
      activeCount = Math.max(0, activeCount - 1);
    };
    howl.once("end", release, id);
    howl.once("stop", release, id);
  } catch {
    // Bloqueado por el navegador o sin red para el manifiesto — silencioso a propósito.
  }
}
