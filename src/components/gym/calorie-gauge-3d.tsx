"use client";

import { useEffect, useRef, useState } from "react";
import { CalorieGaugeRenderer } from "@/lib/3d/calorie-gauge";
import { GAUGES, type GaugeKind } from "@/lib/3d/gauge-registry";
import { CALORIE_COLORS, type CalorieState } from "@/lib/gym/calorie-state";
import { ArcChart } from "@/components/gym/calorie-arc-visual";

/**
 * Gráfico 3D de calorías. Recibe el `CalorieState` YA calculado (calorie-state.ts) y solo lo muestra. La vibración y el halo rojo pulsante
 * son las MISMAS clases del arco (`calorie-arc-shake` / `calorie-arc-glow`, globals.css): entre 100 % y 120 % es rojo pero quieto; desde
 * 120 % vibra y brilla. Si WebGL o el modelo fallan se muestra el arco (código).
 */
export function CalorieGauge3D({ kind, state, className }: { kind: GaugeKind; state: CalorieState; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CalorieGaugeRenderer | null>(null);
  const latest = useRef(state);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    latest.current = state;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let r: CalorieGaugeRenderer | null = null;
    try {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      r = new CalorieGaugeRenderer(el, { kind, glbUrl: GAUGES[kind].glbUrl, reduceMotion: !!reduce });
      rendererRef.current = r;
      r.load()
        .then(() => {
          if (cancelled || !r) return;
          r.setState(latest.current);
          r.start();
          (window as unknown as { __calorieGauge?: CalorieGaugeRenderer }).__calorieGauge = r;
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    } catch {
      // WebGL no disponible: se cae al arco sin romper la pantalla
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      cancelled = true;
      r?.dispose();
      rendererRef.current = null;
    };
  }, [kind]);

  useEffect(() => {
    rendererRef.current?.setState(state);
  }, [state]);

  if (failed) return <ArcChart goal={state.goal} value={state.kcal} />;

  return (
    <div className={`relative ${className ?? "w-full h-72"}`}>
      {state.glow && (
        <div
          aria-hidden
          className="calorie-arc-glow absolute inset-x-[15%] inset-y-[10%] rounded-full pointer-events-none"
          style={{ background: CALORIE_COLORS.excedidoFuerte, filter: "blur(38px)" }}
        />
      )}
      <div ref={host} className={`relative w-full h-full ${state.shake ? "calorie-arc-shake" : ""}`} data-testid="calorie-gauge-3d" data-gauge={kind} role="img" aria-label={`${GAUGES[kind].name}: ${Math.round(state.percentOfGoal * 100)} % de la meta`} />
    </div>
  );
}
