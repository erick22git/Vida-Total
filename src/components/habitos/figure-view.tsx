"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crystal3D } from "@/components/animations/Crystal3D";
import type { CrystalState } from "@/components/animations/ProgressCrystal";
import { ProgressiveScene } from "@/components/3d/ProgressiveScene";
import { ViewDots } from "@/components/habitos/view-dots";
import { computeStreak } from "@/lib/progress";
import { sceneStateFor } from "@/lib/3d/scene-progression";
import { getSceneAsset } from "@/lib/3d/scene-registry";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import type { SceneStats } from "@/lib/3d/progressive-scene";
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
 * Vista FIGURA: la escena 3D que se construye con el progreso del hábito (hoy, el Bosque de 7 días).
 *
 * Este componente NO calcula progreso: lee las repeticiones del hábito, le pide a `SceneProgression`
 * en qué etapa está y le pasa esa etapa a la escena. Cuando el hábito se acaba de completar, la
 * pantalla de Hábitos abre esta vista con `buildFrom` (la etapa anterior) para que se vea construirse
 * la parte nueva.
 *
 * Depuración (solo con `?debug3d=1` o en desarrollo): botones para probar el día 0..N sin completar
 * hábitos reales. No cambia ningún dato del hábito.
 */
export function FigureView({ habit, buildFrom = null }: { habit: Habit; buildFrom?: number | null }) {
  const asset = getSceneAsset();
  const total = habit.completedDates.length;
  const state = sceneStateFor(asset.config, total);
  const streak = computeStreak({ completedDates: habit.completedDates, frequency: habit.frequency });
  const reduceMotion = useEffectiveReduceMotion();
  const params = useSearchParams();
  const debug = params.get("debug3d") === "1" || process.env.NODE_ENV !== "production";

  // Si venimos de completar un día: primero se muestra la etapa anterior y, un instante después, la nueva.
  const [built, setBuilt] = useState(buildFrom === null);
  useEffect(() => {
    if (built) return;
    const t = setTimeout(() => setBuilt(true), 450);
    return () => clearTimeout(t);
  }, [built]);

  const [debugStage, setDebugStage] = useState<number | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [stats, setStats] = useState<SceneStats | null>(null);

  const shownStage = debugStage ?? (built ? state.stage : (buildFrom ?? 0));
  const stageInfo = asset.config.stages.find((s) => s.stage === shownStage);

  return (
    <div className="w-full h-full flex flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
      <div className="mt-2 flex flex-col items-center gap-2">
        <span className="text-[13px] uppercase tracking-[0.14em] text-white/60" style={MONO}>
          Día {shownStage} de {state.totalStages}
        </span>
        <span
          className="px-5 py-1 text-[13px] font-bold uppercase tracking-[0.16em] text-black rounded-sm"
          style={{ ...MONO, background: "#f5b301" }}
        >
          {shownStage === 0 ? "Sin empezar" : (stageInfo?.name ?? "")}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center w-full">
        <ProgressiveScene
          asset={asset}
          stage={shownStage}
          reduceMotion={reduceMotion}
          replayKey={replayKey}
          className="w-full aspect-square max-w-[420px]"
          onStats={debug ? setStats : undefined}
          fallback={
            <Crystal3D
              size={260}
              level={Math.floor(state.fraction * 6)}
              inLevel={(state.fraction * 6) % 1}
              burst={false}
              reduceMotion={reduceMotion}
              fallbackState={crystalStateFor(state.fraction)}
            />
          }
        />
      </div>

      <div className="w-full flex flex-col items-center gap-3">
        <span className="text-[15px] tabular-nums text-white/90" style={MONO}>
          {shownStage} / {state.totalStages}
        </span>
        <div className="flex items-center gap-2 w-full justify-center relative">
          {asset.config.stages.map((s) => (
            <span
              key={s.stage}
              className="h-[3px] w-8 rounded-full transition-colors"
              style={{ background: s.stage <= shownStage ? "#f5b301" : "rgba(255,255,255,0.18)" }}
            />
          ))}
          <div className="absolute right-0 -top-1">
            <ViewDots index={2} />
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/40" style={MONO}>
          Racha {streak} {streak === 1 ? "día" : "días"}
        </span>

        {debug && (
          <div className="mt-1 flex flex-col items-center gap-1.5 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/45" style={MONO}>
              debug 3d · día
            </span>
            <div className="flex gap-1">
              {[null, ...Array.from({ length: state.totalStages + 1 }, (_, i) => i)].map((d) => {
                const active = debugStage === d;
                return (
                  <button
                    key={String(d)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setDebugStage(d)}
                    className="h-7 min-w-7 px-1.5 rounded-md text-[11px] cursor-pointer"
                    style={{ ...MONO, background: active ? "#f5b301" : "rgba(255,255,255,0.1)", color: active ? "#000" : "#fff" }}
                  >
                    {d === null ? "real" : d}
                  </button>
                );
              })}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setReplayKey((k) => k + 1)}
                className="h-7 px-2 rounded-md text-[11px] cursor-pointer bg-white/10 text-white"
                style={MONO}
              >
                ↻
              </button>
            </div>
            {stats && (
              <span className="text-[10px] text-white/40" style={MONO}>
                {stats.drawCalls} draw calls · {Math.round(stats.triangles / 1000)}k tris
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
