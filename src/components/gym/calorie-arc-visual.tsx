"use client";

import { useId } from "react";
import { ARC_GOAL_POS, arcSegments, CALORIE_COLORS, calorieState, STRONG_FACTOR } from "@/lib/gym/calorie-state";

/** Shared visual pieces for the calorie arc + macro breakdown, used by both
 * the full `CalorieArcCard` (página Calorías) and the compact mini version
 * shown on the Gym hub. Keeping them here means both places render from the
 * exact same markup/percentage math — nothing is recalculated twice. */

export const MACRO_COLORS = { proteina: "#22c55e", carbos: "#eab308", grasas: "#f97316" };

export function MacroColumn({
  label,
  value,
  goal,
  color,
  compact = false,
  note,
  noData = false,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  compact?: boolean;
  /** Texto corto bajo la barra (p. ej. "datos incompletos"). */
  note?: string;
  /** Ningún alimento trae dato: se muestra "sin dato" en vez de 0 y la barra queda vacía. */
  noData?: boolean;
}) {
  const pct = noData ? 0 : Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={compact ? "text-[9px] text-white/45" : "text-[11px] text-white/45"}>{label}</span>
      <span className={compact ? "text-[10px] font-medium text-white tabular-nums" : "text-xs font-medium text-white tabular-nums"}>
        {noData ? "sin dato" : Math.round(value)}
        {compact || noData ? "" : "g"}
      </span>
      <div className={compact ? "w-full h-1 rounded-full bg-white/[0.08] overflow-hidden" : "w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden"}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: note ? 0.45 : 1 }} />
      </div>
      {note && <span className="text-[8px] leading-none text-white/35 text-center">{note}</span>}
    </div>
  );
}

/** Arco de kcal — lee TODO de `calorieState` (src/lib/gym/calorie-state.ts): ni los umbrales ni los colores viven acá.
 * Curva "sonrisa" con dos marcadores: la META (100 %, con su número) y el 120 % (punto rojo, sin número) a partir del cual
 * la curva vibra y brilla. Los puntos se ubican sobre la misma Bézier cuadrática con la que se dibuja la curva.
 *  - hasta la meta: degradado amarillo → verde según el avance (progresivo);
 *  - pasada la meta: el resto de la curva se llena de rojo de inmediato, pero quieto;
 *  - desde el 120 %: además vibra (shake) y brilla (glow pulsante). */
export function ArcChart({
  goal,
  value,
  compact = false,
}: {
  goal: number;
  value: number;
  compact?: boolean;
}) {
  const gradId = useId();
  const P0 = { x: 20, y: 58 };
  const P1 = { x: 160, y: 18 };
  const P2 = { x: 300, y: 58 };
  const bezier = (t: number) => {
    const mt = 1 - t;
    return {
      x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
      y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
    };
  };
  const goalPoint = bezier(ARC_GOAL_POS);
  const strongPoint = bezier(ARC_GOAL_POS * STRONG_FACTOR);

  // Cada tramo se dibuja con `pathLength=1` (la longitud del path se normaliza a 1), así el dasharray queda en fracciones.
  const s = calorieState(value, goal);
  const { progress } = arcSegments(s.arcFraction);
  const pathD = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

  return (
    <svg viewBox="0 0 320 90" className="w-full h-auto overflow-visible">
      <defs>
        {/* x de la Bézier es lineal en t: el degradado por posición coincide con el avance a lo largo de la curva */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={P0.x} y1="0" x2={goalPoint.x} y2="0">
          <stop offset="0" stopColor={CALORIE_COLORS.bajo} />
          <stop offset="1" stopColor={CALORIE_COLORS.logrado} />
        </linearGradient>
      </defs>
      <g className={s.shake ? "calorie-arc-shake" : undefined}>
        {s.glow && (
          <path
            d={pathD}
            fill="none"
            stroke={CALORIE_COLORS.excedidoFuerte}
            strokeWidth={10}
            strokeLinecap="round"
            className="calorie-arc-glow"
            style={{ filter: "blur(6px)" }}
          />
        )}
        <path d={pathD} fill="none" stroke={CALORIE_COLORS.vacio} strokeWidth={2} strokeLinecap="round" />
        {/* Al pasar la meta TODO el tramo pintado se vuelve rojo de inmediato (no solo la punta): rojo quieto hasta 120 %. */}
        {progress > 0 && !s.over && (
          <path
            d={pathD}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${progress} 10`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        )}
        {s.over && (
          <path
            d={pathD}
            fill="none"
            stroke={CALORIE_COLORS.excedido}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${s.arcFraction} 10`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        )}
      </g>
      <circle cx={goalPoint.x} cy={goalPoint.y} r={4} fill="white" fillOpacity={0.85} />
      <circle cx={strongPoint.x} cy={strongPoint.y} r={3} fill={CALORIE_COLORS.excedido} fillOpacity={0.85} />
      {!compact && (
        <text x={goalPoint.x} y={goalPoint.y + 22} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.55)">
          {goal.toLocaleString()}
        </text>
      )}
    </svg>
  );
}

export interface CalorieTotals {
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

/** Compact "número + arco + macros" block, no edit/finish-day chrome — meant
 * to be dropped into a smaller container (e.g. the Gym hub card) while
 * sharing 100% of the arc/macro rendering logic with `CalorieArcCard`. */
export function CalorieArcMini({
  totals,
  calorieGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
}: {
  totals: CalorieTotals;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-xl font-bold text-white tabular-nums">{Math.round(totals.calorias).toLocaleString()}</span>
        <span className="text-[11px] text-white/35 tabular-nums">/ {calorieGoal.toLocaleString()} kcal</span>
      </div>

      <div className="w-3/5 mx-auto">
        <ArcChart goal={calorieGoal} value={totals.calorias} compact />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MacroColumn label="Prot" value={totals.proteina} goal={proteinGoal} color={MACRO_COLORS.proteina} compact />
        <MacroColumn label="Carbs" value={totals.carbos} goal={carbsGoal} color={MACRO_COLORS.carbos} compact />
        <MacroColumn label="Grasas" value={totals.grasas} goal={fatGoal} color={MACRO_COLORS.grasas} compact />
      </div>
    </div>
  );
}
