"use client";

import { useEffect, useRef } from "react";
import { WaterGlassRenderer } from "@/lib/3d/water-glass";

/**
 * Vaso 3D con nivel de agua en vivo. Recibe la fracción YA calculada (src/lib/gym/water-state.ts) y el color del agua;
 * no sabe de ml ni de metas. Si WebGL o el GLB fallan avisa por `onError` para que la pantalla muestre la botella SVG.
 */
export function WaterGlass3D({
  fraction,
  color,
  onError,
  className,
}: {
  fraction: number;
  color?: string;
  onError?: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WaterGlassRenderer | null>(null);
  const latest = useRef({ fraction, color });
  const errRef = useRef(onError);
  useEffect(() => {
    latest.current = { fraction, color };
    errRef.current = onError;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let r: WaterGlassRenderer | null = null;
    try {
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      r = new WaterGlassRenderer(el, { glbUrl: "/models/water_glass_001_meshopt.glb", reduceMotion: !!reduce });
      rendererRef.current = r;
      r.load()
        .then(() => {
          if (cancelled || !r) return;
          if (latest.current.color) r.setColor(latest.current.color);
          r.setFraction(latest.current.fraction);
          r.start();
          (window as unknown as { __waterGlass?: WaterGlassRenderer }).__waterGlass = r;
        })
        .catch(() => {
          if (!cancelled) errRef.current?.();
        });
    } catch {
      errRef.current?.();
    }
    return () => {
      cancelled = true;
      r?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setFraction(fraction);
  }, [fraction]);
  useEffect(() => {
    if (color) rendererRef.current?.setColor(color);
  }, [color]);

  return <div ref={host} className={className ?? "w-64 h-80 mx-auto"} data-testid="water-glass-3d" aria-label={`Vaso de agua al ${Math.round(fraction * 100)} %`} role="img" />;
}
