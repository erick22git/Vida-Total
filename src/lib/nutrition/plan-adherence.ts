/**
 * Cumplimiento del plan calórico: desde que empezó la meta actual, ¿llegaste, te acercaste o te pasaste?
 * ¿Y el peso respondió? Módulo PURO (sin store ni React), días en hora LOCAL (no UTC).
 *
 * Criterios (convenciones de práctica, no normas):
 *  - Un día "cumple" si queda dentro de ±10 % de la meta; "cerca" si está entre ±10 % y ±20 %.
 *  - Estancamiento: ≥ 14 días con la meta vigente, ≥ 70 % de los días registrados cumpliendo o cerca, y el
 *    peso de tendencia sin moverse en la dirección del objetivo → se sugiere un paso chico (~5 %, 100-250
 *    kcal), nunca un salto. La respuesta del peso a un cambio calórico tarda ~2 semanas en verse (el peso
 *    diario fluctúa ±1-2 kg por agua/sodio/glucógeno; Hall et al. 2011, Lancet; Helms et al. 2014).
 *  - Frecuencia de pesaje: ≥ 3 veces por semana en condiciones parecidas (mañana, tras ir al baño) y mirar
 *    el PROMEDIO semanal, no el dato suelto (Steinberg et al. 2015; Helms, Muscle & Strength Pyramids).
 *  - Medidas (cintura, cadera, etc.): cada 2-4 semanas — cambian más lento que el peso y sirven para ver
 *    recomposición cuando el peso no se mueve.
 *  - Revisar la meta: no antes de 14 días después de cambiarla.
 * Nunca cambia la meta sola: devuelve texto/sugerencia y la pantalla decide.
 */
import type { LoggedFood, WeightEntry, BodyMeasurementEntry } from "@/lib/types";
import { activeLoggedFoods } from "@/lib/food-utils";
import { localDayKey, dayKeyToDate } from "@/lib/gym/kegel-dates";

export type PlanGoal = "perder" | "mantener" | "ganar";
export type DayStatus = "cumple" | "cerca" | "sobre" | "bajo";

export const DAY_TOLERANCE = 0.1;
export const NEAR_TOLERANCE = 0.2;
export const MIN_DAYS_BEFORE_REVIEW = 14;
export const WEIGH_INS_PER_WEEK_TARGET = 3;
export const MEASURE_EVERY_DAYS = 14;
export const MAX_ANALYZED_DAYS = 28;

export interface GoalChange {
  date: string; // yyyy-MM-dd local
  kcal: number;
}

export interface PlanAdherenceInput {
  loggedFoods: LoggedFood[];
  calorieGoal: number;
  goalHistory: GoalChange[];
  weightEntries: WeightEntry[];
  measurements: BodyMeasurementEntry[];
  objetivo?: PlanGoal;
  today?: Date;
}

export interface PlanDay {
  dateKey: string;
  kcal: number;
  pct: number; // kcal / meta
  status: DayStatus;
}

export type PlanVerdict = "sin_datos" | "llegaste" | "cerca" | "sobrepasaste" | "por_debajo";

