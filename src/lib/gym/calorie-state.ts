/**
 * Estado calórico del día: UN solo lugar decide en qué punto está el usuario respecto de su meta y cómo se ve.
 * El arco de kcal y los gráficos 3D (bote de gritos, medidor, batería) solo leen este estado; ninguno calcula su propio
 * porcentaje ni tiene umbrales propios. Todo sale de la META configurada (kcal / meta), nunca de kcal fijas.
 *
 * Umbrales (porcentaje de la meta, con las kcal redondeadas al entero):
 *   0 kcal              → "vacio"           plomo, recipiente vacío
 *   1 … meta-1          → "bajo"            amarillo → verde PROGRESIVO según kcal/meta
 *   = meta (100 %)      → "logrado"         verde; al llegar (o cruzarlo por 1.ª vez en el día) hay confeti + felicitación
 *   meta+1 … 119 %      → "excedido"        rojo inmediato, quieto (sin vibrar ni brillar)
 *   ≥ 120 %             → "excedidoFuerte"  rojo + vibra (shake) + brilla (glow pulsante)
 */

export type CalorieStatus = "vacio" | "bajo" | "logrado" | "excedido" | "excedidoFuerte";

/** A partir de este múltiplo de la meta el objeto vibra y brilla. */
export const STRONG_FACTOR = 1.2;

/** plomo = sin anotar · amarillo→verde = progreso · verde = meta lograda · rojo = pasó la meta. */
export const CALORIE_COLORS = {
  vacio: "#6b7280",
  bajo: "#eab308",
  logrado: "#22c55e",
  excedido: "#ef4444",
  excedidoFuerte: "#ef4444",
} as const satisfies Record<CalorieStatus, string>;

export function calorieStatus(kcal: number, goal: number): CalorieStatus {
  const k = Math.round(kcal);
  if (k <= 0) return "vacio";
  if (goal <= 0) return "excedido";
  if (k < goal) return "bajo";
  if (k === goal) return "logrado";
  return k >= goal * STRONG_FACTOR ? "excedidoFuerte" : "excedido";
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Color continuo (para los modelos 3D y el degradado del arco): amarillo → verde con el porcentaje; rojo al pasar la meta. */
export function calorieSmoothColor(kcal: number, goal: number): string {
  const s = calorieStatus(kcal, goal);
  if (s === "vacio") return CALORIE_COLORS.vacio;
  if (s === "bajo") return mix(CALORIE_COLORS.bajo, CALORIE_COLORS.logrado, Math.max(0, Math.min(1, kcal / goal)));
  return CALORIE_COLORS[s];
}

/**
 * Posición de la curva del arco (0 = punta izquierda) donde está la meta (100 %). El resto de la curva es el tramo rojo:
 * la curva se llena por completo con kcal = meta / GOAL_POS (≈ 150 %).
 */
export const ARC_GOAL_POS = 2 / 3;

export interface CalorieState {
  kcal: number;
  goal: number;
  /** kcal / meta (puede pasar de 1). */
  percentOfGoal: number;
  /** Llenado de un recipiente/medidor: kcal / meta, topado en [0,1]. */
  level: number;
  /** Fracción [0,1] de la curva del arco que se pinta. */
  arcFraction: number;
  status: CalorieStatus;
  /** Color del estado (discreto). */
  color: string;
  /** Color continuo (amarillo→verde progresivo). */
  smoothColor: string;
  /** Pasó la meta: rojo. */
  over: boolean;
  /** ≥ 120 %: vibra y brilla. Entre 100 % y 120 % es rojo pero quieto. */
  shake: boolean;
  glow: boolean;
}

export function calorieState(kcal: number, goal: number): CalorieState {
  const status = calorieStatus(kcal, goal);
  const level = goal > 0 ? Math.max(0, Math.min(1, kcal / goal)) : 0;
  const strong = status === "excedidoFuerte";
  return {
    kcal,
    goal,
    percentOfGoal: goal > 0 ? kcal / goal : 0,
    level,
    arcFraction: goal > 0 ? Math.max(0, Math.min(1, (kcal / goal) * ARC_GOAL_POS)) : 0,
    status,
    color: CALORIE_COLORS[status],
    smoothColor: calorieSmoothColor(kcal, goal),
    over: status === "excedido" || strong,
    shake: strong,
    glow: strong,
  };
}

/** Largos de la curva: `progress` (0..ARC_GOAL_POS, amarillo→verde) y `red` (el resto, pasada la meta). */
export function arcSegments(arcFraction: number): { progress: number; red: number } {
  return {
    progress: Math.max(0, Math.min(arcFraction, ARC_GOAL_POS)),
    red: Math.max(0, arcFraction - ARC_GOAL_POS),
  };
}

/** ¿El día acaba de CRUZAR la meta hacia arriba? (dispara la celebración; el «solo una vez al día» lo resuelve `celebrationDue`). */
export function crossedGoal(prevKcal: number, nextKcal: number, goal: number): boolean {
  return goal > 0 && Math.round(prevKcal) < goal && Math.round(nextKcal) >= goal;
}

/** Celebra una sola vez por día: `lastCelebratedDay` es el `yyyy-MM-dd` de la última celebración guardada. */
export function celebrationDue(today: string, lastCelebratedDay: string | null | undefined): boolean {
  return lastCelebratedDay !== today;
}
