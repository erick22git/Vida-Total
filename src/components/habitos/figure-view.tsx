"use client";

import { useEffect, useRef, useState } from "react";
import type { CrystalState } from "@/components/animations/ProgressCrystal";
import { Crystal3D } from "@/components/animations/Crystal3D";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import { ViewDots } from "@/components/habitos/view-dots";
import { useAnimationEvent } from "@/lib/animations/use-animation-engine";
import { LEVEL_MAX, LEVEL_STEP, computeHabitLevel, computeStreak } from "@/lib/progress";
import type { Habit } from "@/lib/types/habits";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

function crystalStateFor(fraction: number): CrystalState {
  if (fraction >= 1) return "complete";
  if (fraction >= 0.67) return "progress-75";
  if (fraction >= 0.34) return "progress-50";
  if (fraction > 0) return "progress-25";
  return "idle";
}

/**
 * Vista FIGURA / PROGRESO: la evolución del hábito. El objeto es un cristal
 * 3D hecho con código (`Crystal3D`, React Three Fiber) que se arma pieza a
 * pieza; el punto de reemplazo por el modelo de Blender (GLB) es
 * `CrystalScene.tsx` — nada más cambia.
 * Muestra repeticiones / meta, nivel, hitos y la racha como dato secundario.
 */
export function FigureView({ habit }: { habit: Habit }) {
  const info = computeHabitLevel(habit.completedDates.length);
  const streak = computeStreak({ completedDates: habit.completedDates, frequency: habit.frequency });
  const reduceMotion = useEffectiveReduceMotion();
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al alcanzar un hito el cristal pasa un momento por el estado "milestone".
  useAnimationEvent((e) => {
    if ((e.type === "habit.milestone" || e.type === "habit.levelUp") && e.entityId === habit.id) {
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 1800);
    }
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const state: CrystalState = flash ? "milestone" : crystalStateFor(info.fraction);

  return (
    <div className="w-full h-full flex flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
      <div className="mt-2 flex flex-col items-center gap-2">
        <span className="text-[13px] uppercase tracking-[0.14em] text-white/60" style={MONO}>
          {info.mastered ? "Dominado" : `Nivel ${info.level + 1}`}
        </span>
        <span
          className="px-5 py-1 text-[13px] font-bold uppercase tracking-[0.16em] text-black rounded-sm"
          style={{ ...MONO, background: "#f5b301" }}
        >
          {info.mastered ? "Master" : info.level === 0 ? "Inicio" : `Hito ${info.level * LEVEL_STEP}`}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center w-full">
        <Crystal3D
          size={300}
          level={info.level}
          inLevel={info.mastered ? 1 : (info.total % LEVEL_STEP) / LEVEL_STEP}
          burst={flash}
          reduceMotion={reduceMotion}
          fallbackState={state}
        />
      </div>

      <div className="w-full flex flex-col items-center gap-3">
        <span className="text-[15px] tabular-nums text-white/90" style={MONO}>
          {info.total} / {info.goal}
        </span>
        <div className="h-[3px] w-28 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${info.fraction * 100}%`, background: "#f5b301", transition: "width .5s ease" }} />
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 w-full relative">
          {Array.from({ length: LEVEL_MAX }, (_, i) => {
            const reached = info.level > i;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
                  <polygon
                    points="12,2 21,7 21,17 12,22 3,17 3,7"
                    fill={reached ? "#f5b301" : "none"}
                    stroke={reached ? "#f5b301" : "rgba(255,255,255,0.35)"}
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="text-[10px] text-white/45" style={MONO}>
                  {(i + 1) * LEVEL_STEP}
                </span>
              </div>
            );
          })}
          <div className="absolute right-0 top-1">
            <ViewDots index={2} />
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/40" style={MONO}>
          Racha {streak} {streak === 1 ? "día" : "días"}
        </span>
      </div>
    </div>
  );
}
