"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { SET_TYPE_META } from "@/components/gym/set-type";
import type { WorkoutSession } from "@/lib/types";

export function ExerciseHistoryTab({
  exerciseId,
  sessions,
}: {
  exerciseId: string;
  sessions: WorkoutSession[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const relevant = sessions.filter((s) => s.ejercicios.some((e) => e.exerciseId === exerciseId));

  if (relevant.length === 0) {
    return <p className="text-sm text-white/35 text-center py-10">Aún no hay historial para este ejercicio.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {relevant.map((session) => {
        const log = session.ejercicios.find((e) => e.exerciseId === exerciseId)!;
        const isOpen = openId === session.id;
        const completedSets = log.sets.filter((s) => s.completado);
        return (
          <GlassCard key={session.id} padding="sm" interactive={false} className="flex flex-col gap-2">
            <button
              onClick={() => setOpenId(isOpen ? null : session.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-white">
                  {format(new Date(session.date), "EEEE d MMMM yyyy", { locale: es })}
                </p>
                <p className="text-xs text-white/40">{completedSets.length} series completadas</p>
              </div>
              <ChevronDown size={16} className={`text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="grid grid-cols-3 text-[11px] text-white/40 uppercase font-semibold px-1">
                  <span>Set</span>
                  <span>Kg</span>
                  <span>Reps</span>
                </div>
                {log.sets.map((s, i) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-3 items-center rounded-lg px-2 py-1.5 text-sm"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <span style={{ color: SET_TYPE_META[s.tipo ?? "normal"].color }} className="font-semibold">
                      {(s.tipo ?? "normal") === "normal" ? i + 1 : SET_TYPE_META[s.tipo ?? "normal"].short}
                    </span>
                    <span className="text-white/75 truncate">
                      {s.tipo === "descendente" && s.pesosDescendentes && s.pesosDescendentes.length > 0
                        ? s.pesosDescendentes.join("→")
                        : s.peso}
                    </span>
                    <span className="text-white/75">{s.reps}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
