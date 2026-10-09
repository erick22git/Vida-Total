/**
 * Estado del agua del día: un solo lugar decide qué fracción del vaso se llena. El vaso 3D (y cualquier otro indicador)
 * solo recibe este número; los umbrales (25/50/75/100 %) salen SIEMPRE de la meta configurada, nunca de ml fijos.
 */
export interface WaterState {
  /** 0..1 respecto de la meta (se topa en 1: el vaso no se desborda). */
  fraction: number;
  /** ml sobre la meta (0 si no la superó). */
  overMl: number;
  reached: boolean;
}

export function waterState(totalMl: number, goalMl: number): WaterState {
  const total = Math.max(0, totalMl);
  const goal = goalMl > 0 ? goalMl : 0;
  const fraction = goal > 0 ? Math.min(1, total / goal) : 0;
  return { fraction, overMl: goal > 0 ? Math.max(0, total - goal) : 0, reached: goal > 0 && total >= goal };
}

/** Semáforo del % de la meta de un día (vista Fecha): <50 % poco · 50-79 % amarillo · 80-120 % verde
 * (en meta) · >120 % rojo otra vez (se pasó bastante). */
export type WaterDayColor = "rojo" | "amarillo" | "verde";
export const WATER_DAY_COLORS: Record<WaterDayColor, string> = { rojo: "#ef4444", amarillo: "#eab308", verde: "#22c55e" };

export function waterDayColor(pct: number): WaterDayColor {
  if (pct > 120) return "rojo";
  if (pct >= 80) return "verde";
  if (pct >= 50) return "amarillo";
  return "rojo";
}
