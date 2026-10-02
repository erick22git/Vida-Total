"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Check, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exercise, WorkoutExerciseLog } from "@/lib/types";

const HOLD_MS = 220;
// Si el dedo se mueve más que esto antes de cumplirse el "mantener presionado", se trata de un
// deslizamiento normal del carrusel (scroll), no de agarrar el ejercicio para reordenarlo.
const HOLD_SLOP_PX = 8;

/** El carrusel de ejercicios de la sesión activa se puede reordenar mantener-presionando un
 * ejercicio y arrastrándolo en horizontal. Antes el arrastre se habilitaba DESPUÉS de apoyar el
 * dedo (`dragListener` cambiaba a true a mitad del gesto) y framer-motion ya había ignorado ese
 * toque — por eso "no se movía por más que lo intentara". Ahora, al cumplirse el hold, se arranca
 * el arrastre a mano con `dragControls.start(...)` usando el mismo toque, y se bloquea el scroll
 * del navegador (touchmove no pasivo) para que no le gane el gesto al arrastre. */
export function SessionExerciseCarousel({
  ejercicios,
  allExercises,
  activeIndex,
  onSelect,
  onReorder,
  onAdd,
}: {
  ejercicios: WorkoutExerciseLog[];
  allExercises: Exercise[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onReorder: (next: WorkoutExerciseLog[]) => void;
  /** Botón "+" al final del carrusel — agregar un ejercicio a último momento,
   * ya con el entrenamiento en curso. */
  onAdd?: () => void;
}) {
  return (
    <Reorder.Group
      axis="x"
      values={ejercicios}
      onReorder={onReorder}
      className="flex gap-2.5 overflow-x-auto no-scrollbar px-1 pt-2.5 pb-1"
    >
      {ejercicios.map((log, i) => (
        <ReorderableExerciseCircle
          key={log.exerciseId}
          value={log}
          imagen={allExercises.find((e) => e.id === log.exerciseId)?.imagen}
          nombre={allExercises.find((e) => e.id === log.exerciseId)?.nombre}
          isActive={i === activeIndex}
          completed={log.sets.length > 0 && log.sets.every((s) => s.completado)}
          onSelect={() => onSelect(i)}
        />
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center bg-white/[0.05] border border-dashed border-white/20 text-white/50 text-2xl cursor-pointer"
        >
          +
        </button>
      )}
    </Reorder.Group>
  );
}

/** Círculo de ejercicio reordenable (mantener y arrastrar en horizontal). Compartido con el editor
 * de rutinas (`ExerciseSessionBuilder`) para que los dos se muevan igual. Debe renderizarse dentro
 * de un `Reorder.Group` y con una `key` estable (el id del ejercicio, nunca el índice). */
export function ReorderableExerciseCircle<T>({
  value,
  imagen,
  nombre,
  isActive,
  completed = false,
  onSelect,
}: {
  value: T;
  imagen?: string;
  nombre?: string;
  isActive: boolean;
  completed?: boolean;
  onSelect: () => void;
}) {
  const controls = useDragControls();
  const [isMoving, setIsMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const holdFired = useRef(false);
  // Mientras se está arrastrando, el navegador no debe scrollear la página/carrusel con el mismo dedo.
  useEffect(() => {
    if (!isMoving) return;
    const block = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, [isMoving]);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    holdFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    const nativeEvent = e.nativeEvent;
    clearTimer();
    timer.current = setTimeout(() => {
      holdFired.current = true;
      navigator.vibrate?.(10);
      setIsMoving(true);
      controls.start(nativeEvent);
    }, HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!timer.current || !start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HOLD_SLOP_PX) clearTimer();
  }

  function release() {
    clearTimer();
    setIsMoving(false);
  }

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onDragEnd={release}
      onClick={() => {
        if (holdFired.current) {
          holdFired.current = false;
          return;
        }
        onSelect();
      }}
      whileDrag={{ scale: 1.1, zIndex: 20 }}
      className={cn("shrink-0 flex flex-col items-center gap-1 cursor-pointer select-none", isMoving && "cursor-grabbing")}
    >
      <div
        className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06] transition-transform"
        style={{
          border: isActive ? "2px solid white" : "2px solid transparent",
          boxShadow: isMoving ? "0 0 0 3px rgba(255,255,255,0.5)" : isActive ? "0 0 14px rgba(255,255,255,0.5)" : undefined,
          filter: completed && !isActive ? "brightness(0.5)" : undefined,
        }}
      >
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
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
      <span className="text-[10px] text-white/50 max-w-14 truncate">{nombre}</span>
    </Reorder.Item>
  );
}
