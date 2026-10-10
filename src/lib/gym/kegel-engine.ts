/**
 * Motor de sesión Kegel — máquina de estados PURA.
 *
 * - Basado en timestamps (Date.now()), no en conteo de ticks de setInterval.
 *   Al volver desde segundo plano, `tick(now)` recalcula el estado correcto.
 * - La UI solo LEE el estado del motor; toda la lógica de tiempo vive aquí.
 * - Fases: prepare → (squeeze → relax) × reps de la serie → rest (si hay más
 *   series) → siguiente serie → ... → done.
 * - Salir a medias: guarda `partial=true`. No cuenta para racha/nivel.
 */

import { REST_BETWEEN_SERIES_SEC, type KegelSessionDef } from "./kegel-plan";

// ─────────────────────────────────────────────────────────
// Fases visibles
// ─────────────────────────────────────────────────────────

export type EnginePhase =
  | "idle"      // Antes de empezar
  | "prepare"   // Cuenta atrás inicial (3 s)
  | "squeeze"   // Contraer / sostener
  | "relax"     // Relajar
  | "rest"      // Descanso entre series
  | "done";     // Terminado

export const PHASE_LABEL: Record<EnginePhase, string> = {
  idle: "LISTO",
  prepare: "PREPARA",
  squeeze: "CONTRAE",
  relax: "RELAJA",
  rest: "DESCANSA",
  done: "TERMINADO",
};

export const PHASE_AMP: Record<EnginePhase, number> = {
  idle: 0,
  prepare: 0.3,
  squeeze: 1,
  relax: 0.15,
  rest: 0.15,
  done: 0,
};

export const PREPARE_SEC = 3;

// ─────────────────────────────────────────────────────────
// Estado del motor
// ─────────────────────────────────────────────────────────

export interface EngineState {
  phase: EnginePhase;
  /** Índice de la serie actual dentro de `def.series` (0–8). */
  seriesIndex: number;
  /** Repetición actual dentro de la serie (0-indexed). */
  repIndex: number;
  /** Segundos transcurridos en la FASE actual. */
  phaseElapsed: number;
  /** Duración total de la FASE actual en segundos. */
  phaseDuration: number;
  /** Pausa activa. */
  paused: boolean;
  /** El usuario salió antes de terminar. */
  partial: boolean;
  /** timestamp (Date.now()) cuando se llamó start(). */
  startedAt: number;
  /** Segundos acumulados de ejercicio real (sin pausas, sin prepare/rest). */
  activeSeconds: number;
  /** Segundos transcurridos de TODA la sesión (prepare+rest incluidos) — para el progreso 0–1 sin
   * tener que leer refs durante el render (ver `useKegelEngine`). */
  totalElapsed: number;
}

// ─────────────────────────────────────────────────────────
// Construcción del plan de fases para una sesión
// ─────────────────────────────────────────────────────────

interface Step {
  phase: EnginePhase;
  duration: number;
  seriesIndex: number;
  repIndex: number;
}

export function buildSteps(def: KegelSessionDef): Step[] {
  const steps: Step[] = [];
  // Cuenta atrás inicial
  steps.push({ phase: "prepare", duration: PREPARE_SEC, seriesIndex: 0, repIndex: 0 });

  for (let si = 0; si < def.series.length; si++) {
    const s = def.series[si];
    for (let ri = 0; ri < s.reps; ri++) {
      steps.push({ phase: "squeeze", duration: s.squeezeSeconds, seriesIndex: si, repIndex: ri });
      steps.push({ phase: "relax", duration: s.relaxSeconds, seriesIndex: si, repIndex: ri });
    }
    const isLast = si === def.series.length - 1;
    if (!isLast) steps.push({ phase: "rest", duration: REST_BETWEEN_SERIES_SEC, seriesIndex: si, repIndex: s.reps - 1 });
  }
  return steps;
}

// ─────────────────────────────────────────────────────────
// Cálculo del estado dado el tiempo acumulado
// ─────────────────────────────────────────────────────────

export function stateFromElapsed(steps: Step[], totalElapsed: number): EngineState {
  const clampedElapsed = Math.max(0, totalElapsed);
  let remaining = clampedElapsed;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (remaining < s.duration) {
      return {
        phase: s.phase,
        seriesIndex: s.seriesIndex,
        repIndex: s.repIndex,
        phaseElapsed: remaining,
        phaseDuration: s.duration,
        paused: false,
        partial: false,
        startedAt: 0,
        activeSeconds: calcActiveSeconds(steps, i, remaining),
        totalElapsed: clampedElapsed,
      };
    }
    remaining -= s.duration;
  }

  // Terminado
  const last = steps[steps.length - 1];
  const fullDuration = steps.reduce((a, s) => a + s.duration, 0);
  return {
    phase: "done",
    seriesIndex: last?.seriesIndex ?? 0,
    repIndex: last?.repIndex ?? 0,
    phaseElapsed: 0,
    phaseDuration: 0,
    paused: false,
    partial: false,
    startedAt: 0,
    activeSeconds: calcActiveSeconds(steps, steps.length, 0),
    totalElapsed: fullDuration,
  };
}

