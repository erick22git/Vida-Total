"use client";

import { Check, Dumbbell } from "lucide-react";
import type { Exercise, WorkoutExerciseLog } from "@/lib/types";

export function SessionExerciseCarousel({
  ejercicios,
  allExercises,
  activeIndex,
  onSelect,
}: {
  ejercicios: WorkoutExerciseLog[];
  allExercises: Exercise[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
      {ejercicios.map((log, i) => {
        const ex = allExercises.find((e) => e.id === log.exerciseId);
        const completed = log.sets.length > 0 && log.sets.every((s) => s.completado);
        const isActive = i === activeIndex;
        return (
          <button
            key={log.exerciseId + i}
            onClick={() => onSelect(i)}
            className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
          >
            <div
              className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06]"
              style={{
                border: isActive ? "2px solid white" : "2px solid transparent",
                boxShadow: isActive ? "0 0 14px rgba(255,255,255,0.5)" : undefined,
                filter: completed && !isActive ? "brightness(0.5)" : undefined,
              }}
            >
              {ex?.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ex.imagen} alt="" className="w-full h-full object-cover" />
              ) : (
                <Dumbbell size={20} className="text-white/40" />
              )}
              {completed && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500">
                    <Check size={13} className="text-white" />
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/50 max-w-14 truncate">{ex?.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
