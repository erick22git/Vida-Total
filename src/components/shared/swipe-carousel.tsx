"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { playEvent } from "@/lib/sound/sound-manager";

/**
 * Carrusel horizontal por swipe: la mecánica que ya usaba Hábitos para navegar entre hábitos (extraída sin cambiarle el
 * comportamiento) y que ahora reutiliza Calorías para navegar entre comidas (Desayuno/Almuerzo/Cena/Snacks). No sabe nada
 * del dominio: el elemento actual sale y el siguiente entra desde el lado contrario, con swipe táctil, drag y flechas del
 * teclado a cargo de quien lo use; este módulo solo resuelve el índice/dirección y el gesto.
 */

/** Distancia/velocidad mínimas del swipe horizontal para cambiar de elemento (mismo umbral en toda la app). */
export const SWIPE_OFFSET = 70;
export const SWIPE_VELOCITY = 450;

/** El elemento actual sale y el siguiente entra desde el lado contrario, con un poco de escala/opacidad para dar profundidad. */
export const swipeSlide = {
  enter: (dir: number) => ({ x: dir * 110, opacity: 0, scale: 0.9 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -110, opacity: 0, scale: 0.9 }),
};

/**
 * Maneja la DIRECCIÓN y el gesto de arrastre de un carrusel horizontal. El ÍNDICE lo sigue guardando quien lo usa (en
 * Hábitos, otros efectos —la URL, un aviso de otro módulo— también lo cambian sin pasar por `goTo`), así que este hook
 * solo decide la dirección y avisa por `onIndexChange` cuando el USUARIO navega (swipe, flecha, tap en un punto).
 */
export function useSwipeCarousel({
  index,
  length,
  onIndexChange,
}: {
  index: number;
  length: number;
  onIndexChange: (next: number, direction: 1 | -1) => void;
}) {
  const [direction, setDirection] = useState<1 | -1>(1);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= length || next === index) return;
      const dir: 1 | -1 = next > index ? 1 : -1;
      setDirection(dir);
      void playEvent("carousel-change");
      onIndexChange(next, dir);
    },
    [index, length, onIndexChange],
  );

  const onDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) goTo(index + 1);
      else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) goTo(index - 1);
    },
    [goTo, index],
  );

  return { direction, setDirection, goTo, onDragEnd };
}

/** Envoltura draggable + animada de un elemento del carrusel (el hábito o la comida actual). */
export function SwipeCarouselStage({
  itemKey,
  direction,
  length,
  onDragEnd,
  className,
  children,
}: {
  itemKey: string | number;
  direction: number;
  /** Cantidad total de elementos: con uno solo el arrastre es apenas elástico (no hay a dónde ir). */
  length: number;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={itemKey}
        custom={direction}
        variants={swipeSlide}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={length > 1 ? 0.55 : 0.12}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
        className={className ?? "absolute inset-0"}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Puntos de posición (o "1 / N" si hay demasiados para puntos legibles) — discreto, no es una tab bar. */
export function SwipeCarouselDots({
  length,
  index,
  onSelect,
  getKey,
  getAriaLabel,
  maxDots = 8,
}: {
  length: number;
  index: number;
  onSelect: (i: number) => void;
  getKey?: (i: number) => string | number;
  getAriaLabel?: (i: number) => string;
  maxDots?: number;
}) {
  if (length <= 1) return null;
  return (
    <div className="h-5 shrink-0 flex items-center justify-center gap-1" style={MONO_FONT}>
      {length > maxDots ? (
        <span className="text-[11px] text-white/45 tabular-nums">
          {index + 1} / {length}
        </span>
      ) : (
        Array.from({ length }, (_, i) => (
          <button
            key={getKey?.(i) ?? i}
            onClick={() => onSelect(i)}
            aria-label={getAriaLabel?.(i) ?? `Ir a ${i + 1}`}
            className="w-4 h-4 flex items-center justify-center cursor-pointer"
          >
            <span
              className="rounded-full transition-all"
              style={{
                width: i === index ? 7 : 5,
                height: i === index ? 7 : 5,
                background: i === index ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            />
          </button>
        ))
      )}
    </div>
  );
}
