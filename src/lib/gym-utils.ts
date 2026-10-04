import type { Exercise, MuscleGroup, RoutineExercise, SetType, WorkoutSession, WorkoutSet } from "@/lib/types";

/** Bloque 15: un dropset guarda un peso por cada bajada en
 * `pesosDescendentes` en vez de un solo `peso` — para volumen/mejor serie
 * (que no distinguen reps por bajada) se usa el promedio de esas bajadas
 * como el "peso" representativo de la serie completa. */
export function effectiveWeight(set: WorkoutSet): number {
  if (set.pesosDescendentes && set.pesosDescendentes.length > 0) {
    return set.pesosDescendentes.reduce((a, b) => a + b, 0) / set.pesosDescendentes.length;
  }
  return set.peso;
}

/** Ejercicios nuevos de rutina con 3 series de 10. Si `agrupar` es true, todos comparten un mismo
 * `grupo` (bloque/superserie): se hacen serie por serie, uno tras otro, y se descansa al terminar la ronda. */
export function newRoutineExercises(ids: string[], agrupar = false): RoutineExercise[] {
  const grupo = agrupar && ids.length >= 2 ? crypto.randomUUID() : undefined;
  return ids.map<RoutineExercise>((exerciseId) => ({
    exerciseId,
    sets: [
      { peso: 0, reps: 10, tipo: "normal" },
      { peso: 0, reps: 10, tipo: "normal" },
      { peso: 0, reps: 10, tipo: "normal" },
    ],
    ...(grupo ? { grupo } : {}),
  }));
}

/** Repeticiones de referencia que se muestran (atenuadas) en cada bajada de un dropset. */
export const DROP_REPS_REF = 10;

/** Peso de referencia de una bajada: ~20% menos que la anterior, redondeado hacia abajo a 2.5 kg.
 * `0` si no hay peso previo del que partir. */
export function refDropWeight(prev: number): number {
  return prev > 0 ? Math.max(0, Math.floor((prev * 0.8) / 2.5) * 2.5) : 0;
}

/** ¿El usuario escribió este valor a propósito (aunque sea 0)? Ver `WorkoutSet.fijados`. */
export function isFixed(set: Pick<WorkoutSet, "fijados">, key: string): boolean {
  return !!set.fijados?.includes(key);
}

/** Devuelve `fijados` con `key` agregada (fixed = true) o quitada (fixed = false). */
export function withFixed(set: Pick<WorkoutSet, "fijados">, key: string, fixed: boolean): string[] {
  const rest = (set.fijados ?? []).filter((k) => k !== key);
  return fixed ? [...rest, key] : rest;
}

/** Bajadas de un dropset SIN la serie principal (que usa `peso`/`reps`). `pesosDescendentes[0]` es
 * el peso de la principal; el resto son las bajadas. `reps: 0` = todavía sin anotar. */
export function dropsOf(set: WorkoutSet): { peso: number; reps: number }[] {
  const weights = (set.pesosDescendentes ?? []).slice(1);
  return weights.map((peso, k) => ({ peso, reps: set.repsDescendentes?.[k] ?? 0 }));
}

/** Al convertir una serie en dropset: arranca con UNA bajada vacía (con referencias atenuadas)
 * debajo de la serie principal, sin abrir ningún modal. */
export function initialDropsetPatch(set: WorkoutSet): Partial<WorkoutSet> {
  if ((set.pesosDescendentes?.length ?? 0) > 1) return {};
  return { pesosDescendentes: [set.peso, 0], repsDescendentes: [0] };
}

/** Texto "Previa" (peso x reps, o la secuencia de bajadas si era dropset)
 * para mostrar al lado de una serie: con cuánto la hiciste la última vez.
 * Compartido entre RoutineSetTable (planificando) y SessionSetRow (sesión
 * en vivo) para que el formato sea idéntico en los dos lugares. */
