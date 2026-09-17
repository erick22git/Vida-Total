"use client";

import { useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { Check, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exercise, WorkoutExerciseLog } from "@/lib/types";

/** Bloque 16: el carrusel de ejercicios de la sesión activa se puede
 * reordenar por arrastre (mantener presionado un ejercicio para agarrarlo,
 * igual que en ExerciseSessionBuilder al crear/editar una rutina). La
 * vibración acá es corta e inmediata al empezar a mantener presionado, no
 * recién cuando se cumple el hold — distinto del patrón de long-press de
 * ExerciseSessionBuilder, que no vibra. */
export function SessionExerciseCarousel({
  ejercicios,
  allExercises,
  activeIndex,
  onSelect,
  onReorder,
}: {
  ejercicios: WorkoutExerciseLog[];
  allExercises: Exercise[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onReorder: (next: WorkoutExerciseLog[]) => void;
}) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function startLongPress(id: string) {
    longPressFired.current = false;
    navigator.vibrate?.(8);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMovingId(id);
    }, 350);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClick(i: number) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (movingId) {
      setMovingId(null);
      return;
    }
    onSelect(i);
  }

  return (
    <Reorder.Group
      axis="x"
      values={ejercicios}
      onReorder={onReorder}
      className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1"
    >
      {ejercicios.map((log, i) => {
        const ex = allExercises.find((e) => e.id === log.exerciseId);
        const completed = log.sets.length > 0 && log.sets.every((s) => s.completado);
        const isActive = i === activeIndex;
        const isMoving = movingId === log.exerciseId;
        return (
          <Reorder.Item
            key={log.exerciseId + i}
            value={log}
            dragListener={isMoving}
            onPointerDown={() => startLongPress(log.exerciseId)}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={() => handleClick(i)}
            className={cn("shrink-0 flex flex-col items-center gap-1 cursor-pointer select-none", isMoving && "cursor-grabbing")}
          >
            <div
              className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06] transition-transform"
              style={{
                border: isActive ? "2px solid white" : "2px solid transparent",
                boxShadow: isMoving ? "0 0 0 3px rgba(255,255,255,0.5)" : isActive ? "0 0 14px rgba(255,255,255,0.5)" : undefined,
                filter: completed && !isActive ? "brightness(0.5)" : undefined,
                transform: isMoving ? "scale(1.08)" : undefined,
              }}
            >
              {ex?.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ex.imagen} alt="" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <Dumbbell size={20} className="text-white/40" />
              )}
              {completed && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500">
                    <Check size={13} className="text-white" />
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/50 max-w-14 truncate">{ex?.nombre}</span>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
