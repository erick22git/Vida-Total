"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProgressiveSceneRenderer, type SceneStats } from "@/lib/3d/progressive-scene";
import type { SceneAssetDef } from "@/lib/3d/scene-registry";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Muestra una escena progresiva (GLB) en la etapa `stage`. Solo RECIBE estado: no calcula progreso
 * ni sabe de hábitos. Cuando `stage` sube, la escena construye la etapa nueva con su animación;
 * cuando baja, oculta sin ceremonia. Fondo transparente. Si no hay WebGL o el GLB no carga
 * (p. ej. no está publicado), muestra `fallback`.
 */
export function ProgressiveScene({
  asset,
  stage,
  reduceMotion,
  replayKey = 0,
  className,
  fallback,
  onStats,
}: {
  asset: SceneAssetDef;
  stage: number;
  reduceMotion: boolean;
  /** Al cambiar, vuelve a reproducir la construcción de `stage` (uso de desarrollo). */
  replayKey?: number;
  className?: string;
  fallback: ReactNode;
  onStats?: (s: SceneStats) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ProgressiveSceneRenderer | null>(null);
  const stageRef = useRef(stage);
  const onStatsRef = useRef(onStats);
  const [supported] = useState(webglAvailable);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    stageRef.current = stage;
    onStatsRef.current = onStats;
  });

  // Crear el renderer una sola vez.
  useEffect(() => {
    const el = host.current;
    if (!el || !supported) return;
    let cancelled = false;
    let statsTimer: ReturnType<typeof setInterval> | undefined;
    let r: ProgressiveSceneRenderer;
    try {
      r = new ProgressiveSceneRenderer(el, asset, { reduceMotion });
    } catch {
      Promise.resolve().then(() => !cancelled && setStatus("error"));
      return;
    }
    rendererRef.current = r;

    r.load()
      .then(() => {
        if (cancelled) return;
        r.setStage(stageRef.current, { animate: false });
        r.start();
        setStatus("ready");
        // Métricas reales (draw calls / triángulos) para depuración: solo si alguien las pidió.
        if (onStatsRef.current) statsTimer = setInterval(() => onStatsRef.current?.(r.stats()), 1000);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    const ro = new ResizeObserver(() => r.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    // No gastar batería si la figura no se ve.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) r.start();
      else r.pause();
    });
    io.observe(el);
    const onVis = () => (document.hidden ? r.pause() : r.start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (statsTimer) clearInterval(statsTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      r.dispose();
      rendererRef.current = null;
    };
    // El renderer se crea una vez por escena; `stage` y `reduceMotion` se aplican aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, supported]);

  // Cambios de etapa (la primera carga se aplica sin animación en `load().then`).
  useEffect(() => {
    if (status === "ready") rendererRef.current?.setStage(stage);
  }, [stage, status]);

  // Repetición manual (depuración).
  useEffect(() => {
    if (replayKey > 0 && status === "ready") {
      const r = rendererRef.current;
      r?.setStage(Math.max(stageRef.current - 1, 0), { animate: false });
      r?.setStage(stageRef.current);
    }
  }, [replayKey, status]);

  if (!supported || status === "error") return <>{fallback}</>;
  return <div ref={host} className={className} aria-label="Figura 3D del progreso" role="img" />;
}
