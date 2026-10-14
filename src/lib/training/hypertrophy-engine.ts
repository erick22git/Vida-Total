/**
 * Motor de hipertrofia: UN solo lugar decide landmarks de volumen (MEV/MAV/MRV), estado semanal de
 * volumen por grupo muscular, sugerencia de peso por RIR, y detección de meseta/deload. Módulo puro
 * (sin store, sin React) — mismo patrón que `calorie-state.ts`. Fuentes y decisiones de convención
 * documentadas en `docs/ciencia-entrenamiento.md`; nada acá es una cifra inventada sin ese respaldo.
 */
import type { Exercise, MuscleGroup, WorkoutSession, WorkoutSet } from "@/lib/types";
import type { Experiencia } from "@/lib/store/gymStore";

// ============================================================================
// Landmarks de volumen (sets/semana de trabajo DIRECTO), calibrados para nivel intermedio.
// Ver docs/ciencia-entrenamiento.md para la fuente de cada fila (RP fuente primaria vs. convención
// derivada de arvo.guru) y de los multiplicadores por experiencia.
// ============================================================================

export interface VolumeLandmarks {
  mev: number;
  mav: number;
  mrv: number;
}

const BASE_LANDMARKS: Partial<Record<MuscleGroup, VolumeLandmarks>> = {
  Pecho: { mev: 6, mav: 15, mrv: 22 },
  Espalda: { mev: 8, mav: 17, mrv: 24 },
  Hombros: { mev: 6, mav: 14, mrv: 21 },
  Biceps: { mev: 5, mav: 12, mrv: 18 },
  Triceps: { mev: 5, mav: 11, mrv: 18 },
  Antebrazo: { mev: 0, mav: 16, mrv: 27 },
  Cuadriceps: { mev: 7, mav: 15, mrv: 22 },
  Femoral: { mev: 5, mav: 12, mrv: 18 },
  Pantorrilla: { mev: 7, mav: 14, mrv: 22 },
  Abdomen: { mev: 0, mav: 12, mrv: 20 },
  Gluteos: { mev: 0, mav: 9, mrv: 14 },
  // Abductores, Aductores, Cardio: sin landmarks publicados — ver docs/ciencia-entrenamiento.md.
  // No se inventa un número; `volumeLandmarksFor` devuelve `null` para estos.
};

export type ExperienceLevel = "principiante" | "intermedio" | "avanzado";

/** Convención propia (documentada en docs/ciencia-entrenamiento.md): menos de 2 años = principiante,
 * 2-5 = intermedio, 5+ = avanzado. Ninguna fuente DRI-equivalente respalda este corte puntual. */
export function experienceLevelFrom(experiencia: Experiencia | undefined): ExperienceLevel {
  if (experiencia === "mas_5a") return "avanzado";
  if (experiencia === "2_5a") return "intermedio";
  return "principiante"; // menos_6m, 6m_2a, o sin dato: tratar como principiante (conservador).
}

const EXPERIENCE_MULTIPLIER: Record<ExperienceLevel, VolumeLandmarks> = {
  principiante: { mev: 0.7, mav: 0.7, mrv: 0.75 },
  intermedio: { mev: 1, mav: 1, mrv: 1 },
  avanzado: { mev: 1, mav: 1.1, mrv: 1.2 },
};

/** Landmarks de un grupo muscular ajustados por experiencia. `null` si el grupo no tiene landmarks
 * publicados (Abductores, Aductores, Cardio) — nunca se inventa un número para esos casos. */
export function volumeLandmarksFor(group: MuscleGroup, level: ExperienceLevel): VolumeLandmarks | null {
  const base = BASE_LANDMARKS[group];
  if (!base) return null;
  const mult = EXPERIENCE_MULTIPLIER[level];
  return {
    mev: Math.round(base.mev * mult.mev),
    mav: Math.round(base.mav * mult.mav),
    mrv: Math.round(base.mrv * mult.mrv),
  };
}

// ============================================================================
// Estado semanal de volumen (semáforo) — mismo patrón que CalorieStatus/CALORIE_COLORS.
// ============================================================================

export type VolumeStatus = "bajo" | "enRango" | "cercaLimite" | "excedido";

export const VOLUME_COLORS = {
  bajo: "#eab308",
  enRango: "#22c55e",
  cercaLimite: "#f97316",
  excedido: "#ef4444",
} as const satisfies Record<VolumeStatus, string>;

export function volumeStatus(setsThisWeek: number, landmarks: VolumeLandmarks): VolumeStatus {
  if (setsThisWeek < landmarks.mev) return "bajo";
  if (setsThisWeek < landmarks.mav) return "enRango";
  if (setsThisWeek < landmarks.mrv) return "cercaLimite";
  return "excedido";
}

// ============================================================================
// Conteo de volumen semanal real por grupo muscular, a partir del historial de sesiones.
// Reutiliza el mismo método de "series fraccionadas" (directo ×1, indirecto ×0.5) que
// `muscle-participation.ts` (Pelland et al.), aplicado a series COMPLETADAS de una ventana de 7 días
// en vez de a una sola rutina planeada.
// ============================================================================

const DIRECT_WEIGHT = 1;
const INDIRECT_WEIGHT = 0.5;

/** Idéntico a `secondaryToGroup` de `muscle-participation.ts` (sin reexportar desde ahí para no crear
 * una dependencia circular entre rutina-planeada y volumen-real; si uno cambia, revisar el otro). */
