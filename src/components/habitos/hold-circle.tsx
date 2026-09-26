"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from "framer-motion";
import { animationEngine } from "@/lib/animations/animation-engine";
import { startHoldSound } from "@/lib/sound/sound-engine";
import { haptic } from "@/lib/haptics/haptic";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { BigCheck } from "@/components/habitos/big-check";

/** Cuánto hay que mantener presionado para completar. */
const HOLD_MS = 800;
/** Rebote guía: 0.9 s de movimiento + 1.5 s de pausa. */
const GUIDE_PERIOD_MS = 2400;
/** Si el dedo se mueve más que esto se cancela el hold (es un swipe). */
const MOVE_CANCEL_PX = 10;

/**
 * Círculo principal del hábito: la interacción principal de la pantalla.
 *
 * PRESS → HOLD (progreso 0→1 en tiempo real) → COMPLETE. Mientras se
 * mantiene presionado el círculo se contrae un poco, se ilumina, aparece
 * el check "en preparación", un anillo se va cerrando y suena un tono que
 * sube. Soltar antes de tiempo revierte todo. El progreso es un
 * `MotionValue` (no estado de React) para no re-renderizar cada frame.
 *
 * Este componente solo detecta el gesto y llama `onComplete`/`onUndo`; la
 * lógica de negocio (Progress Engine) y el feedback de sonido/háptico al
 * completar viven fuera (ver `completeHabit` y `useHabitFeedback`).
 */
export function HoldCircle({
  habitId,
  name,
  subtitle,
  done,
  reduceMotion,
  attention = false,
  onComplete,
  onUndo,
}: {
  habitId: string;
  name: string;
  /** Línea de objetivo bajo el nombre (p.ej. "8 vasos"). */
  subtitle?: string;
  done: boolean;
  reduceMotion: boolean;
  /** Un módulo (Gym) ya cumplió el objetivo: el check invita a tocarlo (rebote suave + pausa + brillo). No lo completa. */
  attention?: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const progress = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const sound = useRef<ReturnType<typeof startHoldSound> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [pressed, setPressed] = useState(false);
  const guiding = attention && !done && !pressed;

  // Un toque háptico suave acompaña cada rebote (mismo ritmo que la animación).
  useEffect(() => {
    if (!guiding) return;
    const id = setInterval(() => haptic("light"), GUIDE_PERIOD_MS);
    return () => clearInterval(id);
  }, [guiding]);

  const scale = useTransform(progress, [0, 1], [1, reduceMotion ? 1 : 0.94]);
  const glow = useTransform(progress, [0, 1], [0, 0.5]);
  const checkOpacity = useTransform(progress, [0.15, 1], [0, 0.4]);
  const nameOpacity = useTransform(progress, [0, 0.8], [1, 0.15]);
  const ring = useTransform(progress, (p) => p);
  const ringOpacity = useTransform(progress, [0, 0.02], [0, 1]);

  // El tono del hold acompaña el progreso.
  useEffect(() => progress.on("change", (v) => sound.current?.update(v)), [progress]);
  useEffect(
    () => () => {
      anim.current?.stop();
      sound.current?.stop();
    },
    [],
  );

  function reset(duration: number) {
    anim.current?.stop();
    anim.current = animate(progress, 0, { duration, ease: "easeOut" });
  }

  function cancel() {
    if (!start.current) return;
    start.current = null;
    setPressed(false);
    sound.current?.stop();
    sound.current = null;
    reset(0.25);
    animationEngine.emit({ type: "check.press-cancel", tier: "micro", entityId: habitId });
  }

  function finish() {
    start.current = null;
    setPressed(false);
    sound.current?.stop();
    sound.current = null;
    if (done) onUndo();
    else onComplete();
    reset(0.35);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button > 0 || start.current) return;
    start.current = { x: e.clientX, y: e.clientY };
    setPressed(true);
    animationEngine.emit({ type: "check.press-start", tier: "micro", entityId: habitId });
    sound.current = startHoldSound();
    anim.current?.stop();
    anim.current = animate(progress, 1, { duration: HOLD_MS / 1000, ease: "linear", onComplete: finish });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_CANCEL_PX) cancel();
  }

  return (
    <motion.div
      className="relative w-[68vw] max-w-[340px] aspect-square cursor-pointer select-none"
      style={{ scale, WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      aria-label={done ? "Mantén presionado para desmarcar" : "Mantén presionado para completar"}
    >
      {/* Al cambiar `done` el bloque se remonta y entra con un pequeño
          resorte — la animación "normal" de completar es corta a propósito. */}
      {guiding && (
        <motion.div
          className="absolute -inset-2 rounded-full pointer-events-none"
          style={{ border: "2px solid #f5b301" }}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.85, 0], scale: reduceMotion ? [1, 1.03, 1] : [1, 1.07, 1] }}
          transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 1.1, ease: "easeOut" }}
          aria-hidden
        />
      )}
      <motion.div
        animate={guiding && !reduceMotion ? { y: [0, -16, 0, -7, 0] } : { y: 0 }}
        transition={guiding && !reduceMotion ? { duration: 0.9, times: [0, 0.3, 0.55, 0.75, 1], ease: "easeOut", repeat: Infinity, repeatDelay: 1.5 } : { duration: 0.2 }}
        className="w-full h-full"
      >
      <motion.div
        key={String(done)}
        className="w-full h-full"
        initial={reduceMotion ? false : { scale: 0.93 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
      >
        <HabitOrb done={done} className="w-full">
          {done ? (
            <BigCheck size={170} />
          ) : (
            <>
              <motion.div className="px-8 flex flex-col items-center gap-2" style={{ opacity: nameOpacity }}>
                <span className="text-center text-[34px] font-extrabold leading-[1.02] tracking-tight line-clamp-3 break-words">{name}</span>
                {subtitle && (
                  <span className="text-[12px] uppercase tracking-[0.14em] text-white/55" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                    {subtitle}
                  </span>
                )}
              </motion.div>
              {/* Check "en preparación": aparece a medida que avanza el hold. */}
              <motion.div className="absolute inset-0 flex items-center justify-center" style={{ opacity: checkOpacity }}>
                <BigCheck size={150} />
              </motion.div>
            </>
          )}
        </HabitOrb>
      </motion.div>
      </motion.div>

      {!done && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              opacity: glow,
              background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)",
            }}
          />
          <svg viewBox="0 0 100 100" className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] -rotate-90 pointer-events-none" aria-hidden>
            <motion.circle cx="50" cy="50" r="48.5" fill="none" stroke="#f5a800" strokeWidth="1.6" strokeLinecap="round" style={{ pathLength: ring, opacity: ringOpacity }} />
          </svg>
        </>
      )}
    </motion.div>
  );
}
