/**
 * Ajuste adaptativo de la meta calórica — Fase 3. Funciones puras: comparan
 * el cambio de peso REAL (peso de tendencia, promedio móvil de 7 días, no el
 * peso crudo del día — para filtrar el ruido diario normal) contra lo que
 * las calorías logueadas implicarían, y si el TDEE calculado (fórmula) se
 * desvía bastante del TDEE real observado, sugieren un nuevo objetivo.
 *
 * Nunca se aplica solo — el store no tiene ninguna acción que llame a esto
 * automáticamente; la pantalla de Configuración es quien decide mostrar la
 * sugerencia y el usuario acepta o descarta.
 *
 * Metodología (aprobada, ver research de la Fase 0): inspirada en cómo
 * MacroFactor/Carbon Diet Coach derivan el TDEE real de la relación
 * ingesta-vs-peso en vez de confiar solo en la fórmula.
 */
import type { LoggedFood, WeightEntry } from "@/lib/types";
import { activeLoggedFoods } from "@/lib/food-utils";

/** 1 kg de tejido corporal equivale aproximadamente a esta cantidad de kcal
 * (valor estándar usado por la mayoría de calculadoras de este tipo). */
export const KCAL_PER_KG = 7700;

export const WINDOW_DAYS = 14;
export const MIN_WEIGH_INS_PER_WEEK = 4;
export const MIN_LOG_DAYS_PER_WEEK = 5;
/** Umbral de desviación entre el TDEE calculado (fórmula) y el TDEE
 * implícito (observado) para recién ahí sugerir un cambio. */
export const DEVIATION_THRESHOLD_PCT = 0.1;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(from: Date, n: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

/** Promedio de peso por día (si hubo más de una pesada el mismo día). */
function dailyWeightAverages(entries: WeightEntry[]): Map<string, number> {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const key = dayKey(new Date(e.date));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e.kg);
  }
  const out = new Map<string, number>();
  for (const [key, vals] of byDay) out.set(key, vals.reduce((a, b) => a + b, 0) / vals.length);
  return out;
}

