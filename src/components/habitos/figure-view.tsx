"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crystal3D } from "@/components/animations/Crystal3D";
import { ProgressiveScene } from "@/components/3d/ProgressiveScene";
import { FigureShelf } from "@/components/habitos/figure-shelf";
import { ViewDots } from "@/components/habitos/view-dots";
import { SceneCompletionCelebration, useSceneCompletionCelebration } from "@/components/3d/scene-completion-celebration";
import { haptic } from "@/lib/haptics/haptic";
import { playSound } from "@/lib/sound/sound-engine";
import { computeHabitLevel } from "@/lib/progress";
import { collectionChange, collectionStateFor } from "@/lib/3d/scene-collection";
import { figureConfigsFor, sceneFigures } from "@/lib/3d/scene-registry";
import { habitSceneCollection } from "@/lib/habits/habit-links";
import type { SceneStats } from "@/lib/3d/progressive-scene";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import type { Habit } from "@/lib/types/habits";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

/**
 * Vista FIGURA: la escena 3D que se construye con el progreso del hábito y la fila de figuras de la colección.
 *
 * Separa tres conceptos (ver `scene-collection.ts`): A) progreso del hábito (`total`, lo cuenta el store),
 * B) progreso de la figura (etapas construidas) y C) desbloqueo de figuras (secuencial). Este componente NO
 * calcula nada de eso: lo pide a `collectionStateFor` y le pasa la etapa a la escena. Cuando el hábito se
 * acaba de completar, la pantalla abre esta vista con `buildFromTotal` (repeticiones ANTES de completar)
 * para que se vea construirse la parte nueva.
 *
 * Los controles de depuración (figuras, días, celebración) existen SOLO en desarrollo.
 */
