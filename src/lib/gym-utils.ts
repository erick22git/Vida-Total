import type { Rank, WorkoutSession, WorkoutSet } from "@/lib/types";

export function getExerciseVolume(
  exerciseId: string,
  sessions: WorkoutSession[],
): number {
  let total = 0;
  for (const session of sessions) {
    for (const ex of session.ejercicios) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completado) total += set.peso * set.reps;
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
        const volumen = set.peso * set.reps;
        if (!best || volumen > best.volumen) {
          best = { peso: set.peso, reps: set.reps, volumen };
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
