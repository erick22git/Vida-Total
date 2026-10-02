"use client";

import { MONO_FONT } from "@/lib/ui/mono-font";

interface Entry {
  categoria: string;
  pct: number;
}

const W = 340;
const H = 112;
const PLOT_L = 14;
const PLOT_R = 292;
const PLOT_T = 26;
const PLOT_B = 98;

/** Curva suave que pasa por los puntos (Catmull-Rom -> Bézier cúbica). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Gráfica de distribución muscular: un pico por grupo (hasta 4), con su altura = su porcentaje del
 * entrenamiento, y el eje de porcentajes a la derecha. Los porcentajes salen de las series de cada
 * ejercicio (`getMuscleDistribution`), no de ningún dato inventado. */
export function MuscleCurveChart({ data }: { data: Entry[] }) {
  const groups = data.slice(0, 4);
  if (groups.length === 0) return null;

  const maxPct = Math.max(...groups.map((g) => g.pct));
  const axisMax = Math.max(30, Math.ceil((maxPct + 3) / 10) * 10);
  const axisMin = axisMax - 20;
  const ticks = [axisMax, axisMax - 10, axisMin];
  const y = (p: number) => {
    const t = (Math.min(axisMax, Math.max(axisMin, p)) - axisMin) / (axisMax - axisMin);
    return PLOT_B - t * (PLOT_B - PLOT_T);
  };

  const step = (PLOT_R - PLOT_L) / groups.length;
  const xs = groups.map((_, i) => PLOT_L + step * (i + 0.5));
  const pts: { x: number; y: number }[] = [{ x: PLOT_L, y: y(axisMin) }];
  groups.forEach((g, i) => {
    pts.push({ x: xs[i], y: y(g.pct) });
    pts.push({ x: xs[i] + step / 2, y: y(axisMin) });
  });
  pts[pts.length - 1] = { x: PLOT_R, y: y(axisMin) };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[clamp(70px,14dvh,112px)]" role="img" aria-label="Distribución muscular">
      {groups.map((g, i) => (
        <text key={g.categoria} x={xs[i]} y={9} textAnchor="middle" fill="var(--t-fg-dim, rgba(255,255,255,0.85))" fontSize="8" letterSpacing="0.6" style={MONO_FONT}>
          {g.categoria.toUpperCase()}
        </text>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PLOT_L} x2={PLOT_R} y1={y(t)} y2={y(t)} stroke="var(--t-ring, rgba(255,255,255,0.28))" strokeWidth="1" strokeDasharray="1.5 3" />
          <text x={W - 4} y={y(t) + 4} textAnchor="end" fill="var(--t-fg-dim, rgba(255,255,255,0.85))" fontSize="9" style={MONO_FONT}>
            {t}%
          </text>
        </g>
      ))}
      <path d={smoothPath(pts)} fill="none" stroke="var(--t-fg, #fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {groups.map((g, i) => (
        <g key={g.categoria + "pt"}>
          <circle cx={xs[i]} cy={y(g.pct)} r="2.6" fill="var(--t-fg, #fff)" />
          <text x={xs[i]} y={y(g.pct) - 6} textAnchor="middle" fill="var(--t-fg, #fff)" fontSize="8.5" style={MONO_FONT}>
            {g.pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}
