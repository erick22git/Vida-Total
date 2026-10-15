/**
 * Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, secciones 2.1.3 y
 * 2.1.8). Máquina de estados de conteo de repeticiones a partir de UN ángulo articular — no
 * necesita el umbral de "forma correcta", solo detecta que el ángulo recorrió el rango completo
 * entre sus dos extremos. Por eso aplica a los 4 ejercicios de la primera tanda (sentadilla, peso
 * muerto, press de banca, curl), aunque solo sentadilla/peso muerto tengan además validación de
 * forma (Fase C).
 *
 * Importante: esto cuenta la repetición, nunca la guarda sola — la decisión de producto (sección
 * 2.1.8, Opción 2) es que el número se sugiere y el usuario confirma antes de guardar. Esa
 * conexión con el registro manual es trabajo de la Fase D, no de este módulo.
 */

export type ExtremePhase = "extended" | "flexed";
export type MovementPhase = ExtremePhase | "flexing" | "extending";

export interface RepCounterConfig {
  /** ángulo (grados) a partir del cual se considera "extendido" (pierna/brazo casi recto). */
  extendedThreshold: number;
  /** ángulo (grados) por debajo del cual se considera "flexionado" (abajo del todo). Debe ser
   * menor que `extendedThreshold` — la zona entre ambos es la transición, para evitar que el ruido
   * del tracking alrededor de un único umbral cuente repeticiones de más (histéresis). */
  flexedThreshold: number;
  /** desde qué extremo arranca el ejercicio — define el instante en que se cuenta "1 repetición".
   * Sentadilla arranca parado (extended); peso muerto arranca agachado sosteniendo la barra
   * (flexed). */
  startExtreme: ExtremePhase;
}

export interface RepCounterState {
  phase: MovementPhase;
  /** true si ya se visitó el extremo opuesto a `startExtreme` desde la última repetición contada —
   * sin esto, un ángulo que tiembla cerca de `startExtreme` sin llegar nunca al otro extremo
   * contaría repeticiones fantasma. */
  visitedOpposite: boolean;
  reps: number;
}

function oppositeOf(extreme: ExtremePhase): ExtremePhase {
  return extreme === "extended" ? "flexed" : "extended";
}

export function initRepCounter(config: RepCounterConfig): RepCounterState {
  if (config.extendedThreshold <= config.flexedThreshold) {
    throw new Error("RepCounterConfig: extendedThreshold debe ser mayor que flexedThreshold");
  }
  return { phase: config.startExtreme, visitedOpposite: false, reps: 0 };
}

/** Avanza la máquina de estados un frame, con el ángulo medido en ese frame. Pura: mismo estado +
 * mismo ángulo + misma config → mismo resultado, sin leer ni escribir nada externo. */
export function stepRepCounter(
  state: RepCounterState,
  angle: number,
  config: RepCounterConfig,
): RepCounterState {
  if (Number.isNaN(angle)) return state; // frame sin landmarks confiables: se ignora, no se pierde el estado.

  let zone: MovementPhase;
  if (angle >= config.extendedThreshold) {
    zone = "extended";
  } else if (angle <= config.flexedThreshold) {
    zone = "flexed";
  } else {
    // Zona intermedia: seguir la dirección en la que ya se venía moviendo, en vez de "saltar" de
    // extremo a extremo sin pasar por la transición.
    zone = state.phase === "extended" || state.phase === "flexing" ? "flexing" : "extending";
  }

  const enteringExtended = zone === "extended" && state.phase !== "extended";
  const enteringFlexed = zone === "flexed" && state.phase !== "flexed";

  const opposite = oppositeOf(config.startExtreme);
  let visitedOpposite = state.visitedOpposite;
  if ((opposite === "extended" && enteringExtended) || (opposite === "flexed" && enteringFlexed)) {
    visitedOpposite = true;
  }

  const enteringStart =
    (config.startExtreme === "extended" && enteringExtended) ||
    (config.startExtreme === "flexed" && enteringFlexed);

  let reps = state.reps;
  if (enteringStart && visitedOpposite) {
    reps += 1;
    visitedOpposite = false;
  }

  return { phase: zone, visitedOpposite, reps };
}
