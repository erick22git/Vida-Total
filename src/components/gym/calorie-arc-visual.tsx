"use client";

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
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  compact?: boolean;
}) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={compact ? "text-[9px] text-white/45" : "text-[11px] text-white/45"}>{label}</span>
      <span className={compact ? "text-[10px] font-medium text-white tabular-nums" : "text-xs font-medium text-white tabular-nums"}>
        {Math.round(value)}
        {compact ? "" : "g"}
      </span>
      <div className={compact ? "w-full h-1 rounded-full bg-white/[0.08] overflow-hidden" : "w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden"}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Bloque 12: plomo mientras no se anotó nada, amarillo mientras el consumo
 * del día no llega al mínimo del rango objetivo, verde dentro del rango,
 * rojo al superar el máximo. `low`/`high` ya vienen de
 * `calorieGoal * 0.9/1.1` (ver calorie-arc-card.tsx / CalorieArcMini) —
 * nunca hardcodeados acá. */
const RANGE_COLORS = {
  vacio: "#6b7280", // plomo — todavía no anotó nada en ese tramo de la curva
  bajo: "#eab308", // amarillo — todavía no llega al mínimo
  enRango: "#22c55e", // verde — dentro del rango objetivo
  sobre: "#ef4444", // rojo — superó el máximo
};

/** Fracción [0,1] de la curva que debe pintarse, de izquierda (0 kcal) a
 * derecha, según el consumo acumulado. La punta izquierda de la curva
 * (t=0) es 0 kcal; los dos marcadores sobre la curva (t=0.3 y t=0.7, ver
 * `pointA`/`pointB` en `ArcChart`) representan `low` y `high`. Más allá de
 * `high` se sigue llenando de rojo hasta un techo (`high` + el ancho del
 * rango bueno) — pasado ese techo la curva queda completamente roja. */
function calorieFillFraction(value: number, low: number, high: number): number {
  if (value <= 0) return 0;
  if (value <= low) return low > 0 ? (value / low) * 0.3 : 0.3;
  if (value <= high) return 0.3 + ((value - low) / (high - low || 1)) * 0.4;
  const veryHigh = high + (high - low || high);
  if (value <= veryHigh) return 0.7 + ((value - high) / (veryHigh - high || 1)) * 0.3;
  return 1;
}

/** Shallow "smile" arc with two range markers — replaces the circular ring per
 * el Fitia-style reference design. Points are placed along the same quadratic
 * Bézier used to draw the curve so they sit exactly on it. `value` (el
 * consumo acumulado del día) determina cuánto de la curva, y de qué color,
 * se pinta desde la izquierda (0 kcal) — ver `calorieFillFraction`. Si se
 * supera `high`, la curva vibra y muestra una luz roja suave detrás. */
export function ArcChart({
  low,
  high,
  value,
  compact = false,
}: {
  low: number;
  high: number;
  value: number;
  compact?: boolean;
}) {
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
  const pointA = bezier(0.3);
  const pointB = bezier(0.7);

  // Progreso a lo largo de la curva: plomo = todavía no anotado, y de ahí
  // amarillo -> verde -> rojo según lo que se va acumulando en el día. La
  // punta izquierda (t=0) es 0 kcal. Cada tramo de color se dibuja con el
  // truco de `pathLength=1` (normaliza la longitud del path a 1 unidad sin
  // importar la geometría real), así el dasharray/offset queda en
  // fracciones simples en vez de tener que medir el largo real del bezier.
  const fraction = calorieFillFraction(value, low, high);
  const yellowLen = Math.max(0, Math.min(fraction, 0.3));
  const greenLen = Math.max(0, Math.min(fraction - 0.3, 0.4));
  const redLen = Math.max(0, Math.min(fraction - 0.7, 0.3));
  const isOver = value > high;
  const pathD = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

  return (
    <svg viewBox="0 0 320 90" className="w-full h-auto overflow-visible">
      <g className={isOver ? "calorie-arc-shake" : undefined}>
        {isOver && (
          <path
            d={pathD}
            fill="none"
            stroke={RANGE_COLORS.sobre}
            strokeWidth={10}
            strokeLinecap="round"
            className="calorie-arc-glow"
            style={{ filter: "blur(6px)" }}
          />
        )}
        <path d={pathD} fill="none" stroke={RANGE_COLORS.vacio} strokeWidth={2} strokeLinecap="round" />
        {yellowLen > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke={RANGE_COLORS.bajo}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${yellowLen} 10`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        )}
        {greenLen > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke={RANGE_COLORS.enRango}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`0.3 ${greenLen} 10`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        )}
        {redLen > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke={RANGE_COLORS.sobre}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`0.7 ${redLen} 10`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        )}
      </g>
      {[pointA, pointB].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="white" fillOpacity={0.85} />
      ))}
      {!compact && (
        <>
          <text x={pointA.x} y={pointA.y + 22} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.55)">
            {low.toLocaleString()}
          </text>
          <text x={pointB.x} y={pointB.y + 22} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.55)">
            {high.toLocaleString()}
          </text>
        </>
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
  const rangeLow = Math.round(calorieGoal * 0.9);
  const rangeHigh = Math.round(calorieGoal * 1.1);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-xl font-bold text-white tabular-nums">{Math.round(totals.calorias).toLocaleString()}</span>
        <span className="text-[11px] text-white/35 tabular-nums">/ {calorieGoal.toLocaleString()} kcal</span>
      </div>

      <div className="w-3/5 mx-auto">
        <ArcChart low={rangeLow} high={rangeHigh} value={totals.calorias} compact />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MacroColumn label="Prot" value={totals.proteina} goal={proteinGoal} color={MACRO_COLORS.proteina} compact />
        <MacroColumn label="Carbs" value={totals.carbos} goal={carbsGoal} color={MACRO_COLORS.carbos} compact />
        <MacroColumn label="Grasas" value={totals.grasas} goal={fatGoal} color={MACRO_COLORS.grasas} compact />
      </div>
    </div>
  );
}
