/**
 * Progresión de peso entre sesiones (pedido: "sugerencia de peso para ir aumentando progresivamente
 * con base científica"). No inventa un sistema nuevo: conecta `weightSuggestion` de
 * `hypertrophy-engine.ts` (dirección subir/mantener/bajar según RIR — Helms et al. 2016, validez
 * publicada de la autorregulación por RIR, ver docs/ciencia-entrenamiento.md) con un peso concreto a
 * sugerir. `weightSuggestion` ya existía en el motor pero no estaba conectada a ninguna pantalla.
 *
 * "hitTargetReps": la app no guarda un rango de reps planificado por ejercicio (no existe ese campo en
 * el modelo de rutinas). Se usa el mismo criterio de referencia que ya muestra `session-set-row.tsx`
 * (`repsRef`): igualar o superar, serie por serie, las reps de la MISMA posición de serie la vez
 * anterior — no un número objetivo inventado aparte.
 *
 * Sin RIR registrado no hay forma de calcular `avgRir` sin inventar un valor — en ese caso se devuelve
 * `sinDatos: true` en vez de una sugerencia (mismo criterio que el resto del proyecto: sin dato
 * suficiente, se dice explícitamente en vez de aproximar).
 */
import { weightSuggestion, type WeightDecision } from "./hypertrophy-engine";

export interface ProgressionSetResult {
  peso: number;
  reps: number;
  rir?: number;
  fallo?: boolean;
  completado: boolean;
}

export interface ProgressionInput {
  /** Series de trabajo (no calentamiento) de la ÚLTIMA sesión de este ejercicio, en orden. */
  lastSets: ProgressionSetResult[];
  /** Reps de la misma posición de serie, pero de la sesión ANTERIOR a esa (la referencia contra la que
   * se mide "hitTargetReps") — si falta una posición, se compara contra sí misma (no penaliza por
   * datos faltantes). */
  referenceReps: number[];
  /** Incremento de peso por defecto (kg) — mismo paso que ya usa el teclado numérico de peso en
   * `session-set-row.tsx` (`NumericKeypad step={2.5}`), para no introducir una convención nueva. */
  incrementKg?: number;
}

export interface ProgressionSuggestion {
  decision: WeightDecision;
  sinDatos: boolean;
  avgRir: number | null;
  hitTargetReps: boolean;
  anyFailure: boolean;
  lastWeight: number;
  suggestedWeightKg: number | null;
  mensaje: string;
}

const DEFAULT_INCREMENT_KG = 2.5;

export function suggestNextWeight(input: ProgressionInput): ProgressionSuggestion {
  const working = input.lastSets.filter((s) => s.completado);
  const lastWeight = working.length ? working[working.length - 1].peso : 0;
  const rirValues = working.map((s) => s.rir).filter((r): r is number => typeof r === "number");
  const anyFailure = working.some((s) => s.fallo);
  const hitTargetReps = working.length > 0 && working.every((s, i) => s.reps >= (input.referenceReps[i] ?? s.reps));

  if (working.length === 0 || rirValues.length === 0) {
    return {
      decision: "mantener",
      sinDatos: true,
      avgRir: null,
      hitTargetReps,
      anyFailure,
      lastWeight,
      suggestedWeightKg: null,
      mensaje: "Registrá el RIR de tus series para activar la sugerencia de peso.",
    };
  }

  const avgRir = rirValues.reduce((a, b) => a + b, 0) / rirValues.length;
  const decision = weightSuggestion({ avgRir, hitTargetReps, anyFailure });
  const incrementKg = input.incrementKg ?? DEFAULT_INCREMENT_KG;
  const suggestedWeightKg =
    decision === "subir" ? lastWeight + incrementKg : decision === "bajar" ? Math.max(0, lastWeight - incrementKg) : lastWeight;

  const mensaje =
    decision === "subir"
      ? `Llegaste a las reps con margen (RIR promedio ${avgRir.toFixed(1)}) — probá ${suggestedWeightKg} kg la próxima vez.`
      : decision === "bajar"
        ? "Te costó llegar a las reps o hubo una serie al fallo — probá bajar un poco el peso la próxima vez."
        : "Seguí con el mismo peso: todavía tenés margen (RIR) para sumar reps antes de subir peso.";

  return { decision, sinDatos: false, avgRir, hitTargetReps, anyFailure, lastWeight, suggestedWeightKg, mensaje };
}

/** "No puedo subir" (estancado): `windowSessions` sesiones seguidas sin una sola decisión "subir" para
 * este ejercicio. Mismo tamaño de ventana que ya usa `plateauDetected` en `hypertrophy-engine.ts`
 * (criterio propio documentado ahí, no de una fuente aparte). `decisions` va de más antigua a más
 * reciente. */
export function progressionStalled(decisions: WeightDecision[], windowSessions = 3): boolean {
  if (decisions.length < windowSessions) return false;
  return decisions.slice(-windowSessions).every((d) => d !== "subir");
}
