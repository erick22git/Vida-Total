import type { MealType } from "@/lib/types";

/**
 * Qué comida corresponde según la hora del día — usado por la pantalla principal de Calorías para que el título de
 * arriba (Desayuno/Almuerzo/Cena/Snack) cambie solo a medida que pasan las horas, sin que el usuario tenga que elegir.
 *
 * PROVISIONAL (etapa 1 del rediseño, sección 0 del pedido): son rangos razonables para empezar a probar la mecánica,
 * no fueron pedidos con horas exactas. Se ajustan sin drama más adelante si no calzan con cómo comés en realidad.
 */
const RANGES: { from: number; meal: MealType }[] = [
  { from: 5, meal: "desayuno" },
  { from: 11, meal: "almuerzo" },
  { from: 16, meal: "snack1" },
  { from: 19, meal: "cena" },
  { from: 23, meal: "snack2" },
];

/** Devuelve la comida que corresponde a esta hora (hora local). Antes de las 5 AM sigue siendo el "snack2" de la
 * madrugada anterior. */
export function mealForTime(date: Date = new Date()): MealType {
  const h = date.getHours();
  let current = RANGES[RANGES.length - 1].meal;
  for (const r of RANGES) {
    if (h >= r.from) current = r.meal;
    else break;
  }
  return current;
}
