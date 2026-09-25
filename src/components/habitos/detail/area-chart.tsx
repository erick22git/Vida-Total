"use client";

import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const W = 340;
const H = 150;
const LEFT = 34;
const RIGHT = 8;
const TOP = 8;
const BOTTOM = 24;

function niceStep(max: number): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  return steps.find((s) => s * 3 >= max) ?? 1000;
}

/** Gráfica de área acumulada (repeticiones totales en el tiempo). */
export function AreaChart({ series, today }: { series: number[]; today: Date }) {
  const days = series.length;
  const step = niceStep(Math.max(...series, 1));
  const top = step * 3;
  const innerW = W - LEFT - RIGHT;
  const innerH = H - TOP - BOTTOM;
  const x = (i: number) => LEFT + (i / Math.max(days - 1, 1)) * innerW;
  const y = (v: number) => TOP + innerH - (v / top) * innerH;

  const line = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(days - 1).toFixed(1)},${(TOP + innerH).toFixed(1)} L${x(0).toFixed(1)},${(TOP + innerH).toFixed(1)} Z`;

  const start = addDays(today, -(days - 1));
  const monthLabels: { i: number; label: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    if (d.getDate() === 1) monthLabels.push({ i, label: format(d, "MMM", { locale: es }).replace(".", "").toUpperCase() });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Repeticiones acumuladas">
      <defs>
        <linearGradient id="habitAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5b301" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f5b301" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {[1, 2, 3].map((n) => (
        <g key={n}>
          <line x1={LEFT} x2={W - RIGHT} y1={y(step * n)} y2={y(step * n)} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <text x={LEFT - 6} y={y(step * n) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.6)" style={MONO}>
            {step * n}
          </text>
        </g>
      ))}
      <line x1={LEFT} x2={W - RIGHT} y1={TOP + innerH} y2={TOP + innerH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <path d={area} fill="url(#habitAreaFill)" />
      <path d={line} fill="none" stroke="#f5b301" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {monthLabels.map((m) => (
        <text key={m.i} x={x(m.i)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.65)" style={MONO}>
          {m.label}
        </text>
      ))}
    </svg>
  );
}
