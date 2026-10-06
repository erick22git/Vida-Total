/**
 * Plan de Kegel — modelo parametrizado con series, repeticiones y tiempos.
 *
 * Fuentes de referencia para límites de seguridad:
 *  - NHS: "Pelvic floor exercises" (nhs.uk/conditions/urinary-incontinence/
 *    treatment/pelvic-floor-exercises/): 8-12 contracciones × 3 sets/día,
 *    sostener 8-10s, descanso igual al tiempo de contracción.
 *  - NICE CG171 (2013, actualizado 2019): mínimo 3 meses, al menos 3 series/día,
 *    8 contracciones máximas por serie.
 *  - App Squeezy (NHS endorsada): sostener máx 10s, relajar igual tiempo,
 *    10 reps/serie, 3-4 series, 3 sesiones/día.
 *
 * Límites de seguridad codificados como constantes:
 */
export const KEGEL_LIMITS = {
  maxHoldSec: 10,       // Sostener máx 10 s (NHS/Squeezy)
  maxRepsPerSet: 10,    // Máx 10 reps/serie (Squeezy)
  maxSets: 6,           // Máx 6 series/sesión (margen amplio pero razonable)
  maxSessionsPerDay: 6, // Máx 6 sesiones/día (evitar sobreentrenamiento)
  minHoldSec: 1,
  minRelaxSec: 1,
  minRepsPerSet: 1,
  minSets: 1,
  minSessionsPerDay: 1,
} as const;

// ─────────────────────────────────────────────────────────
// Tipos de ejercicio
// ─────────────────────────────────────────────────────────

/** Tipo de contracción muscular. */
export type ExerciseType =
  | "rapid"      // Apretones rápidos: contraer y soltar de inmediato (1s)
  | "slow"       // Apretones lentos: mantener y soltar
  | "endurance"; // Resistencia: mantener más tiempo

/** Descripción legible por el usuario de cada tipo. */
export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  rapid: "Rápido",
  slow: "Sostenido",
  endurance: "Resistencia",
};

/** Descripción de las fases de UI para el anillo y la onda. */
export interface KegelPhase {
  label: string;
  seconds: number;
  amp: number; // 0–1, qué tan arriba va la onda
}

// ─────────────────────────────────────────────────────────
// Definición de ejercicio dentro de una sesión
// ─────────────────────────────────────────────────────────

export interface KegelExerciseDef {
  type: ExerciseType;
  reps: number;             // repeticiones por serie (1–10)
  squeezeSeconds: number;   // tiempo de contracción (1–10 s)
  relaxSeconds: number;     // tiempo de relajación (1–10 s)
  sets: number;             // series (1–6)
  restBetweenSetsSec: number; // descanso entre series (seg)
}

// ─────────────────────────────────────────────────────────
// Definición de sesión
// ─────────────────────────────────────────────────────────

export type KegelSessionKind = "libro" | "pesa" | "loto";

export interface KegelSessionDef {
  id: string;
  title: string;
  icon: KegelSessionKind;
  exercises: KegelExerciseDef[];
  /** Duración total estimada en segundos (precalculada). */
  durationSec: number;
  /** Fases para la onda / anillo (generadas a partir de exercises). */
  phases: KegelPhase[];
}

// ─────────────────────────────────────────────────────────
// Progresión por nivel
// ─────────────────────────────────────────────────────────

/**
 * Fórmula de nivel: basada en DÍAS CUMPLIDOS (constancia), no en sesiones brutas.
 *
 * Decisión: avanzar de nivel requiere haber cumplido la meta diaria un número
 * creciente de días acumulados. Esto premia la constancia a largo plazo y no
 * se engaña haciendo 6 sesiones en un día.
 *
 * Tabla de días cumplidos para subir al nivel N (umbral acumulado):
 *   Nivel 1 → 2  : 7 días  (1 semana de práctica)
 *   Nivel 2 → 3  : 21 días
 *   Nivel 3 → 4  : 42 días
 *   Nivel 4 → 5  : 70 días
 *   ...etc.
 *
 * Subir de nivel es una SUGERENCIA visible, no automático — el usuario acepta.
 */
