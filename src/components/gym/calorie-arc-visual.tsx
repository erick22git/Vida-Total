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

/** Shallow "smile" arc with two range markers — replaces the circular ring per
 * the Fitia-style reference design. Points are placed along the same quadratic
 * Bézier used to draw the curve so they sit exactly on it. */
export function ArcChart({ low, high, compact = false }: { low: number; high: number; compact?: boolean }) {
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

  return (
    <svg viewBox="0 0 320 90" className="w-full h-auto">
      <path
        d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={2}
        strokeLinecap="round"
      />
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
        <ArcChart low={rangeLow} high={rangeHigh} compact />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MacroColumn label="Prot" value={totals.proteina} goal={proteinGoal} color={MACRO_COLORS.proteina} compact />
        <MacroColumn label="Carbs" value={totals.carbos} goal={carbsGoal} color={MACRO_COLORS.carbos} compact />
        <MacroColumn label="Grasas" value={totals.grasas} goal={fatGoal} color={MACRO_COLORS.grasas} compact />
      </div>
    </div>
  );
}
