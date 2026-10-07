"use client";

/**
 * Carrusel VERTICAL de resultados de búsqueda (rediseño Calorías, etapa 4). Mecánica portada del
 * código de referencia que pasó el usuario (carrusel de equipo, HTML/CSS/JS vanilla): una tarjeta
 * central grande y enfocada, las de arriba/abajo más chicas, más tenues y en escala de grises, con
 * perspectiva — se navega con swipe vertical, tocando una tarjeta o con las flechas. Sin scrollbar
 * visible: el movimiento lo hace `transform`, no `overflow-y` con scroll nativo.
 *
 * Layout de tarjeta: ícono a la izquierda + nombre/kcal a la derecha (no fotos reales todavía, tal
 * como pidió el usuario). Las flechas y los colores quedan provisionales — se ajustan con las fotos
 * de referencia de Not Boring en la fase 2.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { FoodPhoto } from "@/components/gym/food-photo";
import { VerifiedBadge } from "@/components/gym/verified-badge";
import { categoryEmoji } from "@/lib/food-category-emoji";
import type { Food } from "@/lib/types";

const SWIPE_OFFSET = 45;
const SWIPE_VELOCITY = 350;

/** Escala/opacidad de cada posición relativa al centro — mismos 5 niveles que el original (center, ±1, ±2), el
 * resto queda oculto. La separación vertical (`y`) se acercó para que se vean más tarjetas a la vez, y se acerca
 * todavía más con el teclado abierto (`compact`); la escala y el estilo no cambian. Con tarjetas de 92/62/52 px
 * (enfocada/±1/±2) las separaciones mínimas sin solaparse son 77 y 134 px: ninguna queda por debajo. */
const SLOT_Y = {
  normal: { 1: 100, 2: 172 },
  compact: { 1: 82, 2: 142 },
} as const;
const SLOT_BASE = {
  0: { scale: 1, opacity: 1, z: 0, gray: 0 },
  1: { scale: 0.86, opacity: 0.55, z: -80, gray: 1 },
  2: { scale: 0.72, opacity: 0.28, z: -180, gray: 1 },
} as const;

function slotFor(offset: -2 | -1 | 0 | 1 | 2, compact: boolean) {
  const abs = Math.abs(offset) as 0 | 1 | 2;
  const base = SLOT_BASE[abs];
  const y = abs === 0 ? 0 : SLOT_Y[compact ? "compact" : "normal"][abs] * Math.sign(offset);
  return { ...base, y };
}

function FoodCard({ food, offset, compact, onClick }: { food: Food; offset: -2 | -1 | 0 | 1 | 2; compact: boolean; onClick: () => void }) {
  const slot = slotFor(offset, compact);
  const focused = offset === 0;
  return (
    <motion.div
      onClick={onClick}
      className="absolute left-1/2 w-[86%] max-w-sm rounded-3xl flex items-center gap-3 px-4 select-none cursor-pointer"
      style={{
        translateX: "-50%",
        height: focused ? 92 : 72,
        top: "50%",
        marginTop: focused ? -46 : -36,
        background: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        border: focused ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
        filter: slot.gray ? "grayscale(0.7)" : "none",
        zIndex: 10 - Math.abs(offset),
        pointerEvents: "auto",
      }}
      animate={{ y: slot.y, scale: slot.scale, opacity: slot.opacity, z: slot.z }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <FoodPhoto photoUrl={food.photoUrl} alt={food.nombre} size={focused ? 52 : 40} emoji={categoryEmoji(food.categoria)} />
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 font-semibold text-white ${focused ? "text-sm" : "text-xs text-white/70"}`}>
          <span className="truncate">{food.nombre}</span>
          <VerifiedBadge item={food} size={focused ? 14 : 12} />
        </p>
        {focused && (
          <p className="text-xs text-white/45 truncate">
            {food.porcion} · {Math.round(food.calorias)} kcal
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function FoodSearchCarousel({ foods, onSelect, compact = false }: { foods: Food[]; onSelect: (food: Food) => void; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const busy = useRef(false);
  const n = foods.length;

  const goTo = useCallback(
    (next: number) => {
      if (n === 0 || busy.current) return;
      busy.current = true;
      setIndex(((next % n) + n) % n);
      setTimeout(() => (busy.current = false), 460);
    },
    [n],
  );

  const onDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -SWIPE_OFFSET || info.velocity.y < -SWIPE_VELOCITY) goTo(index + 1);
    else if (info.offset.y > SWIPE_OFFSET || info.velocity.y > SWIPE_VELOCITY) goTo(index - 1);
  };

  const visible = useMemo(() => {
    if (n === 0) return [];
    const offsets: (-2 | -1 | 0 | 1 | 2)[] = n > 4 ? [-2, -1, 0, 1, 2] : n > 2 ? [-1, 0, 1] : n === 2 ? [0, 1] : [0];
    return offsets.map((o) => ({ offset: o, food: foods[((index + o) % n + n) % n] }));
  }, [foods, index, n]);

  if (n === 0) {
    return <p className="text-center text-sm text-white/40 py-10">Sin resultados.</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-0">
      {/* Con el teclado abierto se esconden las flechas y el contador (se sigue deslizando/tocando) para dar el espacio a las tarjetas. */}
      {!compact && (
        <button
          onClick={() => goTo(index - 1)}
          aria-label="Anterior"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] text-white/60 cursor-pointer shrink-0"
        >
          <ChevronUp size={18} />
        </button>
      )}

      <motion.div
        className="relative w-full touch-none flex-1 min-h-[120px] overflow-hidden"
        style={{ maxHeight: 400, perspective: 900 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.5}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        {visible.map(({ offset, food }) => (
          <FoodCard key={`${offset}-${food.id}`} food={food} offset={offset} compact={compact} onClick={() => (offset === 0 ? onSelect(food) : goTo(index + offset))} />
        ))}
      </motion.div>

      {!compact && (
        <>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Siguiente"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] text-white/60 cursor-pointer shrink-0"
          >
            <ChevronDown size={18} />
          </button>

          <span className="text-[11px] text-white/35 tabular-nums shrink-0">
            {index + 1} / {n}
          </span>
        </>
      )}
    </div>
  );
}
