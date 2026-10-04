"use client";

/**
 * Hooks de rangos: unen el motor puro (`rank-engine.ts`) con el store. Sexo y peso salen de `gymProfile`
 * (con el último peso registrado como respaldo si el perfil no lo tiene). Si falta alguno no se calcula
 * nada y `missing` dice qué falta (la pantalla de rango abre entonces el formulario de perfil).
 */
import { useMemo } from "react";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";
import {
  computeRankProfile,
  missingBodyInfo,
  type BodyInfo,
  type ExerciseRank,
  type RankProfile,
} from "@/lib/gym/rank-engine";
import type { WorkoutSession } from "@/lib/types";

// Cache por arreglo de sesiones (cambia cuando se registra una serie): muchas tarjetas de ejercicio piden el
// perfil a la vez y así se calcula una sola vez por combinación de sexo/peso/exclusiones.
const profileCache = new WeakMap<WorkoutSession[], Map<string, RankProfile>>();

export function useBodyInfo(): { body: BodyInfo | null; missing: ("sexo" | "peso")[] } {
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  return useMemo(() => {
    const latest = weightEntries.length ? [...weightEntries].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg : undefined;
    const pesoKg = gymProfile?.pesoKg && gymProfile.pesoKg > 0 ? gymProfile.pesoKg : latest;
    const missing = missingBodyInfo({ sexo: gymProfile?.sexo, pesoKg });
    return {
      body: missing.length === 0 ? { sexo: gymProfile!.sexo!, pesoKg: pesoKg! } : null,
      missing,
    };
  }, [gymProfile, weightEntries]);
}

/** Perfil completo de rangos (ejercicios, músculos, grupos, general). null si faltan sexo o peso. */
export function useRankProfile(): { profile: RankProfile | null; missing: ("sexo" | "peso")[]; body: BodyInfo | null } {
  const exercises = useAllExercises();
  const sessions = useGymStore((s) => s.sessions);
  const excluded = useGymStore((s) => s.excludedFromGlobalRank);
  const { body, missing } = useBodyInfo();
  const profile = useMemo(() => {
    if (!body) return null;
    const key = `${body.sexo}|${body.pesoKg}|${exercises.length}|${excluded.join(",")}`;
    const perSessions = profileCache.get(sessions) ?? new Map<string, RankProfile>();
    profileCache.set(sessions, perSessions);
    const hit = perSessions.get(key);
    if (hit) return hit;
    const p = computeRankProfile({ exercises, sessions, body, excluded });
    perSessions.set(key, p);
    return p;
  }, [exercises, sessions, excluded, body]);
  return { profile, missing, body };
}

/** Rango del usuario en un ejercicio (null si no hay estándar, no hay datos o faltan sexo/peso). */
export function useExerciseRank(exerciseId: string): ExerciseRank | null {
  const { profile } = useRankProfile();
  return profile?.byExercise[exerciseId] ?? null;
}
