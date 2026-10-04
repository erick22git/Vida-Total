"use client";

import { Dumbbell } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import type { Exercise } from "@/lib/types";
import { useExerciseRank } from "@/lib/gym/use-rank";
import { RankIcon } from "@/components/gym/rank-icon";

export function ExerciseCard({
  exercise,
  onClick,
  active,
  activeColor = "var(--gym)",
}: {
  exercise: Exercise;
  onClick?: () => void;
  active?: boolean;
  /** Color del glow/borde cuando `active`. Por default el acento naranja
   * del módulo (usado p.ej. para marcar el ejercicio en curso durante una
   * sesión activa) — el selector múltiple de la creación de rutina pasa
   * verde acá para que "seleccionado para agregar" se vea distinto de
   * "ejercicio actual". */
  activeColor?: string;
}) {
  const exerciseRank = useExerciseRank(exercise.id);

  return (
    <GlassCard
      padding="sm"
      onClick={onClick}
      accentColor={active ? activeColor : undefined}
      glow={active}
      className="flex flex-col gap-2 cursor-pointer h-full"
    >
      <div className="relative flex items-center justify-center w-full aspect-[4/3] rounded-2xl bg-white/[0.05] glass-specular-ring overflow-hidden">
        {exercise.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.imagen}
            alt={exercise.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <Dumbbell size={28} className="text-white/25" />
        )}
        {/* Tu rango en este ejercicio: solo el ícono (sin rango = sin ícono) */}
        {exerciseRank && (
          <div className="absolute right-1.5 top-1.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
            <RankIcon tierKey={exerciseRank.rank.tier.key} level={exerciseRank.rank.level} size={30} />
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-white leading-tight">{exercise.nombre}</p>
      <p className="text-xs text-white/45">{exercise.musculoPrimario}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <GlassBadge color="var(--gym)">{exercise.categoria}</GlassBadge>
      </div>
    </GlassCard>
  );
}