export function FigureView({ habit, buildFromTotal = null }: { habit: Habit; buildFromTotal?: number | null }) {
  // La categoría del hábito decide la colección de figuras (Hábitos o Gym); cada colección tiene su propio desbloqueo.
  const collectionId = habitSceneCollection(habit);
  const figures = useMemo(() => sceneFigures(collectionId), [collectionId]);
  const configs = useMemo(() => figureConfigsFor(collectionId), [collectionId]);
  const total = habit.completedDates.length;
  const reduceMotion = useEffectiveReduceMotion();
  const debug = process.env.NODE_ENV !== "production";

  // Total que se está mostrando. Al completar un hábito se muestra primero el estado anterior y, un instante
  // después, el nuevo (así la escena anima la etapa que acaba de desbloquearse).
  const [shownTotal, setShownTotal] = useState(buildFromTotal ?? total);
  const [debugActive, setDebugActive] = useState(false);
  useEffect(() => {
    if (debugActive || shownTotal === total) return;
    const t = setTimeout(() => setShownTotal(total), 450);
    return () => clearTimeout(t);
  }, [total, shownTotal, debugActive]);

  const collection = collectionStateFor(configs, shownTotal);
  // La figura que se está construyendo queda fija durante la secuencia (aunque la colección ya apunte a la siguiente).
  const [pinned] = useState<number | null>(() => (buildFromTotal !== null ? collectionStateFor(configs, buildFromTotal).currentIndex : null));
  const [picked, setPicked] = useState<number | null>(null);
  const selectedIndex = picked ?? pinned ?? collection.currentIndex;
  const asset = figures[selectedIndex];
  const fig = collection.figures[selectedIndex];
  const stageName = fig.stage > 0 ? asset.config.stages[fig.stage - 1]?.name : null;
  const level = computeHabitLevel(shownTotal);

  // ---- celebración de figura completada (componente reutilizable)
  const { banner, celebrateKey, justUnlocked, run: runCelebration } = useSceneCompletionCelebration(habit.id);
  const prevShown = useRef(shownTotal);

  useEffect(() => {
    const prev = prevShown.current;
    prevShown.current = shownTotal;
    if (shownTotal !== prev + 1) return;
    const ch = collectionChange(configs, prev, shownTotal);
    if (!ch.completedNow) return;
    const nextAsset = figures.find((s) => s.config.id === ch.unlockedFigureId);
    runCelebration(ch.figureId, figures[ch.figureIndex].name, ch.unlockedFigureId, nextAsset?.name ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTotal]);
  // ---- fila de figuras: solo las desbloqueadas se eligen; las bloqueadas tiemblan
  const [shake, setShake] = useState<{ index: number; n: number } | null>(null);
  function onLockedTap(index: number) {
    setShake((s) => ({ index, n: (s?.n ?? 0) + 1 }));
    haptic("light");
    playSound("error");
  }

  // ---- depuración (solo desarrollo)
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const offsets = configs.map((_, i) => configs.slice(0, i).reduce((a, c) => a + c.totalStages, 0));
  function debugSet(value: number, keepFigure = false) {
    setDebugActive(true);
    setPicked(keepFigure ? selectedIndex : null);
    setShownTotal(Math.max(0, Math.min(value, offsets[offsets.length - 1] + configs[configs.length - 1].totalStages)));
  }

  return (
    <div className="w-full h-full flex flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),20px)]">
      {/* Título: nombre de la figura y lo último construido (no "día n de 7") */}
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <span className="text-[13px] uppercase tracking-[0.18em] text-white/80" style={MONO}>
          {asset.name}
        </span>
        <span className="h-[18px] text-[10px] uppercase tracking-[0.16em] text-white/40" style={MONO}>
          {fig.status === "complete" ? "Completado" : (stageName ?? "Sin empezar")}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center w-full">
        <ProgressiveScene
          key={asset.config.id}
          asset={asset}
          stage={fig.stage}
          reduceMotion={reduceMotion}
          replayKey={replayKey}
          celebrateKey={celebrateKey}
          onTap={() => haptic("light")}
          className="w-full aspect-square max-w-[440px]"
          onStats={debug ? setStats : undefined}
          fallback={<Crystal3D size={240} level={Math.min(fig.stage, 6)} inLevel={0} burst={false} reduceMotion={reduceMotion} fallbackState={fig.stage >= fig.totalStages ? "complete" : fig.stage > 3 ? "progress-75" : fig.stage > 0 ? "progress-25" : "idle"} />}
        />
        <SceneCompletionCelebration banner={banner} reduceMotion={reduceMotion} />
      </div>

      <div className="w-full flex flex-col items-center gap-3">
        {/* Los 7 días, muy sutiles (no se tocan) */}
        <div className="flex items-center gap-2 pointer-events-none" aria-hidden>
          {Array.from({ length: fig.totalStages }, (_, i) => (
            <span
              key={i}
              className="w-[5px] h-[5px] rounded-full transition-colors duration-500"
              style={{ background: i < fig.stage ? "#f5b301" : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>

        {/* Contador del hábito */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[15px] tabular-nums text-white/90" style={MONO}>
            {Math.min(level.total, level.goal)} / {level.goal}
          </span>
          <div className="h-[3px] w-28 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${level.fraction * 100}%`, background: "#f5b301", transition: "width .5s ease" }} />
          </div>
        </div>

        {/* Fila de figuras + puntos de vista */}
        <div className="w-full relative pt-1">
          <FigureShelf
            figures={collection.figures}
            icons={figures.map((s) => s.icon)}
            names={figures.map((s) => s.name)}
            selectedIndex={selectedIndex}
            onSelect={(i) => setPicked(i)}
            onLockedTap={onLockedTap}
            shake={shake}
            justUnlockedId={justUnlocked}
          />
          <div className="absolute right-0 top-1">
            <ViewDots index={2} />
          </div>
        </div>

        {debug && (
          <div className="mt-1 w-full max-w-[420px] flex flex-col items-center gap-1.5 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/45" style={MONO}>
              debug 3d · {collectionId} · solo desarrollo
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              <DebugBtn active={!debugActive} onClick={() => { setDebugActive(false); setPicked(null); setShownTotal(total); }}>real</DebugBtn>
              {configs.map((c, i) => (
                <DebugBtn key={c.id} active={debugActive && collection.currentIndex === i} onClick={() => debugSet(offsets[i])}>F{i + 1}</DebugBtn>
              ))}
              <DebugBtn onClick={() => debugSet(shownTotal - 1, true)}>−1</DebugBtn>
              <DebugBtn onClick={() => debugSet(shownTotal + 1, true)}>+1</DebugBtn>
              <DebugBtn onClick={() => debugSet(offsets[selectedIndex] + fig.totalStages - 1, true)}>día 6</DebugBtn>
              <DebugBtn onClick={() => debugSet(offsets[selectedIndex] + fig.totalStages, true)}>día 7</DebugBtn>
              <DebugBtn onClick={() => debugSet(0)}>0</DebugBtn>
              <DebugBtn onClick={() => debugSet(offsets[offsets.length - 1] + configs[configs.length - 1].totalStages)}>todo</DebugBtn>
              <DebugBtn onClick={() => setReplayKey((k) => k + 1)}>↻</DebugBtn>
              <DebugBtn
                onClick={() => {
                  const next = figures[selectedIndex + 1];
                  runCelebration(asset.config.id, asset.name, next?.config.id ?? null, next?.name ?? null);
                }}
              >
                🎉
              </DebugBtn>
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {Array.from({ length: fig.totalStages + 1 }, (_, d) => (
                <DebugBtn key={d} active={debugActive && fig.stage === d} onClick={() => debugSet(offsets[selectedIndex] + d, true)}>{d}</DebugBtn>
              ))}
            </div>
            {stats && (
              <span className="text-[10px] text-white/40" style={MONO}>
                {stats.drawCalls} draw calls · {Math.round(stats.triangles / 1000)}k tris · figura {selectedIndex + 1} · día {fig.stage}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DebugBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="h-7 min-w-7 px-1.5 rounded-md text-[11px] cursor-pointer"
      style={{ ...MONO, background: active ? "#f5b301" : "rgba(255,255,255,0.1)", color: active ? "#000" : "#fff" }}
    >
      {children}
    </button>
  );
}