function calcActiveSeconds(steps: Step[], currentStepIndex: number, phaseElapsed: number): number {
  let secs = 0;
  for (let i = 0; i < currentStepIndex; i++) {
    const s = steps[i];
    if (s.phase === "squeeze" || s.phase === "relax") secs += s.duration;
  }
  const cur = steps[currentStepIndex];
  if (cur && (cur.phase === "squeeze" || cur.phase === "relax")) secs += phaseElapsed;
  return Math.round(secs);
}

// ─────────────────────────────────────────────────────────
// Handle del motor (para uso en componentes)
// ─────────────────────────────────────────────────────────

export interface EngineHandle {
  state: EngineState;
  /** Llama en cada tick del intervalo (con Date.now()). */
  tick: (now: number) => void;
  pause: () => void;
  resume: () => void;
  /** Salir a medias — devuelve el estado marcado como partial. */
  exit: () => EngineState;
  totalDuration: number;
  /** Progreso 0–1 de toda la sesión. */
  progress: number;
}

// ─────────────────────────────────────────────────────────
// Hook de React para el motor
// ─────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

export function useKegelEngine(def: KegelSessionDef): EngineHandle {
  // Todo lo que depende de `Date.now()`/de otro ref se calcula UNA vez acá (el inicializador perezoso
  // de useState es el único lugar donde React permite trabajo "impuro" de una sola vez) — los
  // `useRef` de abajo solo copian esos valores ya calculados, nunca leen `.current` de otro ref ni
  // llaman `Date.now()` directamente, así nada de esto se evalúa "durante el render".
  const [init] = useState(() => {
    const builtSteps = buildSteps(def);
    return {
      steps: builtSteps,
      totalDuration: builtSteps.reduce((a, s) => a + s.duration, 0),
      startedAt: Date.now(),
    };
  });

  const steps = useRef(init.steps);
  const totalDuration = init.totalDuration;

  const startedAt = useRef<number>(init.startedAt);
  const pausedAt = useRef<number | null>(null);
  const pausedElapsed = useRef<number>(0); // acumulado antes de esta pausa

  const [state, setState] = useState<EngineState>(() => ({
    ...stateFromElapsed(init.steps, 0),
    startedAt: init.startedAt,
  }));

  const tick = useCallback((now: number) => {
    if (pausedAt.current !== null) return; // pausado
    const elapsed = pausedElapsed.current + (now - startedAt.current) / 1000;
    const next = stateFromElapsed(steps.current, elapsed);
    setState((prev) => ({
      ...next,
      paused: false,
      partial: prev.partial,
      startedAt: startedAt.current,
    }));
  }, []);

  const pause = useCallback(() => {
    if (pausedAt.current !== null) return;
    pausedAt.current = Date.now();
    setState((prev) => ({ ...prev, paused: true }));
  }, []);

  const resume = useCallback(() => {
    if (pausedAt.current === null) return;
    // El tiempo que llevamos pausados se suma al acumulado pre-pausa
    pausedElapsed.current += (Date.now() - pausedAt.current) / 1000;
    // El nuevo "startedAt" es ahora (el tick calcula elapsed = pausedElapsed + (now - startedAt))
    startedAt.current = Date.now();
    pausedAt.current = null;
    setState((prev) => ({ ...prev, paused: false }));
  }, []);

  const exit = useCallback((): EngineState => {
    const partial: EngineState = { ...state, partial: true };
    setState(partial);
    return partial;
  }, [state]);

  // Intervalo de 100ms
  useEffect(() => {
    const id = setInterval(() => tick(Date.now()), 100);
    return () => clearInterval(id);
  }, [tick]);

  // Derivado del `state` ya calculado por el tick (no lee refs ni `Date.now()` durante el render).
  const progress = totalDuration > 0 ? Math.min(1, state.totalElapsed / totalDuration) : 0;

  return {
    state,
    tick,
    pause,
    resume,
    exit,
    totalDuration,
    progress,
  };
}

// ─────────────────────────────────────────────────────────
// Screen Wake Lock (best-effort)
// ─────────────────────────────────────────────────────────

export function useWakeLock(active: boolean): { supported: boolean } {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;

    if (active) {
      nav.wakeLock.request("screen")
        .then((lock) => { lockRef.current = lock; })
        .catch(() => {}); // Silencioso: sin soporte o bloqueado
    } else {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    }

    return () => {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);

  const supported = typeof window !== "undefined" &&
    !!(navigator as Navigator & { wakeLock?: unknown }).wakeLock;

  return { supported };
}
