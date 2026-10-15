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
): GuardedRepState {
  const nextCore = stepRepCounter(state.core, angle, config);
  if (nextCore.reps <= state.core.reps) {
    return { core: nextCore, lastRepAt: state.lastRepAt };
  }
  const tooSoon = state.lastRepAt !== null && now - state.lastRepAt < minIntervalMs;
  if (tooSoon) {
    return { core: { ...nextCore, reps: state.core.reps }, lastRepAt: state.lastRepAt };
  }
  return { core: nextCore, lastRepAt: now };
}
