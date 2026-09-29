import type { MealType } from "@/lib/types";

/**
 * Qué comida corresponde según la hora del día — usado por la pantalla principal de Calorías para que el título de
 * arriba (Desayuno/Almuerzo/Cena/Snack) cambie solo a medida que pasan las horas, sin que el usuario tenga que elegir.
 * Orden real del día: desayuno → almuerzo → snack1 → snack2 → cena (los snacks van ENTRE almuerzo y cena, no
 * después de la cena).
 *
 * `fromMin` = minutos desde las 00:00 (permite horas "quebradas" como las 2:30 pm del almuerzo).
 */
const RANGES: { fromMin: number; meal: MealType }[] = [
  { fromMin: 5 * 60, meal: "desayuno" },
  { fromMin: 11 * 60, meal: "almuerzo" },
  { fromMin: 14 * 60 + 30, meal: "snack1" }, // el almuerzo termina a las 2:30 pm
  { fromMin: 16 * 60 + 30, meal: "snack2" },
  { fromMin: 19 * 60, meal: "cena" },
];

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Devuelve la comida que corresponde a esta hora (hora local). Antes de las 5 AM sigue siendo la última comida
 * (cena) del día anterior. */
export function mealForTime(date: Date = new Date()): MealType {
  const m = minutesOfDay(date);
  let current = RANGES[RANGES.length - 1].meal;
  for (const r of RANGES) {
    if (m >= r.fromMin) current = r.meal;
    else break;
  }
  return current;
}

/**
 * ¿Ya pasó el horario de esa comida? — para pintar de blanco el círculo de las comidas que "ya fueron" (ej. el
 * desayuno a la 1 pm). Un día anterior a hoy: todas pasaron; un día futuro: ninguna. Hoy: pasó si la hora actual
 * ya alcanzó el inicio de la comida siguiente. La última comida del día (cena) no se da por pasada el mismo día.
 */
export function mealTimePassed(meal: MealType, day: Date, now: Date = new Date()): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dayStart < todayStart) return true;
  if (dayStart > todayStart) return false;
  const i = RANGES.findIndex((r) => r.meal === meal);
  if (i < 0 || i === RANGES.length - 1) return false;
  return minutesOfDay(now) >= RANGES[i + 1].fromMin;
}