export const LEVEL_DAY_THRESHOLDS = [0, 7, 21, 42, 70, 105, 147, 196, 252, 315] as const;
export const MAX_KEGEL_LEVEL = 10;

/** Nivel SUGERIDO (no aplicado) dado un número de días cumplidos acumulados. */
export function suggestedLevel(doneDays: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_DAY_THRESHOLDS.length; i++) {
    if (doneDays >= LEVEL_DAY_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, MAX_KEGEL_LEVEL);
}

// ─────────────────────────────────────────────────────────
// Construcción de fases desde ejercicios
// ─────────────────────────────────────────────────────────

function phaseFromExercise(ex: KegelExerciseDef): KegelPhase[] {
  const contractLabel =
    ex.type === "rapid" ? "CONTRAE" : ex.type === "slow" ? "SOSTÉN" : "SOSTÉN";
  const phases: KegelPhase[] = [
    { label: contractLabel, seconds: ex.squeezeSeconds, amp: 1 },
    { label: "SUELTA", seconds: ex.relaxSeconds, amp: 0.15 },
  ];
  return phases;
}

function calcDuration(exercises: KegelExerciseDef[]): number {
  return exercises.reduce((total, ex) => {
    const perRep = ex.squeezeSeconds + ex.relaxSeconds;
    const perSet = perRep * ex.reps;
    const allSets = perSet * ex.sets + ex.restBetweenSetsSec * Math.max(0, ex.sets - 1);
    return total + allSets;
  }, 0);
}

function primaryPhases(exercises: KegelExerciseDef[]): KegelPhase[] {
  if (exercises.length === 0) return [];
  return phaseFromExercise(exercises[0]);
}

// ─────────────────────────────────────────────────────────
// Las 5 sesiones del plan inicial (nivel 1)
// IDs conservados para retrocompatibilidad con datos guardados.
// ─────────────────────────────────────────────────────────

const L1_RAPID: KegelExerciseDef = { type: "rapid", reps: 10, squeezeSeconds: 1, relaxSeconds: 1, sets: 3, restBetweenSetsSec: 10 };
const L1_SLOW: KegelExerciseDef = { type: "slow", reps: 5, squeezeSeconds: 3, relaxSeconds: 3, sets: 3, restBetweenSetsSec: 10 };
const L1_ENDURANCE: KegelExerciseDef = { type: "endurance", reps: 3, squeezeSeconds: 5, relaxSeconds: 5, sets: 3, restBetweenSetsSec: 15 };
const L1_COMBO: KegelExerciseDef = { type: "slow", reps: 8, squeezeSeconds: 5, relaxSeconds: 5, sets: 3, restBetweenSetsSec: 15 };

function makeDef(
  id: string, title: string, icon: KegelSessionKind, exercises: KegelExerciseDef[],
): KegelSessionDef {
  return { id, title, icon, exercises, durationSec: calcDuration(exercises), phases: primaryPhases(exercises) };
}

export const KEGEL_SESSIONS: KegelSessionDef[] = [
  makeDef("sesion-1", "Sesión 1", "libro", [L1_RAPID]),
  makeDef("sesion-2", "Sesión 2", "libro", [L1_SLOW]),
  makeDef("sesion-3", "Sesión 3", "libro", [L1_RAPID, L1_SLOW]),
  makeDef("ejercicios", "5 Ejercicios", "pesa", [L1_ENDURANCE, L1_COMBO]),
  makeDef("respiracion", "4-7-8 Respiración", "loto", [
    {
      type: "slow",
      reps: 5,
      squeezeSeconds: 4,
      relaxSeconds: 8,
      sets: 3,
      restBetweenSetsSec: 7,
    },
  ]),
];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} sec`;
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
}

export function getKegelSession(id: string): KegelSessionDef | undefined {
  return KEGEL_SESSIONS.find((s) => s.id === id);
}
