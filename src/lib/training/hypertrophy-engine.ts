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

/** Convención razonada, NO un número de la literatura: no encontré una cifra exacta de Israetel/RP ni
 * de Schoenfeld para cuánto "vale" un dropset en volumen semanal. Lo que sí hay: la revisión sistemática
 * de Brookbush Institute sobre drop sets (brookbushinstitute.com/articles/drop-sets-comprehensive-
 * systematic-review-and-training-recommendations, consultado 2026-10-14) describe el estímulo de un
 * dropset como equivalente a ~2-3 series convencionales, pero señala que convencionalmente se cuenta
 * como UNA serie porque no hay descanso entre bajadas; y dos meta-análisis con volumen equiparado
 * (Coleman et al. 2022, co-autor Schoenfeld; Sødal et al. 2023) encontraron hipertrofia similar entre
 * dropsets y series tradicionales cuando el volumen total se iguala — lo que sugiere NO contar cada
 * bajada como una serie completa aparte (eso infla el volumen sin evidencia que lo respalde). 1.5 es un
 * punto medio razonado entre "cuenta como 1" (la convención más conservadora) y "cuenta como 2-3" (el
 * estímulo observado) — ver docs/ciencia-entrenamiento.md. */
export const DROPSET_VOLUME_MULTIPLIER = 1.5;

/** Series completadas (no solo registradas) de un ejercicio dentro de un log de sesión, en "series
 * equivalentes" para volumen: un dropset (`tipo === "descendente"`) pesa `DROPSET_VOLUME_MULTIPLIER`
 * en vez de 1, por el estímulo extra de sus bajadas — ver la nota de la convención arriba. */
function weightedCompletedSets(log: { sets: WorkoutSet[] }): number {
  return log.sets
    .filter((s) => s.completado)
    .reduce((sum, s) => sum + (s.tipo === "descendente" ? DROPSET_VOLUME_MULTIPLIER : 1), 0);
}

/** Volumen semanal real (series fraccionadas) por grupo muscular, contando solo series completadas de
 * sesiones cuya `date` cae en `[weekStartISO, weekStartISO + 7 días)`. `weekStartISO` es "yyyy-MM-dd". */
