"use client";

/**
 * Círculo de una comida en la home de Calorías. Mismo gesto que el check de Hábitos (`HoldCircle`):
 *   - toque corto → el "+" lleva a buscar para agregar (`onTap`), con una animación de presión (se achica
 *     un poco al tocar) para que se sienta como un botón real;
 *   - mantener presionado 2 s → un anillo se va cerrando y, al completarse, el círculo pasa a BLANCO
 *     mostrando las kcal de la comida; unos segundos después vuelve al "+" para seguir agregando.
 *   - `autoReveal`: al volver de agregar un alimento se dispara la MISMA revelación sola (sin que el
 *     usuario tenga que mantener presionado) — cambia a un número distinto para retriggerearla.
 * El color de fondo lo decide `passed`: blanco si ya pasó el horario de esa comida (desayuno a la 1 pm),
 * negro si es la comida actual o una futura. Eso no cambia nada del comportamiento: se sigue pudiendo agregar.
 */
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from "framer-motion";
import { Plus } from "lucide-react";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { MONO_FONT } from "@/lib/ui/mono-font";

const HOLD_MS = 2000;
const REVEAL_MS = 2600;
const MOVE_CANCEL_PX = 10;

export function MealHoldOrb({
  passed,
  canAdd,
  kcal,
  foodCount,
  label,
  onTap,
  autoReveal,
}: {
  passed: boolean;
  canAdd: boolean;
  kcal: number;
  foodCount: number;
  label: string;
  onTap: () => void;
  /** Cambiá este número para disparar la revelación de kcal sin mantener presionado (ver arriba). */
  autoReveal?: number;
}) {
  const progress = useMotionValue(0);
  const pressScale = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const pressAnim = useRef<AnimationPlaybackControls | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const completed = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revealed, setRevealed] = useState(false);

  const scale = useTransform([progress, pressScale], (v) => (1 - (v[0] as number) * 0.06) * (v[1] as number));
  const glow = useTransform(progress, [0, 1], [0, 0.5]);
  const ringOpacity = useTransform(progress, [0, 0.02], [0, 1]);

  useEffect(
    () => () => {
      anim.current?.stop();
      pressAnim.current?.stop();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  // Revelación automática (al volver de agregar un alimento) — misma cara blanca con kcal que la del hold manual.
  // El setState va en un setTimeout(0): llamarlo directo en el cuerpo del efecto dispara el lint
  // react-hooks/set-state-in-effect (cascading renders).
  useEffect(() => {
    if (autoReveal == null) return;
    const id = setTimeout(() => {
      setRevealed(true);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealed(false), REVEAL_MS);
    }, 0);
    return () => clearTimeout(id);
  }, [autoReveal]);

  function resetRing(duration: number) {
    anim.current?.stop();
    anim.current = animate(progress, 0, { duration, ease: "easeOut" });
  }
  function press(down: boolean) {
    pressAnim.current?.stop();
    pressAnim.current = animate(pressScale, down ? 0.92 : 1, { duration: down ? 0.12 : 0.18, ease: "easeOut" });
  }

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    if (e.button > 0 || start.current) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    completed.current = false;
    press(true);
    anim.current?.stop();
    anim.current = animate(progress, 1, {
      duration: HOLD_MS / 1000,
      ease: "linear",
      onComplete: () => {
        completed.current = true;
        setRevealed(true);
        if (revealTimer.current) clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(() => setRevealed(false), REVEAL_MS);
        resetRing(0.35);
      },
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    e.stopPropagation();
    if (!start.current || moved.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_CANCEL_PX) {
      moved.current = true;
      anim.current?.stop();
      resetRing(0.25);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (!start.current) return;
    const wasTap = !completed.current && !moved.current;
    start.current = null;
    press(false);
    if (!completed.current) {
      anim.current?.stop();
      resetRing(0.25);
    }
    if (wasTap && canAdd) onTap();
  }

  function cancel(e: React.PointerEvent) {
    e.stopPropagation();
    if (!start.current) return;
    start.current = null;
    press(false);
    anim.current?.stop();
    resetRing(0.25);
  }

  const white = passed || revealed;

  return (
    <motion.div
      className="relative w-[68vw] max-w-[340px] aspect-square select-none cursor-pointer"
      style={{ scale, WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && canAdd) onTap();
      }}
      aria-label={canAdd ? `Agregar a ${label} (mantén presionado para ver las kcal)` : `${label}: mantén presionado para ver las kcal`}
    >
      <HabitOrb done={white} className="w-full">
        {revealed ? (
          <div className="flex flex-col items-center gap-1 px-6">
            <span className="text-4xl">🍽️</span>
            <span className="text-2xl font-bold text-black tabular-nums">{Math.round(kcal)} kcal</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-black/50" style={MONO_FONT}>
              {foodCount === 0 ? "sin alimentos" : `${foodCount} ${foodCount === 1 ? "alimento" : "alimentos"}`}
            </span>
          </div>
        ) : (
          <Plus
            size={64}
            strokeWidth={2}
            className={passed ? (canAdd ? "text-black/60" : "text-black/25") : canAdd ? "text-white/70" : "text-white/25"}
          />
        )}
      </HabitOrb>
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          opacity: glow,
          background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] -rotate-90 pointer-events-none"
        aria-hidden
      >
        <motion.circle
          cx="50"
          cy="50"
          r="48.5"
          fill="none"
          stroke="#f5a800"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ pathLength: progress, opacity: ringOpacity }}
        />
      </svg>
    </motion.div>
  );
}