export function previaLabelFor(
  prevSet: { peso: number; reps: number; tipo?: SetType; pesosDescendentes?: number[] } | undefined,
  soloReps?: boolean,
): string {
  if (!prevSet) return "-";
  if (soloReps) return `${prevSet.reps}`;
  if (prevSet.tipo === "descendente" && prevSet.pesosDescendentes && prevSet.pesosDescendentes.length > 0) {
    return `${prevSet.pesosDescendentes.join("→")}x${prevSet.reps}`;
  }
  return `${prevSet.peso}x${prevSet.reps}`;
}

/** El peso más pesado realmente levantado en la serie — para un dropset es
 * la primera bajada (la más pesada), no el promedio que usa
 * `effectiveWeight` para volumen/1RM. Records de "peso máximo" deben usar
 * este, no `effectiveWeight`. */
export function peakWeight(set: WorkoutSet): number {
  if (set.pesosDescendentes && set.pesosDescendentes.length > 0) {
    return Math.max(...set.pesosDescendentes);
  }
  return set.peso;
}

export function getExerciseVolume(
  exerciseId: string,
  sessions: WorkoutSession[],
): number {
  let total = 0;
  for (const session of sessions) {
    for (const ex of session.ejercicios) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completado) total += effectiveWeight(set) * set.reps;
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Muscle distribution (by series count, per muscle group)
// ---------------------------------------------------------------------------

export interface MuscleDistributionEntry {
  categoria: string;
  pct: number;
}

/**
 * Computes the % of total series each muscle group (`Exercise.categoria`)
 * accounts for within a set of routine exercises. Used by both the routine
 * detail page and the weekly "Tu Plan" cards so the numbers always match.
 */
export function getMuscleDistribution(
  ejercicios: RoutineExercise[],
  allExercises: Exercise[],
): MuscleDistributionEntry[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const rex of ejercicios) {
    const ex = allExercises.find((e) => e.id === rex.exerciseId);
    if (!ex) continue;
    counts[ex.categoria] = (counts[ex.categoria] ?? 0) + rex.sets.length;
    total += rex.sets.length;
  }
  return Object.entries(counts)
    .map(([categoria, count]) => ({
      categoria,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Best-guess single muscle group label for a set of routine exercises —
 * whichever category accounts for the most series. Used to summarize a
 * training-plan day ("Pecho", "Cuadriceps", ...) once exercises are assigned to
 * it, without needing a separate free-text field on the plan.
 */
export function dominantMuscleGroup(
  ejercicios: RoutineExercise[],
  allExercises: Exercise[],
): MuscleGroup | null {
  const dist = getMuscleDistribution(ejercicios, allExercises);
  return dist.length > 0 ? (dist[0].categoria as MuscleGroup) : null;
}

/**
 * Rough estimated session duration in minutes, from the routine's own sets:
 * ~45s of work + ~75s of rest per working set, plus ~60s setup per exercise
 * (changing weights/machines). Deterministic and local-only, no external data.
 */
export function estimateRoutineDurationMinutes(ejercicios: RoutineExercise[]): number {
  const totalSets = ejercicios.reduce((sum, ex) => sum + ex.sets.length, 0);
  if (totalSets === 0) return 0;
  const workSeconds = totalSets * 45;
  const restSeconds = totalSets * 75;
  const setupSeconds = ejercicios.length * 60;
  return Math.round((workSeconds + restSeconds + setupSeconds) / 60);
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export interface PersonalRecord {
  exerciseId: string;
  sessionId: string;
  date: string;
  volumen: number;
  peso: number;
  reps: number;
}

/**
 * Walks sessions from oldest to newest and reports every set that beat the
 * previous best volume for its exercise — i.e. every "new PR" moment.
 */
export function getAllPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const best: Record<string, number> = {};
  const records: PersonalRecord[] = [];
  for (const session of chronological) {
    for (const ex of session.ejercicios) {
      for (const set of ex.sets) {
        if (!set.completado) continue;
        const vol = set.peso * set.reps;
        if (vol <= 0) continue;
        if (!best[ex.exerciseId] || vol > best[ex.exerciseId]) {
          best[ex.exerciseId] = vol;
          records.push({
            exerciseId: ex.exerciseId,
            sessionId: session.id,
            date: session.date,
            volumen: vol,
            peso: set.peso,
            reps: set.reps,
          });
        }
      }
    }
  }
  return records.reverse(); // newest first
}