function average(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface AdaptiveCalorieInput {
  weightEntries: WeightEntry[];
  loggedFoods: LoggedFood[];
  /** Meta actual en uso (ya incluye el % de déficit/superávit elegido). */
  calorieGoal: number;
  /** TDEE calculado por la fórmula (Mifflin-St Jeor o Katch-McArdle, ANTES
   * del ajuste de intensidad) — sale de `calcCalorieGoal(...).tdee`. */
  calculatedTDEE: number;
  /** Para pruebas o recálculo sobre una fecha pasada; default hoy. */
  today?: Date;
}

export type AdaptiveStatus = "insufficient_data" | "on_track" | "suggestion";

export interface AdaptiveCalorieResult {
  status: AdaptiveStatus;
  windowDays: number;
  weighInsPerWeek: number;
  logDaysPerWeek: number;
  /** Solo si hubo suficientes datos para calcularlo. */
  impliedTDEE?: number;
  deviationPct?: number;
  suggestedCalorieGoal?: number;
  /** Explicación en texto plano para mostrar junto a la sugerencia o el recordatorio. */
  mensaje: string;
}

/**
 * Evalúa si conviene sugerir un cambio de meta calórica. Nunca aproxima con
 * datos insuficientes: si no se cumplen los mínimos de consistencia, devuelve
 * `insufficient_data` con el detalle de qué falta (recordatorio suave, no
 * push) en vez de forzar un cálculo poco confiable.
 */
export function evaluateAdaptiveCalories(input: AdaptiveCalorieInput): AdaptiveCalorieResult {
  const today = input.today ?? new Date();
  const windowStart = daysAgo(today, WINDOW_DAYS - 1); // incluye hoy => WINDOW_DAYS días

  const weightByDay = dailyWeightAverages(
    input.weightEntries.filter((w) => new Date(w.date) >= windowStart && new Date(w.date) <= today),
  );
  const activeFoods = activeLoggedFoods(input.loggedFoods).filter(
    (f) => new Date(f.timestamp) >= windowStart && new Date(f.timestamp) <= today,
  );
  const logDaysSet = new Set(activeFoods.map((f) => dayKey(new Date(f.timestamp))));

  const weighInsPerWeek = (weightByDay.size / WINDOW_DAYS) * 7;
  const logDaysPerWeek = (logDaysSet.size / WINDOW_DAYS) * 7;

  // Semana 1 (días más viejos) vs semana 2 (días más nuevos) del período — comparar sus
  // promedios da el "peso de tendencia" al inicio y al final, mucho menos ruidoso que
  // comparar dos pesadas puntuales.
  const week1Start = windowStart;
  const week1End = daysAgo(today, 7);
  const week2Start = daysAgo(today, 6);
  const week2End = today;

  const week1Weights: number[] = [];
  const week2Weights: number[] = [];
  for (const [key, kg] of weightByDay) {
    const d = new Date(key);
    if (d >= week1Start && d <= week1End) week1Weights.push(kg);
    else if (d >= week2Start && d <= week2End) week2Weights.push(kg);
  }
  const trendStart = average(week1Weights);
  const trendEnd = average(week2Weights);

  const enoughWeighIns = weighInsPerWeek >= MIN_WEIGH_INS_PER_WEEK && week1Weights.length > 0 && week2Weights.length > 0;
  const enoughLogDays = logDaysPerWeek >= MIN_LOG_DAYS_PER_WEEK;

  if (!enoughWeighIns || !enoughLogDays || trendStart === null || trendEnd === null) {
    const faltantes: string[] = [];
    if (!enoughWeighIns) faltantes.push(`pesarte seguido (llevás ${weighInsPerWeek.toFixed(1)}/semana, necesitás ${MIN_WEIGH_INS_PER_WEEK}+)`);
    if (!enoughLogDays) faltantes.push(`registrar comidas casi todos los días (llevás ${logDaysPerWeek.toFixed(1)}/semana, necesitás ${MIN_LOG_DAYS_PER_WEEK}+)`);
    return {
      status: "insufficient_data",
      windowDays: WINDOW_DAYS,
      weighInsPerWeek: Math.round(weighInsPerWeek * 10) / 10,
      logDaysPerWeek: Math.round(logDaysPerWeek * 10) / 10,
      mensaje: `Todavía no hay suficientes datos consistentes de las últimas 2 semanas para sugerir un ajuste: te falta ${faltantes.join(" y ")}.`,
    };
  }

  const totalDaysBetweenTrends = 7; // punto medio semana1 vs punto medio semana2, ~7 días de diferencia
  const dailyWeightChangeKg = (trendEnd - trendStart) / totalDaysBetweenTrends;

  const avgDailyIntake = activeFoods.reduce((sum, f) => sum + (f.calorias || 0), 0) / WINDOW_DAYS;
  const impliedTDEE = avgDailyIntake - dailyWeightChangeKg * KCAL_PER_KG;
  const deviationPct = (impliedTDEE - input.calculatedTDEE) / input.calculatedTDEE;

  if (Math.abs(deviationPct) < DEVIATION_THRESHOLD_PCT) {
    return {
      status: "on_track",
      windowDays: WINDOW_DAYS,
      weighInsPerWeek: Math.round(weighInsPerWeek * 10) / 10,
      logDaysPerWeek: Math.round(logDaysPerWeek * 10) / 10,
      impliedTDEE: Math.round(impliedTDEE),
      deviationPct: Math.round(deviationPct * 1000) / 1000,
      mensaje: "Tu meta actual está bien calibrada según tu progreso real de las últimas 2 semanas.",
    };
  }

  // Reescala la meta actual (que ya trae el % de déficit/superávit elegido) según la
  // proporción entre el TDEE real observado y el calculado por fórmula — así se preserva
  // la intensidad que el usuario eligió sin tener que rederivarla acá.
  const suggestedCalorieGoal = Math.round(impliedTDEE * (input.calorieGoal / input.calculatedTDEE));
  const signo = deviationPct > 0 ? "más alto" : "más bajo";

  return {
    status: "suggestion",
    windowDays: WINDOW_DAYS,
    weighInsPerWeek: Math.round(weighInsPerWeek * 10) / 10,
    logDaysPerWeek: Math.round(logDaysPerWeek * 10) / 10,
    impliedTDEE: Math.round(impliedTDEE),
    deviationPct: Math.round(deviationPct * 1000) / 1000,
    suggestedCalorieGoal,
    mensaje: `Tu gasto real parece ${signo} que el calculado (${Math.round(impliedTDEE)} vs ${Math.round(input.calculatedTDEE)} kcal de TDEE) según tu peso y tus registros de las últimas 2 semanas. Meta sugerida: ${suggestedCalorieGoal} kcal.`,
  };
}
