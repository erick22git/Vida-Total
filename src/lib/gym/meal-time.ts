import { useMemo } from "react";
import type { MealType } from "@/lib/types";
import { DEFAULT_MEAL_START_TIMES, usePreferencesStore } from "@/lib/store/preferencesStore";

/**
 * Qué comida corresponde según la hora del día — usado por la pantalla principal de Calorías para que el título de
 * arriba (Desayuno/Almuerzo/Cena/Snack) cambie solo a medida que pasan las horas, sin que el usuario tenga que elegir.
 * El orden es el de las horas configuradas (Snack 1..N pueden ir antes o después del almuerzo, según su hora).
 *
 * La hora de inicio de cada comida es configurable (Calorías → Tiempos de comida, `preferencesStore.mealStartTimes`); cada
 * comida dura hasta que empieza la siguiente.
 */
export const ALL_MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "snack3", "snack4", "cena"];
export const MAX_SNACKS = 4;

/** Comidas activas: desayuno, almuerzo y cena, más `snackCount` snacks (Snack 1..N). Sin ordenar. */
export function activeMeals(snackCount: number): MealType[] {
  const n = Math.max(0, Math.min(MAX_SNACKS, snackCount));
  return ["desayuno", "almuerzo", ...(["snack1", "snack2", "snack3", "snack4"] as MealType[]).slice(0, n), "cena"];
}

/** Comidas activas ordenadas por su hora de inicio (la que empieza más temprano primero). */
export function sortedMeals(times: Partial<Record<MealType, string>> | undefined, snackCount: number): MealType[] {
  return activeMeals(snackCount)
    .map((meal) => ({ meal, fromMin: toMinutes(times?.[meal], DEFAULT_MEAL_START_TIMES[meal]) }))
    .sort((a, b) => a.fromMin - b.fromMin)
    .map((x) => x.meal);
}

/** Orden actual de las comidas del día (por hora), leído de las preferencias — para código fuera de React. */
export function getMealOrder(): MealType[] {
  const { mealStartTimes, snackCount } = usePreferencesStore.getState();
  return sortedMeals(mealStartTimes, snackCount);
}

/** Igual que `getMealOrder`, pero reactivo: se actualiza solo al cambiar horarios o la cantidad de snacks. */
export function useMealOrder(): MealType[] {
  const times = usePreferencesStore((s) => s.mealStartTimes);
  const count = usePreferencesStore((s) => s.snackCount);
  return useMemo(() => sortedMeals(times, count), [times, count]);
}

function toMinutes(hhmm: string | undefined, fallback: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "") ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}

/** Rangos ordenados por hora de inicio, tomando lo configurado (o el valor por defecto si falta). */
function ranges(): { fromMin: number; meal: MealType }[] {
  const t = usePreferencesStore.getState().mealStartTimes;
  const count = usePreferencesStore.getState().snackCount;
  return activeMeals(count).map((meal) => ({ meal, fromMin: toMinutes(t?.[meal], DEFAULT_MEAL_START_TIMES[meal]) })).sort((a, b) => a.fromMin - b.fromMin);
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Devuelve la comida que corresponde a esta hora (hora local). Antes de la primera comida del día sigue siendo la última
 * (la del día anterior). */
export function mealForTime(date: Date = new Date()): MealType {
  const r = ranges();
  const m = minutesOfDay(date);
  let current = r[r.length - 1].meal;
  for (const range of r) {
    if (m >= range.fromMin) current = range.meal;
    else break;
  }
  return current;
}

/**
 * ¿Ya pasó el horario de esa comida? — para pintar de blanco el círculo de las comidas que "ya fueron" (ej. el
 * desayuno a la 1 pm). Un día anterior a hoy: todas pasaron; un día futuro: ninguna. Hoy: pasó si la hora actual
 * ya alcanzó el inicio de la comida siguiente. La última comida del día no se da por pasada el mismo día.
 */
export function mealTimePassed(meal: MealType, day: Date, now: Date = new Date()): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dayStart < todayStart) return true;
  if (dayStart > todayStart) return false;
  const r = ranges();
  const i = r.findIndex((x) => x.meal === meal);
  if (i < 0 || i === r.length - 1) return false;
  return minutesOfDay(now) >= r[i + 1].fromMin;
}
