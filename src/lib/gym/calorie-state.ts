/**
 * Estado calórico del día (Bloque 12): UN solo lugar decide cuándo es «bajo», «en rango» o «excedido» y de qué color.
 * El arco de kcal y los gráficos 3D (bote de gritos, medidor, batería) solo leen este estado; ninguno calcula su propio
 * porcentaje ni tiene umbrales propios. `low`/`high` salen SIEMPRE de la meta configurada (meta × 0.9 y meta × 1.1),
 * nunca de kcal fijas.
 */

export type CalorieStatus = "vacio" | "bajo" | "enRango" | "sobre";

/** Rango objetivo alrededor de la meta. */
export const RANGE_LOW_FACTOR = 0.9;
export const RANGE_HIGH_FACTOR = 1.1;

/** plomo = sin anotar · amarillo = no llega al mínimo · verde = dentro del rango · rojo = superó el máximo. */
export const RANGE_COLORS: Record<CalorieStatus, string> = {
  vacio: "#6b7280",
  bajo: "#eab308",
  enRango: "#22c55e",
  sobre: "#ef4444",
};

export function calorieRange(goal: number): { low: number; high: number } {
  return { low: Math.round(goal * RANGE_LOW_FACTOR), high: Math.round(goal * RANGE_HIGH_FACTOR) };
}

/**
 * Fracción [0,1] de la CURVA del arco que debe pintarse (0 kcal = punta izquierda). Los marcadores del arco están en
 * 0.3 (`low`) y 0.7 (`high`); pasado `high` se sigue llenando de rojo hasta un techo (`high` + el ancho del rango).
 * Es exactamente la función que vivía en calorie-arc-visual.tsx.
 */
export function calorieFillFraction(value: number, low: number, high: number): number {
  if (value <= 0) return 0;
  if (value <= low) return low > 0 ? (value / low) * 0.3 : 0.3;
  if (value <= high) return 0.3 + ((value - low) / (high - low || 1)) * 0.4;
  const veryHigh = high + (high - low || high);
  if (value <= veryHigh) return 0.7 + ((value - high) / (veryHigh - high || 1)) * 0.3;
  return 1;
}

export function calorieStatus(kcal: number, low: number, high: number): CalorieStatus {
  if (kcal <= 0) return "vacio";
  if (kcal < low) return "bajo";
  if (kcal <= high) return "enRango";
  return "sobre";
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Color continuo para los gráficos 3D: plomo → amarillo mientras llega al mínimo, amarillo → verde al entrar al rango
 * (transición progresiva, sin saltos) y rojo pasado el máximo. Los extremos coinciden con `RANGE_COLORS`.
 */
export function calorieSmoothColor(kcal: number, low: number, high: number): string {
  if (kcal <= 0) return RANGE_COLORS.vacio;
  if (kcal < low) return RANGE_COLORS.bajo;
  if (kcal <= high) {
    // el verde se alcanza al llegar a la mitad del tramo hacia la meta; antes se mezcla desde el amarillo
    const goal = (low + high) / 2;
    const t = goal > low ? Math.min(1, (kcal - low) / (goal - low)) : 1;
    return mix(RANGE_COLORS.bajo, RANGE_COLORS.enRango, t);
  }
  return RANGE_COLORS.sobre;
}

export interface CalorieState {
  kcal: number;
  goal: number;
  low: number;
  high: number;
  /** kcal / meta (puede pasar de 1). */
  percentOfGoal: number;
  /** Llenado de un recipiente/medidor: kcal / meta, topado en [0,1]. */
  level: number;
  /** Fracción de la curva del arco (ver `calorieFillFraction`). */
  arcFraction: number;
  status: CalorieStatus;
  /** Color del estado (discreto, el del arco). */
  color: string;
  /** Color continuo para los modelos 3D. */
  smoothColor: string;
  /** Superó el máximo del rango: los gráficos vibran y brillan en rojo. */
  over: boolean;
}

/** Entrada única: kcal del día + meta configurada (calcula low/high) o un rango ya calculado. */
export function calorieState(kcal: number, goal: number, range?: { low: number; high: number }): CalorieState {
  const { low, high } = range ?? calorieRange(goal);
  const status = calorieStatus(kcal, low, high);
  return {
    kcal,
    goal,
    low,
    high,
    percentOfGoal: goal > 0 ? kcal / goal : 0,
    level: goal > 0 ? Math.max(0, Math.min(1, kcal / goal)) : 0,
    arcFraction: calorieFillFraction(kcal, low, high),
    status,
    color: RANGE_COLORS[status],
    smoothColor: calorieSmoothColor(kcal, low, high),
    over: status === "sobre",
  };
}

/** Largos de los tramos amarillo/verde/rojo de la curva (0..0.3, 0..0.4, 0..0.3) para el arco SVG. */
export function arcSegments(arcFraction: number): { yellow: number; green: number; red: number } {
  return {
    yellow: Math.max(0, Math.min(arcFraction, 0.3)),
    green: Math.max(0, Math.min(arcFraction - 0.3, 0.4)),
    red: Math.max(0, Math.min(arcFraction - 0.7, 0.3)),
  };
}