function secondaryToGroup(raw: string): MuscleGroup | null {
  const n = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (/^cu.?driceps$/.test(n) || n === "piernas") return "Cuadriceps";
  switch (n) {
    case "hombros": return "Hombros";
    case "isquiotibiales": return "Femoral";
    case "triceps": return "Triceps";
    case "biceps": return "Biceps";
    case "gluteos": return "Gluteos";
    case "gemelos":
    case "tibial anterior": return "Pantorrilla";
    case "antebrazo":
    case "antebrazos": return "Antebrazo";
    case "trapecio":
    case "espalda":
    case "espalda media":
    case "espalda baja":
    case "dorsal ancho":
    case "lumbar": return "Espalda";
    case "pectoral":
    case "pecho": return "Pecho";
    case "abdomen":
    case "core": return "Abdomen";
    case "aductores de cadera": return "Aductores";
    case "abductores de cadera": return "Abductores";
    case "cardio": return "Cardio";
    default: return null;
  }
}

/** Series completadas (no solo registradas) de un ejercicio dentro de un log de sesión. Un dropset
 * (`tipo === "descendente"`) con N bajadas cuenta como 1 sola serie, igual que el resto de la app. */
function completedSets(log: { sets: WorkoutSet[] }): number {
  return log.sets.filter((s) => s.completado).length;
}

/** Volumen semanal real (series fraccionadas) por grupo muscular, contando solo series completadas de
 * sesiones cuya `date` cae en `[weekStartISO, weekStartISO + 7 días)`. `weekStartISO` es "yyyy-MM-dd". */
export function weeklyMuscleVolume(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  weekStartISO: string,
): Partial<Record<MuscleGroup, number>> {
  const start = new Date(weekStartISO + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const points = new Map<MuscleGroup, number>();
  for (const session of sessions) {
    const d = new Date(session.date + "T00:00:00");
    if (d < start || d >= end) continue;
    for (const log of session.ejercicios) {
      const ex = exercises.find((e) => e.id === log.exerciseId);
      if (!ex) continue;
      const sets = completedSets(log);
      if (sets === 0) continue;
      points.set(ex.categoria, (points.get(ex.categoria) ?? 0) + sets * DIRECT_WEIGHT);
      const secondaries = new Set(ex.musculosSecundarios.map(secondaryToGroup).filter((g): g is MuscleGroup => !!g && g !== ex.categoria));
      for (const g of secondaries) points.set(g, (points.get(g) ?? 0) + sets * INDIRECT_WEIGHT);
    }
  }
  return Object.fromEntries(points);
}

// ============================================================================
// RIR -> sugerencia de peso para la próxima sesión. Nunca cambia el peso solo: siempre una sugerencia
// con Aceptar/Rechazar (mismo patrón que "Revisar sugerencia" de Calorías), este módulo solo decide
// cuál es la sugerencia. Convención propia (ver docs/ciencia-entrenamiento.md) sobre una herramienta
// de autorregulación (RIR) con validez publicada (Helms et al. 2016).
// ============================================================================

export type WeightDecision = "subir" | "mantener" | "bajar";

export interface WeightSuggestionInput {
  /** RIR promedio de las series de trabajo completadas de ese ejercicio en la última sesión. */
  avgRir: number;
  /** Se completaron las repeticiones objetivo en todas las series de trabajo. */
  hitTargetReps: boolean;
  /** Alguna serie fue explícitamente al fallo (`tipo === "fallo"`). */
  anyFailure: boolean;
}

export function weightSuggestion({ avgRir, hitTargetReps, anyFailure }: WeightSuggestionInput): WeightDecision {
  if ((avgRir <= 0 || anyFailure) && !hitTargetReps) return "bajar";
  if (avgRir >= 3 && hitTargetReps) return "subir";
  return "mantener";
}

// ============================================================================
// Estimación de 1RM (Epley) y detección de meseta.
// ============================================================================

/** `1RM ≈ peso × (1 + reps/30)` — fórmula de Epley, de uso extendido en programación de fuerza. Con
 * reps <= 0 o peso <= 0 devuelve 0 (sin dato), nunca un valor inventado. */
export function estimated1RM(peso: number, reps: number): number {
  if (peso <= 0 || reps <= 0) return 0;
  return peso * (1 + reps / 30);
}

/** Meseta: el 1RM estimado de un ejercicio no sube en `windowSessions` sesiones consecutivas más
 * recientes (umbral propio, documentado en docs/ciencia-entrenamiento.md — no es una cifra de una
 * fuente). `history` va de más antigua a más reciente. */
export function plateauDetected(history: number[], windowSessions = 3): boolean {
  if (history.length <= windowSessions) return false;
  const priorBest = Math.max(...history.slice(0, history.length - windowSessions));
  const recent = history.slice(-windowSessions);
  return recent.every((v) => v <= priorBest);
}

// ============================================================================
// Progresión de mesociclo: arranca en MEV, suma series semana a semana hacia MAV, deload al llegar a
// MRV o ante meseta.
// ============================================================================

export type MesocyclePhase = "acumulacion" | "deload";

export interface MesocycleWeekTarget {
  phase: MesocyclePhase;
  targetSets: number;
}

/** Series objetivo de la semana N de un mesociclo para un grupo muscular: arranca en MEV, suma 1
 * serie por semana (convención propia, sin cifra de una fuente específica) hasta MAV, y entra en
 * deload (vuelve a MEV) si `weekInMesocycle` ya alcanzó o pasó MRV en el ritmo de +1/semana, o si
 * `plateau` es true. */
export function mesocycleWeekTarget(landmarks: VolumeLandmarks, weekInMesocycle: number, plateau: boolean): MesocycleWeekTarget {
  const raw = landmarks.mev + Math.max(0, weekInMesocycle - 1);
  if (plateau || raw >= landmarks.mrv) {
    return { phase: "deload", targetSets: landmarks.mev };
  }
  return { phase: "acumulacion", targetSets: Math.min(raw, landmarks.mav) };
}
