import type { Exercise, MuscleGroup, Rank, RoutineExercise, WorkoutSession, WorkoutSet } from "@/lib/types";

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

export function getRank(volume: number): Rank {
  if (volume >= 5000) return "Platino";
  if (volume >= 2000) return "Oro";
  if (volume >= 500) return "Plata";
  if (volume > 0) return "Bronce";
  return "Sin rango";
}

export const RANK_COLORS: Record<Rank, string> = {
  Platino: "#B9F2FF",
  Oro: "#FFD700",
  Plata: "#C0C0C0",
  Bronce: "#CD7F32",
  "Sin rango": "#6B7280",
};

// ---------------------------------------------------------------------------
// Rank pyramid (Symmetry-style per-exercise gamification)
// ---------------------------------------------------------------------------

export interface RankTier {
  key: string;
  name: string;
  topPct: number | null; // null = base tier (Hierro), no "top %"
  color: string;
  threshold: number; // cumulative SP required to reach this tier
}

export const RANK_TIERS: RankTier[] = [
  { key: "hierro", name: "Hierro", topPct: null, color: "#8a8a95", threshold: 0 },
  { key: "bronce", name: "Bronce", topPct: 79, color: "#cd7f32", threshold: 100 },
  { key: "plata", name: "Plata", topPct: 60, color: "#c0c6d4", threshold: 200 },
  { key: "oro", name: "Oro", topPct: 44, color: "#ffd166", threshold: 320 },
  { key: "platino", name: "Platino", topPct: 31, color: "#8fe3d9", threshold: 460 },
  { key: "esmeralda", name: "Esmeralda", topPct: 20, color: "#2ecc71", threshold: 620 },
  { key: "diamante", name: "Diamante", topPct: 11, color: "#7dd3fc", threshold: 800 },
  { key: "campeon", name: "Campeón", topPct: 5, color: "#a855f7", threshold: 1000 },
  { key: "simetrico", name: "Simétrico", topPct: 1, color: "#facc15", threshold: 1250 },
];

/**
 * SP (rank points) is a simple deterministic function of the best single set
 * volume (kg x reps) ever logged for the exercise, plus a smaller contribution
 * from total accumulated volume. This is a simplified, local-only formula —
 * no server / real strength-standards dataset involved.
 */
export function getBestSet(
  exerciseId: string,
  sessions: WorkoutSession[],
): { peso: number; reps: number; volumen: number } | null {
  let best: { peso: number; reps: number; volumen: number } | null = null;
  for (const session of sessions) {
    for (const ex of session.ejercicios) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (!set.completado) continue;
        const peso = effectiveWeight(set);
        const volumen = peso * set.reps;
        if (!best || volumen > best.volumen) {
          best = { peso, reps: set.reps, volumen };
        }
      }
    }
  }
  return best;
}

export function getExerciseSP(
  exerciseId: string,
  sessions: WorkoutSession[],
): number {
  const totalVolume = getExerciseVolume(exerciseId, sessions);
  const best = getBestSet(exerciseId, sessions);
  const bestVolume = best?.volumen ?? 0;
  // Best set counts more than accumulated volume, both scaled down.
  return Math.round(bestVolume * 0.6 + totalVolume * 0.02);
}

export interface RankStanding {
  tier: RankTier;
  tierIndex: number;
  nextTier: RankTier | null;
  sp: number;
  spIntoTier: number;
  spForNextTier: number; // width of current bracket
}

export function getRankStanding(sp: number): RankStanding {
  let tierIndex = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (sp >= RANK_TIERS[i].threshold) {
      tierIndex = i;
      break;
    }
  }
  const tier = RANK_TIERS[tierIndex];
  const nextTier = RANK_TIERS[tierIndex + 1] ?? null;
  const spForNextTier = nextTier ? nextTier.threshold - tier.threshold : 0;
  const spIntoTier = nextTier ? sp - tier.threshold : 0;
  return { tier, tierIndex, nextTier, sp, spIntoTier, spForNextTier };
}

export function volumeForSet(set: Pick<WorkoutSet, "peso" | "reps">): number {
  return set.peso * set.reps;
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
