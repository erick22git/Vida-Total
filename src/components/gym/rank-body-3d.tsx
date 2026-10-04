"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { RankBodyRenderer, type RegionStyle } from "@/lib/3d/rank-body";

export interface RankBodyHandle {
  /** Gira el cuerpo (radianes). Math.PI = dar la vuelta. */
  rotateBy: (delta: number) => void;
}

/**
 * Cuerpo 3D de Rango. Recibe los estilos por región YA calculados (color del rango de cada músculo), la región elegida y el
 * encuadre (qué regiones mostrar grandes y hacia dónde mirar). Si WebGL o el GLB fallan avisa por `onError` para que la
 * pantalla muestre la lista de grupos.
 */
export function RankBody3D({
  styles,
  selected,
  focusRegions,
  yaw,
  onPick,
  onError,
  className,
  ref,
}: {
  styles: Record<string, RegionStyle | undefined>;
  selected: string | null;
  /** null = cuerpo completo. */
  focusRegions: string[] | null;
  yaw: number;
  onPick?: (region: string | null) => void;
  onError?: () => void;
  className?: string;
  ref?: Ref<RankBodyHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RankBodyRenderer | null>(null);
  const latest = useRef({ styles, selected, focusRegions, yaw });
  const cbs = useRef({ onPick, onError });
  useEffect(() => {
    latest.current = { styles, selected, focusRegions, yaw };
    cbs.current = { onPick, onError };
  });

  useImperativeHandle(ref, () => ({ rotateBy: (d: number) => rendererRef.current?.rotateBy(d) }), []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let r: RankBodyRenderer | null = null;
    try {
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      r = new RankBodyRenderer(el, { glbUrl: "/models/rango_cuerpo_m_001_meshopt.glb", reduceMotion: !!reduce });
      rendererRef.current = r;
      r.onPick((region) => cbs.current.onPick?.(region));
      r.load()
        .then(() => {
          if (cancelled || !r) return;
          const l = latest.current;
          r.setRegionStyles(l.styles);
          r.focus(l.focusRegions, l.yaw, false);
          r.setSelected(l.selected);
          r.start();
        })
        .catch(() => {
          if (!cancelled) cbs.current.onError?.();
        });
    } catch {
      cbs.current.onError?.();
    }
    return () => {
      cancelled = true;
      r?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setRegionStyles(styles);
  }, [styles]);
  useEffect(() => {
    rendererRef.current?.setSelected(selected);
  }, [selected]);
  const focusKey = focusRegions ? focusRegions.join(",") : "";
  useEffect(() => {
    rendererRef.current?.focus(latest.current.focusRegions, latest.current.yaw, true);
  }, [focusKey, yaw]);

  return <div ref={host} className={className ?? "w-full h-full"} data-testid="rank-body-3d" role="img" aria-label="Cuerpo con tus rangos por músculo" />;
}
