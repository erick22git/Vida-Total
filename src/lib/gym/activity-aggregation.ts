/**
 * Agregación por día/semana/mes de las calorías "activas" (entrenamiento + caminata) — pedido:
 * "se registra por día semana mes". Módulo puro: reusa `estimateSessionCalories` (entrenamiento) y el
 * resumen ya calculado de cada `WalkSession` (caminata), nunca recalcula las calorías por su cuenta,
 * solo las agrupa por fecha.
 */
import { format } from "date-fns";
import type { WorkoutSession, WalkSession } from "@/lib/types";
import { estimateSessionCalories } from "./exercise-calorie-burn";

export interface DayActivity {
  dayKey: string; // "yyyy-MM-dd"
  entrenoKcal: number;
  caminataKcal: number;
  totalKcal: number;
}

function ensureDay(map: Map<string, DayActivity>, key: string): DayActivity {
  let e = map.get(key);
  if (!e) {
    e = { dayKey: key, entrenoKcal: 0, caminataKcal: 0, totalKcal: 0 };
    map.set(key, e);
  }
  return e;
}

/** Totales por día (clave "yyyy-MM-dd") de calorías de entrenamiento y de caminata. */
export function dailyActivityTotals(sessions: WorkoutSession[], walks: WalkSession[], pesoCorporalKg: number): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  for (const session of sessions) {
    if (!session.completado) continue;
    const key = session.date.slice(0, 10);
    const entry = ensureDay(map, key);
    const { totalKcal } = estimateSessionCalories(session, pesoCorporalKg);
    entry.entrenoKcal += totalKcal;
    entry.totalKcal += totalKcal;
  }
  for (const walk of walks) {
    if (walk.kcal === undefined) continue;
    const key = walk.startedAt.slice(0, 10);
    const entry = ensureDay(map, key);
    entry.caminataKcal += walk.kcal;
    entry.totalKcal += walk.kcal;
  }
  return map;
}

/** Suma de una colección de `DayActivity` agrupada por una clave derivada de `dayKey` (semana ISO o
 * mes) — misma forma de agregación para ambos casos, solo cambia la función que deriva la clave. */
function groupBy(daily: Map<string, DayActivity>, keyOf: (dayKey: string) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [dayKey, entry] of daily) {
    const key = keyOf(dayKey);
    out.set(key, (out.get(key) ?? 0) + entry.totalKcal);
  }
  return out;
}

/** Clave "yyyy-'W'II" (año-semana ISO) para una fecha "yyyy-MM-dd". */
export function weekKeyOf(dayKey: string): string {
  return format(new Date(`${dayKey}T00:00:00`), "RRRR-'W'II");
}

/** Clave "yyyy-MM" para una fecha "yyyy-MM-dd". */
export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function weeklyActivityTotals(daily: Map<string, DayActivity>): Map<string, number> {
  return groupBy(daily, weekKeyOf);
}

export function monthlyActivityTotals(daily: Map<string, DayActivity>): Map<string, number> {
  return groupBy(daily, monthKeyOf);
}