export interface PlanAdherenceResult {
  goalKcal: number;
  planStartKey: string;
  /** true si la fecha de inicio se dedujo del primer registro (no hay cambio de meta guardado). */
  startIsEstimated: boolean;
  daysSincePlan: number;
  days: PlanDay[];
  counts: Record<DayStatus, number>;
  loggedDays: number;
  avgKcal: number;
  avgPct: number;
  verdict: PlanVerdict;
  verdictText: string;
  weight: {
    startKg: number | null;
    nowKg: number | null;
    deltaKg: number | null;
    weighInsPerWeek: number;
    movedAsExpected: boolean | null;
  };
  adjustment: { suggestedKcal: number; stepKcal: number; text: string } | null;
  schedule: {
    nextWeighInText: string;
    weighInOverdue: boolean;
    nextMeasureKey: string | null;
    measureOverdue: boolean;
    nextReviewKey: string;
    reviewReady: boolean;
    lines: string[];
  };
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

function addDays(key: string, n: number): string {
  const d = dayKeyToDate(key);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

function diffDays(aKey: string, bKey: string): number {
  return Math.round((dayKeyToDate(bKey).getTime() - dayKeyToDate(aKey).getTime()) / 86400000);
}

/** Clave local de una fecha de peso: "yyyy-MM-dd" tal cual, o ISO completo en hora local. */
function weightKey(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDayKey(new Date(date));
}

function statusOf(pct: number): DayStatus {
  const dev = pct - 1;
  if (Math.abs(dev) <= DAY_TOLERANCE) return "cumple";
  if (Math.abs(dev) <= NEAR_TOLERANCE) return "cerca";
  return dev > 0 ? "sobre" : "bajo";
}

function mean(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function evaluatePlanAdherence(input: PlanAdherenceInput): PlanAdherenceResult {
  const today = input.today ?? new Date();
  const todayKey = localDayKey(today);
  const goal = input.calorieGoal;

  const foods = activeLoggedFoods(input.loggedFoods);
  const kcalByDay = new Map<string, number>();
  for (const f of foods) {
    const k = localDayKey(new Date(f.timestamp));
    kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + (f.calorias || 0));
  }
  const firstLogKey = [...kcalByDay.keys()].sort()[0];

  // Inicio del plan = última vez que cambió la meta hacia el valor vigente; si no hay historial, primer registro.
  const hist = [...input.goalHistory].sort((a, b) => a.date.localeCompare(b.date));
  const lastChange = hist.length ? hist[hist.length - 1] : undefined;
  const startIsEstimated = !lastChange || lastChange.kcal !== goal;
  let planStartKey = !startIsEstimated && lastChange ? lastChange.date : (firstLogKey ?? todayKey);
  const limitKey = addDays(todayKey, -(MAX_ANALYZED_DAYS - 1));
  if (planStartKey < limitKey) planStartKey = limitKey;
  const daysSincePlan = Math.max(1, diffDays(planStartKey, todayKey) + 1);

  // Hoy aún está en curso: no cuenta como "día fallado" (se analiza hasta ayer, y hoy solo si ya hay registro ≥ 80 % de la meta).
  const days: PlanDay[] = [];
  for (const [k, kcal] of [...kcalByDay].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (k < planStartKey || k > todayKey || goal <= 0) continue;
    if (k === todayKey && kcal < goal * 0.8) continue;
    const pct = kcal / goal;
    days.push({ dateKey: k, kcal: round(kcal), pct, status: statusOf(pct) });
  }
  const counts: Record<DayStatus, number> = { cumple: 0, cerca: 0, sobre: 0, bajo: 0 };
  for (const d of days) counts[d.status]++;
  const loggedDays = days.length;
  const avgKcal = loggedDays ? round(days.reduce((a, d) => a + d.kcal, 0) / loggedDays) : 0;
  const avgPct = goal > 0 ? avgKcal / goal : 0;

  let verdict: PlanVerdict = "sin_datos";
  let verdictText = "Aún no hay días registrados con esta meta.";
  if (loggedDays >= 3 && goal > 0) {
    const avgDev = avgPct - 1;
    if (Math.abs(avgDev) <= DAY_TOLERANCE) {
      verdict = "llegaste";
      verdictText = `Llegaste: promedias ${avgKcal} kcal, ${round(avgPct * 100)} % de tu meta de ${goal}.`;
    } else if (avgDev > 0) {
      verdict = avgDev <= NEAR_TOLERANCE ? "cerca" : "sobrepasaste";
      verdictText =
        verdict === "cerca"
          ? `Te pasas un poco: promedias ${avgKcal} kcal (${round(avgPct * 100)} % de ${goal}).`
          : `Sobrepasaste la meta: promedias ${avgKcal} kcal (${round(avgPct * 100)} % de ${goal}).`;
    } else {
      verdict = avgDev >= -NEAR_TOLERANCE ? "cerca" : "por_debajo";
      verdictText =
        verdict === "cerca"
          ? `Te acercas: promedias ${avgKcal} kcal (${round(avgPct * 100)} % de ${goal}), un poco por debajo.`
          : `Estás por debajo: promedias ${avgKcal} kcal (${round(avgPct * 100)} % de ${goal}). Comer muy por debajo de la meta también frena el progreso.`;
    }
  }

  // Peso desde que empezó el plan: promedio de la primera semana vs. la última semana de datos.
  const w = input.weightEntries
    .map((e) => ({ k: weightKey(e.date), kg: e.kg }))
    .filter((e) => e.k >= planStartKey && e.k <= todayKey)
    .sort((a, b) => a.k.localeCompare(b.k));
  const wDays = new Set(w.map((e) => e.k));
  const weighInsPerWeek = round((wDays.size / daysSincePlan) * 7, 1);
  const startKg = mean(w.filter((e) => e.k <= addDays(planStartKey, 6)).map((e) => e.kg));
  const nowKg = mean(w.filter((e) => e.k >= addDays(todayKey, -6)).map((e) => e.kg));
  const hasTrend = startKg !== null && nowKg !== null && daysSincePlan >= 8 && w.length >= 2;
  const deltaKg = hasTrend ? round(nowKg - startKg, 2) : null;

  let movedAsExpected: boolean | null = null;
  if (hasTrend && deltaKg !== null && input.objetivo) {
    const weeks = Math.max(1, daysSincePlan / 7);
    const perWeekPct = (deltaKg / startKg) * 100 / weeks;
    if (input.objetivo === "perder") movedAsExpected = perWeekPct <= -0.15;
    else if (input.objetivo === "ganar") movedAsExpected = perWeekPct >= 0.1;
    else movedAsExpected = Math.abs(perWeekPct) <= 0.25;
  }

  // Ajuste solo con cumplimiento real + tiempo suficiente + peso que no responde.
  let adjustment: PlanAdherenceResult["adjustment"] = null;
  const adherent = loggedDays > 0 ? (counts.cumple + counts.cerca) / loggedDays : 0;
  if (
    input.objetivo &&
    input.objetivo !== "mantener" &&
    movedAsExpected === false &&
    daysSincePlan >= MIN_DAYS_BEFORE_REVIEW &&
    loggedDays >= 8 &&
    adherent >= 0.7 &&
    goal > 0
  ) {
    const step = Math.min(250, Math.max(100, Math.round((goal * 0.05) / 50) * 50));
    const suggestedKcal = input.objetivo === "perder" ? goal - step : goal + step;
    adjustment = {
      stepKcal: step,
      suggestedKcal,
      text:
        input.objetivo === "perder"
          ? `Cumples la meta (${Math.round(adherent * 100)} % de tus días) y el peso casi no baja tras ${daysSincePlan} días. Prueba ${suggestedKcal} kcal (-${step}) y revisa en 2 semanas.`
          : `Cumples la meta (${Math.round(adherent * 100)} % de tus días) y el peso casi no sube tras ${daysSincePlan} días. Prueba ${suggestedKcal} kcal (+${step}) y revisa en 2 semanas.`,
    };
  }

  // Calendario de seguimiento.
  const lastWeigh = w.length ? w[w.length - 1].k : input.weightEntries.map((e) => weightKey(e.date)).sort().pop();
  const lastMeasure = input.measurements.map((m) => m.date.slice(0, 10)).sort().pop();
  const nextMeasureKey = lastMeasure ? addDays(lastMeasure, MEASURE_EVERY_DAYS) : null;
  const nextReviewKey = addDays(planStartKey, MIN_DAYS_BEFORE_REVIEW);
  const weighInOverdue = !lastWeigh || diffDays(lastWeigh, todayKey) > 3;
  const measureOverdue = !nextMeasureKey || nextMeasureKey <= todayKey;
  const reviewReady = nextReviewKey <= todayKey;

  const lines: string[] = [
    weighInOverdue
      ? "Pésate hoy: al menos 3 veces por semana, en la mañana y en condiciones parecidas. Lo que cuenta es el promedio de la semana, no un día suelto."
      : `Vas bien con el peso (${weighInsPerWeek}/semana). Meta: 3 o más por semana, siempre en condiciones parecidas.`,
    measureOverdue
      ? "Toma tus medidas (cintura, cadera…) ahora: conviene cada 2 semanas, y más si el peso no se mueve."
      : `Próximas medidas: ${nextMeasureKey}.`,
    reviewReady
      ? "Ya pasaron 2 semanas con esta meta: es buen momento de evaluarla."
      : `Evalúa esta meta a partir del ${nextReviewKey}: el peso tarda unas 2 semanas en mostrar el efecto de un cambio.`,
  ];

  return {
    goalKcal: goal,
    planStartKey,
    startIsEstimated,
    daysSincePlan,
    days,
    counts,
    loggedDays,
    avgKcal,
    avgPct,
    verdict,
    verdictText,
    weight: { startKg: startKg === null ? null : round(startKg, 1), nowKg: nowKg === null ? null : round(nowKg, 1), deltaKg, weighInsPerWeek, movedAsExpected },
    adjustment,
    schedule: {
      nextWeighInText: weighInOverdue ? "hoy" : "mañana",
      weighInOverdue,
      nextMeasureKey,
      measureOverdue,
      nextReviewKey,
      reviewReady,
      lines,
    },
  };
}
