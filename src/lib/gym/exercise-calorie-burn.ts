/**
 * Estimado de calorías quemadas por entrenamiento de fuerza (pedido: relacionar entrenamiento ↔
 * calorías, por ejercicio/serie/reps/peso/tiempo). Método MET (Metabolic Equivalent of Task):
 * kcal ≈ MET × peso corporal (kg) × tiempo (horas) — fórmula estándar (ACSM) para convertir MET a
 * gasto energético.
 *
 * Fuente de los valores MET: Ainsworth et al., "2011 Compendium of Physical Activities" (Med Sci
 * Sports Exerc, 2011) — códigos de entrenamiento con pesas:
 *   - 02054 (3.5 MET): "resistance training (weight lifting), multiple exercises, 8-15 reps, varied
 *     resistance" — esfuerzo general/moderado-bajo.
 *   - 02052 (5.0 MET): "resistance training, squats or deadlifts" — esfuerzo compuesto.
 *   - 02050 (6.0 MET): "resistance training (weight lifting, free weight, nautilus or universal
 *     type), power lifting or bodybuilding, vigorous effort" — esfuerzo cercano al fallo.
 * El Compendium NO da un MET distinto por ejercicio con nombre propio (press banca, sentadilla,
 * curl...) — solo por categoría de esfuerzo. Por eso esto estima la categoría de cada serie a partir
 * de sus repeticiones (criterio propio, no de la fuente, documentado en docs/ciencia-entrenamiento.md):
 * series de pocas reps (≤6, zona de fuerza) se asumen esfuerzo vigoroso; de rango medio (7-12, zona de
 * hipertrofia típica) esfuerzo moderado/compuesto; de muchas reps (13+, resistencia muscular) esfuerzo
 * ligero/general. Una serie marcada "al fallo" sube un nivel. Es una aproximación — el MET real
 * depende del %1RM real, que la app no mide directo.
 */
import type { WorkoutSession } from "@/lib/types";

export type EffortBucket = "ligero" | "moderado" | "vigoroso";

export const RESISTANCE_MET: Record<EffortBucket, number> = { ligero: 3.5, moderado: 5.0, vigoroso: 6.0 };

/** MET de pie/moviéndose poco durante el descanso entre series — ni reposo total (1.0) ni actividad
 * (criterio propio, valor intermedio razonable). */
export const REST_MET = 1.3;

/** Bucket de esfuerzo a partir de las repeticiones de la serie. */
export function effortBucketForSet(reps: number, alFallo: boolean): EffortBucket {
  let bucket: EffortBucket = reps <= 6 ? "vigoroso" : reps <= 12 ? "moderado" : "ligero";
  if (alFallo) bucket = bucket === "ligero" ? "moderado" : "vigoroso";
  return bucket;
}

/** Duración asumida de la parte "activa" de una serie (sin el descanso después) — criterio propio, no
 * de la literatura: ~10s de acomodo + ~10s por repetición, razonable para una repetición controlada de
 * fuerza/hipertrofia (más lento en excéntrica que en una rep de resistencia pura, pero sin dato por
 * ejercicio para afinarlo más). */
export function assumedSetActiveSeconds(reps: number): number {
  return reps > 0 ? 10 + reps * 10 : 10;
}

export interface SetCalorieInput {
  reps: number;
  alFallo: boolean;
  /** Descanso configurado después de esta serie (segundos). */
  restSecondsAfter: number;
}

export function estimateSetCalories(set: SetCalorieInput, pesoCorporalKg: number): number {
  if (pesoCorporalKg <= 0) return 0;
  const bucket = effortBucketForSet(set.reps, set.alFallo);
  const activeHours = assumedSetActiveSeconds(set.reps) / 3600;
  const restHours = Math.max(0, set.restSecondsAfter) / 3600;
  return RESISTANCE_MET[bucket] * pesoCorporalKg * activeHours + REST_MET * pesoCorporalKg * restHours;
}

export interface ExerciseCalorieBreakdown {
  exerciseId: string;
  kcal: number;
}

export interface SessionCalorieEstimate {
  totalKcal: number;
  porEjercicio: ExerciseCalorieBreakdown[];
}

/** Descanso por defecto cuando el ejercicio no tiene uno configurado — convención ya usada en otras
 * partes de la app para el mismo caso (90s). */
const DEFAULT_REST_SECONDS = 90;

/**
 * Estima las calorías quemadas de una sesión ya completada: suma por cada serie de trabajo
 * (`completado`, sin contar calentamiento) usando el descanso configurado del ejercicio después de
 * cada serie. No usa `completadoAt` porque no todas las series lo tienen de forma consistente —
 * aproximación basada en reps/peso/descanso configurado, no en timestamps reales.
 */
export function estimateSessionCalories(session: WorkoutSession, pesoCorporalKg: number): SessionCalorieEstimate {
  const porEjercicio: ExerciseCalorieBreakdown[] = [];
  let totalKcal = 0;
  for (const log of session.ejercicios) {
    let kcal = 0;
    const workingSets = log.sets.filter((s) => s.completado && s.tipo !== "calentamiento");
    for (const set of workingSets) {
      const alFallo = !!set.fallo || set.tipo === "fallo";
      kcal += estimateSetCalories({ reps: set.reps, alFallo, restSecondsAfter: log.restSeconds ?? DEFAULT_REST_SECONDS }, pesoCorporalKg);
    }
    if (kcal > 0) porEjercicio.push({ exerciseId: log.exerciseId, kcal: Math.round(kcal) });
    totalKcal += kcal;
  }
  return { totalKcal: Math.round(totalKcal), porEjercicio };
}
