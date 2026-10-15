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

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "yyyy-MM-dd" (UTC) que es `n` días antes de `from` — aritmética en UTC (`setUTCDate`), nunca en hora
 * local ni comparando objetos `Date` en milisegundos: eso dejaba el día MÁS VIEJO de la ventana afuera
 * por una carrera de milisegundos entre el dato de prueba y el `new Date()` interno de esta función, y
 * además mezclaba un `new Date("yyyy-MM-dd")` (que el motor de JS interpreta en UTC medianoche) contra
 * límites de semana calculados en hora LOCAL — dos fuentes de corrimiento de huso horario distintas,
 * encontradas con una prueba real (no mockeada): `tools/nutrition/window_real_dates_test.ts`. Con
 * comparación de STRINGS "yyyy-MM-dd" el orden lexicográfico ES el orden cronológico, sin ambigüedad —
 * mismo criterio ya usado en `hypertrophy-engine.ts` y `nutrition-care-engine.ts`. */
export function dayKeyNDaysBefore(from: Date, n: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return dayKey(d);
}

/** Promedio de peso por día (si hubo más de una pesada el mismo día). */
export function dailyWeightAverages(entries: WeightEntry[]): Map<string, number> {
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

export function average(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface WeightTrendResult {
  enoughData: boolean;
  weighInsPerWeek: number;
  /** kg por semana (positivo = subiendo, negativo = bajando). `null` sin suficiente dato. */
  kgPerWeek: number | null;
  /** % del peso corporal por semana — unidad que usa la literatura de volumen/déficit citada en
   * `calorie-periodization.ts` (Garthe et al., Helms et al.). `null` sin suficiente dato. */
  pctPerWeek: number | null;
}

/**
 * Peso de tendencia (semana 1 vs semana 2 de la ventana de 14 días) — la MISMA lógica de ventana que
 * ya usa `evaluateAdaptiveCalories`, separada para que `calorie-periodization.ts` la reuse sin
 * duplicarla.
 */
export function weightTrendRate(weightEntries: WeightEntry[], today = new Date()): WeightTrendResult {
  const todayKey = dayKey(today);
  const windowStartKey = dayKeyNDaysBefore(today, WINDOW_DAYS - 1);
  const weightByDay = dailyWeightAverages(
    weightEntries.filter((w) => {
      const k = dayKey(new Date(w.date));
      return k >= windowStartKey && k <= todayKey;
    }),
  );
  const weighInsPerWeek = (weightByDay.size / WINDOW_DAYS) * 7;

  const week1StartKey = windowStartKey;
  const week1EndKey = dayKeyNDaysBefore(today, 7);
  const week2StartKey = dayKeyNDaysBefore(today, 6);
  const week2EndKey = todayKey;

  const week1Weights: number[] = [];
  const week2Weights: number[] = [];
  for (const [key, kg] of weightByDay) {
    if (key >= week1StartKey && key <= week1EndKey) week1Weights.push(kg);
    else if (key >= week2StartKey && key <= week2EndKey) week2Weights.push(kg);
  }
  const trendStart = average(week1Weights);
  const trendEnd = average(week2Weights);
  const enoughData = weighInsPerWeek >= MIN_WEIGH_INS_PER_WEEK && week1Weights.length > 0 && week2Weights.length > 0 && trendStart !== null && trendEnd !== null;

  if (!enoughData) {
    return { enoughData: false, weighInsPerWeek: Math.round(weighInsPerWeek * 10) / 10, kgPerWeek: null, pctPerWeek: null };
  }
  const kgPerWeek = trendEnd! - trendStart!; // ~7 días entre el punto medio de cada semana, igual que evaluateAdaptiveCalories
  const pctPerWeek = (kgPerWeek / trendStart!) * 100;
  return {
    enoughData: true,
    weighInsPerWeek: Math.round(weighInsPerWeek * 10) / 10,
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    pctPerWeek: Math.round(pctPerWeek * 100) / 100,
  };
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
  const todayKey = dayKey(today);
  const windowStartKey = dayKeyNDaysBefore(today, WINDOW_DAYS - 1); // incluye hoy => WINDOW_DAYS días

  const weightByDay = dailyWeightAverages(
    input.weightEntries.filter((w) => {
      const k = dayKey(new Date(w.date));
      return k >= windowStartKey && k <= todayKey;
    }),
  );
  const activeFoods = activeLoggedFoods(input.loggedFoods).filter((f) => {
    const k = dayKey(new Date(f.timestamp));
    return k >= windowStartKey && k <= todayKey;
  });
  const logDaysSet = new Set(activeFoods.map((f) => dayKey(new Date(f.timestamp))));

  const weighInsPerWeek = (weightByDay.size / WINDOW_DAYS) * 7;
  const logDaysPerWeek = (logDaysSet.size / WINDOW_DAYS) * 7;

  // Semana 1 (días más viejos) vs semana 2 (días más nuevos) del período — comparar sus
  // promedios da el "peso de tendencia" al inicio y al final, mucho menos ruidoso que
  // comparar dos pesadas puntuales.
  const week1StartKey = windowStartKey;
  const week1EndKey = dayKeyNDaysBefore(today, 7);
  const week2StartKey = dayKeyNDaysBefore(today, 6);
  const week2EndKey = todayKey;

  const week1Weights: number[] = [];
  const week2Weights: number[] = [];
  for (const [key, kg] of weightByDay) {
    if (key >= week1StartKey && key <= week1EndKey) week1Weights.push(kg);
    else if (key >= week2StartKey && key <= week2EndKey) week2Weights.push(kg);
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