export function weeklyMuscleVolume(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  weekStartISO: string,
): Partial<Record<MuscleGroup, number>> {
  // Comparación por STRING de fecha (yyyy-MM-dd), no por `Date`: `session.date` es un ISO completo
  // en la app real (`new Date().toISOString()`, con hora en UTC) y los primeros 10 caracteres ya son
  // la fecha calendario en UTC — comparar objetos `Date` acá metía corrimientos de huso horario entre
  // la hora local de la máquina y el UTC de `toISOString()` que podían excluir sesiones reales de la
  // ventana. Con strings "yyyy-MM-dd" el orden lexicográfico ES el orden cronológico, sin ambigüedad.
  const endDate = new Date(weekStartISO + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endISO = endDate.toISOString().slice(0, 10);

  const points = new Map<MuscleGroup, number>();
  for (const session of sessions) {
    const key = session.date.slice(0, 10);
    if (key < weekStartISO || key >= endISO) continue;
    for (const log of session.ejercicios) {
      const ex = exercises.find((e) => e.id === log.exerciseId);
      if (!ex) continue;
      const sets = weightedCompletedSets(log);
      if (sets === 0) continue;
      points.set(ex.categoria, (points.get(ex.categoria) ?? 0) + sets * DIRECT_WEIGHT);
      const secondaries = new Set(ex.musculosSecundarios.map(secondaryToGroup).filter((g): g is MuscleGroup => !!g && g !== ex.categoria));
      for (const g of secondaries) points.set(g, (points.get(g) ?? 0) + sets * INDIRECT_WEIGHT);
    }
  }
  return Object.fromEntries(points);
}

/** Igual que `weeklyMuscleVolume`, pero separa cuánto del volumen DIRECTO de cada músculo viene de
 * series normales vs. series descendentes — para mostrarlo aparte en el Coach (Fase 4), no solo el
 * total ya mezclado. Solo cuenta volumen directo (no indirecto/secundario): el desglose normal/
 * descendente de un músculo que solo recibe estímulo indirecto de un ejercicio no tendría mucho
 * sentido mostrar aparte. */
export function weeklyMuscleVolumeBreakdown(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  weekStartISO: string,
): Partial<Record<MuscleGroup, { normal: number; dropset: number }>> {
  const endDate = new Date(weekStartISO + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endISO = endDate.toISOString().slice(0, 10);

  const points = new Map<MuscleGroup, { normal: number; dropset: number }>();
  for (const session of sessions) {
    const key = session.date.slice(0, 10);
    if (key < weekStartISO || key >= endISO) continue;
    for (const log of session.ejercicios) {
      const ex = exercises.find((e) => e.id === log.exerciseId);
      if (!ex) continue;
      const normal = log.sets.filter((s) => s.completado && s.tipo !== "descendente").length;
      const dropset = log.sets.filter((s) => s.completado && s.tipo === "descendente").length;
      if (normal === 0 && dropset === 0) continue;
      const entry = points.get(ex.categoria) ?? { normal: 0, dropset: 0 };
      entry.normal += normal;
      entry.dropset += dropset;
      points.set(ex.categoria, entry);
    }
  }
  return Object.fromEntries(points);
}

/** Convención propia, sin una cifra de la literatura: si el 40% o más de las series completadas de la
 * semana fueron explícitamente al fallo (`tipo === "fallo"`), es señal de fatiga acumulada alta — el
 * Coach debería sugerir adelantar el deload en vez de esperar solo a que el 1RM se estanque
 * (`plateauDetected`), que tarda varias sesiones en notarse. Ver docs/ciencia-entrenamiento.md. */
export const HIGH_FAILURE_RATIO_THRESHOLD = 0.4;

export interface WeeklyFailureLoad {
  failureSets: number;
  totalSets: number;
  /** `0` si no hubo ninguna serie completada esta semana (nunca se divide por cero). */
  ratio: number;
  /** true = ratio >= `HIGH_FAILURE_RATIO_THRESHOLD`: suficientes series al fallo como para sugerir
   * adelantar el deload. */
  highFatigue: boolean;
}

export function weeklyFailureLoad(sessions: WorkoutSession[], weekStartISO: string): WeeklyFailureLoad {
  const endDate = new Date(weekStartISO + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endISO = endDate.toISOString().slice(0, 10);

  let failureSets = 0;
  let totalSets = 0;
  for (const session of sessions) {
    const key = session.date.slice(0, 10);
    if (key < weekStartISO || key >= endISO) continue;
    for (const log of session.ejercicios) {
      for (const s of log.sets) {
        if (!s.completado) continue;
        totalSets++;
        if (s.tipo === "fallo") failureSets++;
      }
    }
  }
  const ratio = totalSets > 0 ? failureSets / totalSets : 0;
  return { failureSets, totalSets, ratio, highFatigue: ratio >= HIGH_FAILURE_RATIO_THRESHOLD };
}

/** Convención propia: 2 o más notas de "mala técnica" en las últimas `lookbackSessions` sesiones donde
 * se hizo ESE ejercicio cuenta como "técnica irregular" — un aviso para el Coach (Fase 3/4), nunca un
 * bloqueo. Es justo el dato que más va a importar cuando llegue la cámara (ver
 * docs/roadmap/vision-entrenador.md): esto deja el conteo ya preparado para conectarse ahí después,
 * sin implementar nada de visión ahora. */
export const TECHNIQUE_WARNING_MIN_NOTES = 2;

export interface TechniqueWarning {
  exerciseId: string;
  /** Cuántas series de ese ejercicio en la ventana tienen una nota no vacía. */
  notedSets: number;
  /** El texto de la nota más reciente (para mostrar como ejemplo en el aviso). */
  lastNote: string;
}

/** Ejercicios con 2+ notas en las sesiones más recientes (ordenadas por fecha, de más nueva a más
 * vieja) donde se registró ese ejercicio — no por sesiones en general, porque un ejercicio que se hace
 * una vez cada 2 semanas no debería "perder" su historial de notas por sesiones de otros ejercicios de
 * por medio. */
export function recentTechniqueWarnings(sessions: WorkoutSession[], lookbackSessions = 5): TechniqueWarning[] {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1)); // más nueva primero
  const byExercise = new Map<string, { notedSets: number; lastNote: string; sessionsSeen: number }>();

  for (const session of sorted) {
    for (const log of session.ejercicios) {
      const notedInLog = log.sets.filter((s) => s.completado && s.notas && s.notas.trim() !== "");
      const entry = byExercise.get(log.exerciseId) ?? { notedSets: 0, lastNote: "", sessionsSeen: 0 };
      if (entry.sessionsSeen >= lookbackSessions) continue; // ya se contaron suficientes sesiones de este ejercicio
      entry.sessionsSeen += 1;
      if (notedInLog.length > 0) {
        entry.notedSets += notedInLog.length;
        if (!entry.lastNote) entry.lastNote = notedInLog[notedInLog.length - 1].notas!;
      }
      byExercise.set(log.exerciseId, entry);
    }
  }

  return [...byExercise.entries()]
    .filter(([, v]) => v.notedSets >= TECHNIQUE_WARNING_MIN_NOTES)
    .map(([exerciseId, v]) => ({ exerciseId, notedSets: v.notedSets, lastNote: v.lastNote }));
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
