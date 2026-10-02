import { addDays, format } from "date-fns";
import type { WeeklyPlanDay } from "@/lib/types";

/** Índice del plan semanal (0 = lunes) que le corresponde a una fecha. */
export function planIndexForDate(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export interface TrainingStreakInfo {
  /** Días de descanso (según el plan semanal) en los que no había que entrenar — cuentan para la racha. */
  restKeys: Set<string>;
  /** Días seguidos hasta hoy en que se entrenó o tocaba descansar. */
  streak: number;
}

/**
 * Racha de Entrenamiento: a diferencia de Calorías, los DESCANSOS cuentan — un día que el plan marca
 * como "Descanso" mantiene la racha (y se muestra en gris), y un día que tocaba entrenar y no se
 * entrenó la corta (sin ícono). Se usa el plan semanal ACTUAL para todos los días pasados, y solo
 * desde el primer entrenamiento registrado (antes de eso no hay nada que contar). Si hoy toca
 * entrenar y todavía no se entrenó, la racha no se corta: el día no terminó.
 */
export function trainingStreakInfo(trainedKeys: Set<string>, weeklyPlan: WeeklyPlanDay[], todayISO: string): TrainingStreakInfo {
  const first = [...trainedKeys].sort()[0];
  const restKeys = new Set<string>();
  if (!first) return { restKeys, streak: 0 };

  const isRestDay = (d: Date) => weeklyPlan[planIndexForDate(d)]?.grupoMuscular === "Descanso";
  const today = new Date(`${todayISO}T12:00:00`);
  const firstDate = new Date(`${first}T12:00:00`);

  for (let d = firstDate; format(d, "yyyy-MM-dd") <= todayISO; d = addDays(d, 1)) {
    const key = format(d, "yyyy-MM-dd");
    if (isRestDay(d) && !trainedKeys.has(key)) restKeys.add(key);
  }

  let streak = 0;
  for (let d = today; d >= firstDate; d = addDays(d, -1)) {
    const key = format(d, "yyyy-MM-dd");
    const ok = trainedKeys.has(key) || restKeys.has(key);
    if (ok) streak++;
    else if (key !== todayISO) break;
  }
  return { restKeys, streak };
}
