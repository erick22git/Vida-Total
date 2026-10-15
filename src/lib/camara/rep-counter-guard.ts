/**
 * Arreglo del conteo de reps (sección 3.1/3.6 del roadmap). Envuelve `rep-counter.ts` (sin tocarlo,
 * ya tiene sus propios tests) con un tiempo mínimo entre repeticiones contadas — una repetición
 * real de press de banca o sentadilla tarda al menos ~1 segundo; sin este mínimo, un ángulo que
 * oscila rápido por ruido podía contar varias "repeticiones" en una fracción de segundo.
 */
import { initRepCounter, stepRepCounter, type RepCounterConfig, type RepCounterState } from "./rep-counter";

/** Tiempo mínimo entre dos repeticiones contadas — criterio propio (una repetición controlada
 * tarda más que esto en cualquiera de los 4 ejercicios de la primera tanda), no de la literatura. */
export const MIN_REP_INTERVAL_MS = 500;

/** Cuánto dura la "ventana de arranque" en la que ninguna repetición se cuenta todavía, aunque la
 * máquina de estados vea un ciclo completo — recién empezando, la cámara/el usuario todavía se
 * están acomodando, y un ángulo que se confunde en ese momento no debería contarse como una
 * repetición real (reportado en una prueba real: reps fantasma justo al arrancar). Criterio
 * propio, no de la literatura — suficiente para que la imagen se asiente, poco para no hacer
 * esperar al usuario antes de poder contar de verdad. */
export const STARTUP_GRACE_MS = 1500;

export interface GuardedRepState {
  core: RepCounterState;
  /** `performance.now()` (o el reloj que use el caller) de la última repetición que SÍ se contó —
   * `null` todavía no se contó ninguna. */
  lastRepAt: number | null;
}

export function initGuardedRepCounter(config: RepCounterConfig): GuardedRepState {
  return { core: initRepCounter(config), lastRepAt: null };
}

/**
 * Avanza un frame. Si la máquina de estados de abajo sumaría una repetición pero llegó antes de
 * `minIntervalMs` desde la última contada, el cambio de FASE se respeta igual (el movimiento sí
 * pasó por ahí) pero el conteo de reps NO sube — evita tanto el conteo fantasma por ruido rápido
 * como quedar en un estado de fase inconsistente con el ángulo real.
 */
export function stepGuardedRepCounter(
  state: GuardedRepState,
  angle: number,
  config: RepCounterConfig,
  now: number,
  minIntervalMs: number = MIN_REP_INTERVAL_MS,
  /** `performance.now()` hasta el cual ninguna repetición cuenta todavía — ver `STARTUP_GRACE_MS`.
   * `0` (default) desactiva la ventana de arranque (útil en tests que no la necesitan). */
  graceEndAt: number = 0,
): GuardedRepState {
  const nextCore = stepRepCounter(state.core, angle, config);
  if (nextCore.reps <= state.core.reps) {
    return { core: nextCore, lastRepAt: state.lastRepAt };
  }
  const tooSoonAfterLastRep = state.lastRepAt !== null && now - state.lastRepAt < minIntervalMs;
  const withinStartupGrace = now < graceEndAt;
  if (tooSoonAfterLastRep || withinStartupGrace) {
    return { core: { ...nextCore, reps: state.core.reps }, lastRepAt: state.lastRepAt };
  }
  return { core: nextCore, lastRepAt: now };
}
