"use client";

import { Dumbbell, Wrench, Target } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import type { Exercise } from "@/lib/types";

export function ExerciseGuideTab({ exercise }: { exercise: Exercise }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center w-full aspect-video rounded-3xl bg-white/[0.05] glass-specular-ring overflow-hidden">
        {exercise.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exercise.imagen} alt={exercise.nombre} className="w-full h-full object-cover" />
        ) : (
          <Dumbbell size={56} className="text-white/20" />
        )}
      </div>

      {exercise.instrucciones.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-white/80 mb-2.5">Instrucciones</p>
          <ol className="flex flex-col gap-2.5">
            {exercise.instrucciones.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/70">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
                  style={{ background: "var(--gym)33", color: "var(--gym)" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-white/80 mb-2.5">Músculos Trabajados</p>
        <div className="grid grid-cols-2 gap-3">
          <GlassCard padding="sm" interactive={false} accentColor="var(--gym)" className="flex flex-col items-center gap-2 text-center py-4">
            <Target size={22} style={{ color: "var(--gym)" }} />
            <p className="text-[11px] text-white/45">Foco Principal</p>
            <p className="text-sm font-semibold text-white">{exercise.musculoPrimario}</p>
          </GlassCard>
          <GlassCard padding="sm" interactive={false} className="flex flex-col items-center gap-2 text-center py-4">
            <Target size={22} className="text-white/40" />
            <p className="text-[11px] text-white/45">Foco Secundario</p>
            <p className="text-sm font-semibold text-white/80">
              {exercise.musculosSecundarios.length > 0 ? exercise.musculosSecundarios.join(", ") : "—"}
            </p>
          </GlassCard>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-white/80 mb-2.5">Equipamiento</p>
        <GlassCard padding="sm" interactive={false} className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.06]">
            <Wrench size={16} className="text-white/60" />
          </div>
          <span className="text-sm text-white/75">{exercise.equipo}</span>
        </GlassCard>
      </div>
    </div>
  );
}
