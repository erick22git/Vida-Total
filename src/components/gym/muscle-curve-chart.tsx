"use client";

import { MONO_FONT } from "@/lib/ui/mono-font";

interface Entry {
  categoria: string;
  pct: number;
}

const W = 340;
const H = 170;
const PLOT_L = 16;
const PLOT_R = 290;
const PLOT_T = 34;
const PLOT_B = 150;
const MAX_GROUPS = 5;

/**
 * Gráfica de participación muscular: una campana por músculo (hasta 5, de mayor a menor participación)
 * cuya altura es su porcentaje de la rutina — las campanas se suman en una sola curva continua con
 * relleno, y el eje de la derecha marca el porcentaje. Los porcentajes vienen de
 * `muscleParticipation` (suman 100 entre todos los músculos de la rutina).
 */
export function MuscleCurveChart({ data }: { data: Entry[] }) {
  const groups = data.slice(0, MAX_GROUPS);
  if (groups.length === 0) return null;

  const maxPct = Math.max(...groups.map((g) => g.pct));
  const axisMax = Math.max(20, Math.ceil((maxPct + 4) / 10) * 10);
  const ticks = [axisMax, axisMax / 2, 0];
  const y = (p: number) => PLOT_B - (Math.min(axisMax, Math.max(0, p)) / axisMax) * (PLOT_B - PLOT_T);

  const step = (PLOT_R - PLOT_L) / groups.length;
  const xs = groups.map((_, i) => PLOT_L + step * (i + 0.5));
  const sigma = step * 0.27;

  const SAMPLES = 140;
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const x = PLOT_L + ((PLOT_R - PLOT_L) * i) / SAMPLES;
    const v = groups.reduce((sum, g, k) => sum + g.pct * Math.exp(-((x - xs[k]) ** 2) / (2 * sigma * sigma)), 0);
    return { x, y: y(v) };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${PLOT_R} ${PLOT_B} L ${PLOT_L} ${PLOT_B} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[clamp(90px,19dvh,170px)]" role="img" aria-label="Participación muscular">
      <defs>
        <linearGradient id="muscleFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--t-fg, #fff)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--t-fg, #fff)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {groups.map((g, i) => (
        <text
          key={g.categoria}
          x={xs[i]}
          y={11}
          textAnchor="middle"
          fill="var(--t-fg-dim, rgba(255,255,255,0.85))"
          fontSize="8"
          letterSpacing="0.4"
          style={MONO_FONT}
        >
          {g.categoria.toUpperCase()}
        </text>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PLOT_L}
            x2={PLOT_R}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--t-ring, rgba(255,255,255,0.28))"
            strokeWidth="1"
            strokeDasharray={t === 0 ? undefined : "1.5 3"}
          />
          <text x={W - 4} y={y(t) + 4} textAnchor="end" fill="var(--t-fg-dim, rgba(255,255,255,0.85))" fontSize="10" style={MONO_FONT}>
            {t}%
          </text>
        </g>
      ))}
      <path d={area} fill="url(#muscleFill)" />
      <path d={line} fill="none" stroke="var(--t-fg, #fff)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {groups.map((g, i) => (
        <g key={g.categoria + "pt"}>
          <circle cx={xs[i]} cy={y(g.pct)} r="3" fill="var(--t-fg, #fff)" />
          <text x={xs[i]} y={y(g.pct) - 8} textAnchor="middle" fill="var(--t-fg, #fff)" fontSize="10" fontWeight="700" style={MONO_FONT}>
            {g.pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}
