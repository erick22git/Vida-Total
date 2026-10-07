"use client";

/** Lectores de Entrenamiento y Agenda EN LA APP. */
import { format } from "date-fns";
import exercisesData from "@/lib/data/exercises.json";
import { computeRankProfile, missingBodyInfo } from "@/lib/gym/rank-engine";
import { useGymStore } from "@/lib/store/gymStore";
import { useHabitsStore } from "@/lib/store/habitsStore";
import type { Exercise } from "@/lib/types";
import type { Args } from "../tools/meta";
import type { ExecResult } from "./client";
import { agendaForDay, exerciseName, trainingToday } from "./readers-pure";

const ok = (summary: string, data: unknown): ExecResult => ({ ok: true, summary, data });

const dayDate = (key?: unknown) => (typeof key === "string" ? new Date(`${key}T12:00:00`) : new Date());

export const READER_EXECUTORS: Record<string, (args: Args) => ExecResult> = {
  training_today: (a) => {
    const g = useGymStore.getState();
    const d = dayDate(a.fecha);
    const custom = g.customExercises.map((c) => ({ id: c.id, nombre: c.nombre }));
    return ok("Entrenamiento del día", trainingToday(g.weeklyPlan, g.routines, d.getDay(), (id) => exerciseName(id, custom)));
  },
  agenda_today: (a) => {
    const h = useHabitsStore.getState();
    const key = typeof a.fecha === "string" ? a.fecha : format(new Date(), "yyyy-MM-dd");
    return ok("Agenda del día", agendaForDay(h.tasks, h.timeBlocks, h.routines, key));
  },
  ranks_summary: () => {
    const g = useGymStore.getState();
    const latest = g.weightEntries.length ? [...g.weightEntries].sort((x, y) => y.date.localeCompare(x.date))[0]?.kg : undefined;
    const pesoKg = g.gymProfile?.pesoKg && g.gymProfile.pesoKg > 0 ? g.gymProfile.pesoKg : latest;
    const missing = missingBodyInfo({ sexo: g.gymProfile?.sexo, pesoKg });
    if (missing.length) return { ok: false, summary: `Faltan datos para calcular rangos: ${missing.join(", ")}.`, error: "missing_body_info" };
    const exercises = [...(exercisesData as Exercise[]), ...g.customExercises];
    const p = computeRankProfile({ exercises, sessions: g.sessions, body: { sexo: g.gymProfile!.sexo!, pesoKg: pesoKg! }, excluded: g.excludedFromGlobalRank });
    const line = (grupo: string, r: { rank: { label: string } | null; rated: number; total: number }) => ({ grupo, rango: r.rank?.label ?? null, evaluados: r.rated, total: r.total });
    return ok("Rangos", { general: line("general", p.general), grupos: Object.entries(p.byGroup).map(([k, v]) => line(k, v)), musculos: Object.entries(p.byMuscle).map(([k, v]) => line(k, v)) });
  },
};
