"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { animationEngine } from "@/lib/animations/animation-engine";
import { playChime } from "@/lib/sound/play-chime";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics/haptics";
import type { ProgressResult } from "@/lib/progress/types";

/** Fiel a Not Boring Habits: el check no es un tap simple — hay que
 * mantener presionado un rato para que se sienta intencional. 550ms deja
 * ver claramente el anillo llenándose sin sentirse lento. */
const HOLD_MS = 550;

/**
 * El check "premium" de un hábito. Orquesta la ceremonia completa (mantener
 * presionado → anillo se llena → soltar feedback: haptics + sonido +
 * evento al Animation Engine), pero NUNCA decide qué animación mostrar
 * fuera de sí mismo — solo emite el evento; quien escuche (p.ej.
 * `<ProgressCrystal/>` en la misma tarjeta) decide su propia reacción. La
 * lógica de negocio (racha/milestone) vive en `onToggle`, que delega al
 * store → Progress Engine; este componente solo reacciona a su resultado.
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
  const [holdProgress, setHoldProgress] = useState(0);
  const [pressing, setPressing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const firedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPressing(false);
    setHoldProgress(0);
  }, []);

  useEffect(() => () => cancelHold(), [cancelHold]);

  const completeNow = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    cancelHold();
    const result = onToggle();
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
  }, [cancelHold, habitId, onToggle]);

  function startHold() {
    if (done) return; // desmarcar es un tap simple, ver handleUndoTap
    firedRef.current = false;
    if (reduceMotion) {
      completeNow();
      return;
    }
    setPressing(true);
    vibrate(HAPTIC_PATTERNS.pressStart);
    animationEngine.emit({ type: "check.press-start", tier: "micro", entityId: habitId });
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        completeNow();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function endHold() {
    if (firedRef.current || done) return;
    if (pressing) animationEngine.emit({ type: "check.press-cancel", tier: "micro", entityId: habitId });
    cancelHold();
  }

  function handleUndoTap() {
    if (!done) return;
    onToggle();
  }

  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={done ? handleUndoTap : endHold}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex items-center justify-center rounded-full cursor-pointer select-none shrink-0"
      style={{ width: size, height: size, touchAction: "none", WebkitTapHighlightColor: "transparent" }}
      aria-label={done ? "Desmarcar hábito" : "Mantén presionado para completar"}
      aria-pressed={done}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accentColor}
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeLinecap="round"
          animate={{ strokeDashoffset: circumference * (1 - (done ? 1 : holdProgress)) }}
          transition={{ duration: pressing || reduceMotion ? 0 : 0.25 }}
        />
      </svg>
      <motion.div
        className="flex items-center justify-center rounded-full"
        style={{ width: size - 12, height: size - 12, background: done ? accentColor : "rgba(255,255,255,0.06)" }}
        animate={{ scale: pressing && !reduceMotion ? 0.92 : 1 }}
        transition={{ duration: 0.15 }}
      >
        <AnimatePresence>
          {done && (
            <motion.span
              initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? undefined : { scale: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 22 }}
            >
              <Check size={size * 0.4} className="text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
