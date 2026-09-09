"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, ChevronDown, ChevronRight, Dumbbell, ListChecks } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { BodySilhouetteFront, BodySilhouetteBack, type BodyZone } from "@/components/gym/body-silhouette";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";
import { getExerciseSP, getExerciseVolume, getRankStanding, RANK_TIERS } from "@/lib/gym-utils";
import type { Exercise, MuscleGroup } from "@/lib/types";

const CATEGORY_TO_ZONES: Partial<Record<MuscleGroup, BodyZone[]>> = {
  Pecho: ["pecho"],
  Espalda: ["espalda", "trapecio"],
  Hombros: ["hombros"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Piernas: ["cuadriceps", "gemelos", "isquios"],
  Gluteos: ["gluteos"],
  Abdomen: ["abdomen"],
  Abductores: ["gluteos", "cuadriceps"],
  Aductores: ["cuadriceps", "gluteos"],
};

interface MuscleGroupDef {
  key: string;
  categories: MuscleGroup[];
  subgroups?: string[];
}

const MUSCLE_GROUP_DEFS: MuscleGroupDef[] = [
  { key: "Brazos", categories: ["Biceps", "Triceps"], subgroups: ["Bíceps", "Antebrazos", "Tríceps"] },
  { key: "Piernas", categories: ["Piernas", "Gluteos", "Abductores", "Aductores"] },
  { key: "Espalda", categories: ["Espalda"] },
  { key: "Pecho", categories: ["Pecho"] },
  { key: "Hombros", categories: ["Hombros"] },
  { key: "Abdominales", categories: ["Abdomen"] },
  { key: "Cuello", categories: [] },
];

export default function BodyMapPage() {
  const allExercises = useAllExercises();
  const sessions = useGymStore((s) => s.sessions);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subgroupSheet, setSubgroupSheet] = useState<{ group: string; sub: string } | null>(null);

  const volumeByCategory = useMemo(() => {
    const map: Partial<Record<MuscleGroup, number>> = {};
    for (const ex of allExercises) {
      const vol = getExerciseVolume(ex.id, sessions);
      if (vol > 0) map[ex.categoria] = (map[ex.categoria] ?? 0) + vol;
    }
    return map;
  }, [allExercises, sessions]);

  const maxVolume = Math.max(1, ...Object.values(volumeByCategory));

  const intensities = useMemo(() => {
    const zones: Partial<Record<BodyZone, number>> = {};
    for (const [cat, vol] of Object.entries(volumeByCategory) as [MuscleGroup, number][]) {
      const zoneList = CATEGORY_TO_ZONES[cat];
      if (!zoneList) continue;
      const intensity = Math.min(1, vol / maxVolume);
      for (const zone of zoneList) zones[zone] = Math.max(zones[zone] ?? 0, intensity);
    }
    return zones;
  }, [volumeByCategory, maxVolume]);

  const unclassifiedCount = allExercises.filter((e) => getExerciseSP(e.id, sessions) === 0).length;

  const overallSp = allExercises.reduce((sum, e) => sum + getExerciseSP(e.id, sessions), 0) / Math.max(1, allExercises.length);
  const overallStanding = getRankStanding(Math.round(overallSp));

  function groupStanding(categories: MuscleGroup[]) {
    const exs = allExercises.filter((e) => categories.includes(e.categoria));
    const classified = exs.filter((e) => getExerciseSP(e.id, sessions) > 0);
    const avgSp = classified.length
      ? classified.reduce((sum, e) => sum + getExerciseSP(e.id, sessions), 0) / classified.length
      : 0;
    return { total: exs.length, classified: classified.length, standing: getRankStanding(Math.round(avgSp)) };
  }

  function suggestedExercises(categories: MuscleGroup[]): Exercise[] {
    return allExercises.filter((e) => categories.includes(e.categoria)).slice(0, 6);
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield style={{ color: overallStanding.tier.color }} /> Rango Global
        </h1>
      </header>

      <GlassCard accentColor={overallStanding.tier.color} glow className="flex flex-col gap-3">
        <p className="text-xs text-white/45">Rango predecido</p>
        <h2 className="text-2xl font-extrabold" style={{ color: overallStanding.tier.color }}>
          {overallStanding.tier.name} {overallStanding.tierIndex > 0 ? "I" : ""}
        </h2>
        {overallStanding.tier.topPct && (
          <p className="text-sm text-white/55">¿Eres parte del top {overallStanding.tier.topPct}%?</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {RANK_TIERS.map((t, i) => (
            <div
              key={t.key}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: i <= overallStanding.tierIndex ? t.color : "rgba(255,255,255,0.08)" }}
            />
          ))}
        </div>
        <Link
          href="/gym/entrenamiento"
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold cursor-pointer"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <ListChecks size={15} /> Clasificar Ejercicios · {unclassifiedCount} restantes
        </Link>
      </GlassCard>

      <div className="flex items-center justify-around gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <BodySilhouetteFront intensities={intensities} size={130} />
          <span className="text-[11px] text-white/40">Frente</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <BodySilhouetteBack intensities={intensities} size={130} />
          <span className="text-[11px] text-white/40">Espalda</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold text-white/85">Rankings Musculares</h3>
        {MUSCLE_GROUP_DEFS.map((group) => {
          const { total, classified, standing } = groupStanding(group.categories);
          const isOpen = expanded === group.key;
          return (
            <GlassCard key={group.key} padding="sm" interactive={false} className="flex flex-col gap-2">
              <button
                onClick={() => setExpanded(isOpen ? null : group.key)}
                className="flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium text-white">{group.key}</span>
                <div className="flex items-center gap-2">
                  {classified === 0 ? (
                    <span className="text-[11px] font-semibold text-white/35">SIN RANGO</span>
                  ) : (
                    <span className="text-[11px] font-semibold" style={{ color: standing.tier.color }}>
                      {standing.tier.name}
                    </span>
                  )}
                  <span className="text-[11px] text-white/35">
                    {classified}/{total}
                  </span>
                  <ChevronDown size={14} className={`text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {group.subgroups ? (
                    group.subgroups.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSubgroupSheet({ group: group.key, sub })}
                        className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.04] cursor-pointer"
                      >
                        <span className="text-xs text-white/70">{sub}</span>
                        <ChevronRight size={13} className="text-white/30" />
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => setSubgroupSheet({ group: group.key, sub: group.key })}
                      className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.04] cursor-pointer"
                    >
                      <span className="text-xs text-white/70">Ver ejercicios sugeridos</span>
                      <ChevronRight size={13} className="text-white/30" />
                    </button>
                  )}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <GlassModal
        open={!!subgroupSheet}
        onClose={() => setSubgroupSheet(null)}
        title={subgroupSheet?.sub}
      >
        {subgroupSheet && (
          <div className="flex flex-col gap-4">
            {(() => {
              const groupDef = MUSCLE_GROUP_DEFS.find((g) => g.key === subgroupSheet.group);
              const { classified, total, standing } = groupStanding(groupDef?.categories ?? []);
              return (
                <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.1]">
                  <div>
                    <p className="text-sm font-semibold text-white">{subgroupSheet.sub}</p>
                    <p className="text-xs text-white/40">
                      {classified}/{total} ejercicios clasificados
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: classified ? standing.tier.color : "rgba(255,255,255,0.35)" }}>
                    {classified ? standing.tier.name : "Sin rango"}
                  </span>
                </div>
              );
            })()}
            <p className="text-sm font-semibold text-white/80">Entrena tus {subgroupSheet.sub.toLowerCase()}</p>
            <div className="grid grid-cols-2 gap-3">
              {suggestedExercises(MUSCLE_GROUP_DEFS.find((g) => g.key === subgroupSheet.group)?.categories ?? []).map((ex) => (
                <Link key={ex.id} href={`/gym/entrenamiento/${ex.id}`} onClick={() => setSubgroupSheet(null)}>
                  <GlassCard padding="sm" className="flex flex-col gap-2 h-full">
                    <div className="flex items-center justify-center w-full aspect-square rounded-xl bg-white/[0.05]">
                      {ex.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ex.imagen} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Dumbbell size={22} className="text-white/25" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-white leading-tight">{ex.nombre}</p>
                  </GlassCard>
                </Link>
              ))}
              {suggestedExercises(MUSCLE_GROUP_DEFS.find((g) => g.key === subgroupSheet.group)?.categories ?? []).length === 0 && (
                <p className="col-span-2 text-sm text-white/35 text-center py-6">No hay ejercicios disponibles todavía.</p>
              )}
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
}
