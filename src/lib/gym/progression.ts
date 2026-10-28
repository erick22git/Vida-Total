/**
 * Qué hacer hoy con este ejercicio según lo que hiciste la última vez (progresión doble).
 *
 * Base científica (convenciones de práctica, no una norma única):
 *  - ACSM, "Progression Models in Resistance Training for Healthy Adults" (2009): regla del 2 por 2 — cuando
 *    puedes hacer 1-2 repeticiones MÁS que tu objetivo en la última serie durante dos sesiones seguidas, sube
 *    la carga entre 2 % y 10 %.
 *  - Progresión doble (Helms, Schoenfeld): primero sube repeticiones dentro de un rango fijo y, al llegar al
 *    tope en todas las series, sube el peso y vuelve al piso del rango.
 *  - Rangos: 4-6 (fuerza), 8-12 (hipertrofia), 12-20 (resistencia). Schoenfeld et al. (2017) muestran que
 *    entre ~6 y 30 repeticiones cerca del fallo producen hipertrofia parecida, así que el rango es una guía.
 *  - Saltos de carga chicos (≈2,5 %-5 %, redondeados a discos de 1,25 kg) para no pasarte de golpe.
 * Es una sugerencia, no cambia nada solo. Funciones puras.
 */
import type { WorkoutSet } from "@/lib/types";

export interface ProgressionSuggestion {
  kind: "primera_vez" | "mas_reps" | "subir_peso" | "mantener";
  /** Una línea para mostrar en el entrenamiento. */
  headline: string;
  /** Peso objetivo de hoy (kg) y reps por serie, si aplica. */
  targetPeso?: number;
  targetReps?: number;
  /** Explicación breve de por qué (base científica). */
  why: string;
}

const PLATE_STEP = 1.25;
const roundToPlate = (kg: number) => Math.round(kg / PLATE_STEP) * PLATE_STEP;

/** Piso y tope del rango según lo que hiciste (guía, no norma). */
export function repRangeFor(avgReps: number): { low: number; high: number } {
  if (avgReps <= 6) return { low: 4, high: 6 };
  if (avgReps <= 12) return { low: 8, high: 12 };
  return { low: 12, high: 20 };
}

export function suggestProgression(opts: {
  /** Series hechas la última vez (ya filtradas: completadas, sin calentamiento). */
  last: Pick<WorkoutSet, "peso" | "reps">[] | null;
  /** Series de la vez anterior a esa, para la regla del 2 por 2 (opcional). */
  beforeLast?: Pick<WorkoutSet, "peso" | "reps">[] | null;
  soloReps?: boolean;
}): ProgressionSuggestion {
  const { last, beforeLast, soloReps } = opts;
  if (!last || last.length === 0) {
    return {
      kind: "primera_vez",
      headline: soloReps ? "Primera vez: haz 8-12 reps dejando 1-3 en reserva" : "Primera vez: elige un peso con el que llegues a 8-12 reps",
      why: "Sin historial no hay de dónde progresar. Empieza con una carga con la que te queden 1-3 repeticiones en reserva (RIR); a la próxima sesión te digo cuándo subir.",
    };
  }
  const reps = last.map((s) => s.reps);
  const minReps = Math.min(...reps);
  const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;
  const topPeso = Math.max(...last.map((s) => s.peso));
  const { low, high } = repRangeFor(avgReps);

  if (soloReps || topPeso <= 0) {
    const target = Math.min(minReps + 1, high + 10);
    return {
      kind: "mas_reps",
      headline: `Intenta ${target} reps por serie (antes ${reps.join(", ")})`,
      targetReps: target,
      why: "Con peso corporal se progresa sumando repeticiones: +1 por serie cada sesión mientras mantengas la técnica (progresión doble).",
    };
  }

  // Regla del 2 por 2: ¿llegaste al tope del rango también la vez anterior?
  const prevMin = beforeLast && beforeLast.length > 0 ? Math.min(...beforeLast.map((s) => s.reps)) : null;
  const prevPeso = beforeLast && beforeLast.length > 0 ? Math.max(...beforeLast.map((s) => s.peso)) : null;
  const twoInARow = prevMin !== null && prevPeso !== null && prevPeso >= topPeso && prevMin >= high - 1;

  if (minReps >= high || (minReps >= high - 1 && twoInARow)) {
    const stepPct = minReps >= high + 2 ? 0.05 : 0.025;
    const next = Math.max(topPeso + PLATE_STEP, roundToPlate(topPeso * (1 + stepPct)));
    return {
      kind: "subir_peso",
      headline: `Sube a ${next} kg y haz ${low}+ reps (antes ${topPeso} kg × ${reps.join(", ")})`,
      targetPeso: next,
      targetReps: low,
      why: `Llegaste al tope del rango (${high} reps) en todas las series. Regla del 2 por 2 (ACSM 2009): sube la carga entre 2 % y 10 %; aquí ≈${Math.round(stepPct * 1000) / 10} %. Vuelve al piso del rango (${low}) y empieza a subir reps otra vez.`,
    };
  }

  const target = Math.min(high, minReps + 1);
  return {
    kind: minReps < low ? "mantener" : "mas_reps",
    headline:
      minReps < low
        ? `Mantén ${topPeso} kg y busca ${low} reps en todas las series (antes ${reps.join(", ")})`
        : `Mantén ${topPeso} kg e intenta ${target} reps por serie (antes ${reps.join(", ")})`,
    targetPeso: topPeso,
    targetReps: minReps < low ? low : target,
    why: `Progresión doble: con el mismo peso sube de a 1 repetición por serie hasta llegar a ${high}; recién ahí se sube la carga. Tu serie más floja fue de ${minReps}.`,
  };
}
