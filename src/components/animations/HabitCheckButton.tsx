"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { animationEngine } from "@/lib/animations/animation-engine";
import { playChime } from "@/lib/sound/play-chime";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics/haptics";
import type { ProgressResult } from "@/lib/progress/types";

/**
 * El check de un hábito. Un tap simple marca/desmarca (el gesto de
 * "mantener presionado" de la v1 resultaba confuso — un toque rápido en
 * celular soltaba antes de cumplir el umbral y no quedaba nada marcado).
 * Al MARCAR: vibración + sonido + animación de check, y evento al
 * Animation Engine para que quien escuche (p.ej. `<ProgressCrystal/>`)
 * reaccione — este botón nunca decide esa reacción, solo la dispara. Al
 * DESMARCAR no hay ceremonia (es un "deshacer", no un logro).
 */
export function HabitCheckButton({
  habitId,
  done,
  accentColor = "var(--habitos)",
  reduceMotion,
  onToggle,
  size = 44,
}: {
  habitId: string;
  done: boolean;
  accentColor?: string;
  reduceMotion: boolean;
  /** Acción de negocio (store) — devuelve el resultado del Progress Engine
   * al marcar como hecho, o `null` al desmarcar. */
  onToggle: () => ProgressResult | null;
  size?: number;
}) {
  const handleClick = useCallback(() => {
    const wasDone = done;
    const result = onToggle();
    if (wasDone) return; // desmarcar: sin celebración

    vibrate(HAPTIC_PATTERNS.habitComplete);
    playChime();
    animationEngine.emit({ type: "habit.completed", tier: "action", entityId: habitId, meta: { streak: result?.streak } });
    if (result?.milestoneReached) {
      // Un pequeño delay para que no compitan las dos ceremonias a la vez —
      // primero se siente "completaste", después "además es un hito".
      setTimeout(() => {
        vibrate(HAPTIC_PATTERNS.milestone);
        animationEngine.emit({
          type: "streak.milestone",
          tier: "milestone",
          entityId: habitId,
          meta: { streak: result.streak, milestone: result.milestoneReached ?? undefined },
        });
      }, 380);
    }
  }, [done, habitId, onToggle]);

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center rounded-full cursor-pointer select-none shrink-0"
      style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
      aria-label={done ? "Desmarcar hábito" : "Marcar hábito como hecho"}
      aria-pressed={done}
    >
      <motion.div
        className="flex items-center justify-center rounded-full w-full h-full"
        style={{
          background: done ? accentColor : "rgba(255,255,255,0.06)",
          border: `2px solid ${done ? accentColor : "rgba(255,255,255,0.25)"}`,
          boxShadow: done ? `0 2px 10px ${accentColor}66` : undefined,
        }}
        animate={reduceMotion ? undefined : { scale: done ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <AnimatePresence>
          {done && (
            <motion.span
              initial={reduceMotion ? false : { scale: 0, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={reduceMotion ? undefined : { scale: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 20 }}
            >
              <Check size={size * 0.5} className="text-white" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
