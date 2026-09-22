import { format, subDays, subWeeks, startOfWeek, isSameWeek } from "date-fns";
import type { StreakInput } from "./types";

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Racha para frecuencia "diario" — completamente DERIVADA de
 * `completedDates`, nunca de un contador guardado que se va desactualizando.
 * Esto es lo que corrige el bug original de `habitsStore.ts`: ahí el streak
 * vivía en un campo que solo se recalculaba cuando el usuario tocaba el
 * hábito de nuevo, así que si dejabas de cumplirlo el número viejo se
 * quedaba pegado en vez de cachar a 0. Acá, cada vez que se llama a esta
 * función con la fecha de hoy, el resultado ya refleja si la racha sigue
 * viva o se rompió — sin depender de ninguna acción del usuario.
 *
 * Regla: si hoy todavía no está marcado, no se penaliza (el día no terminó),
 * así que se cuenta hacia atrás desde ayer. Si hoy SÍ está marcado, se
 * cuenta desde hoy. En cuanto aparece un día faltante, la cadena corta ahí.
 */
function computeDailyStreak(completedDates: string[], today: Date): number {
  const done = new Set(completedDates);
  let streak = 0;
  let cursor = done.has(toISO(today)) ? today : subDays(today, 1);
  while (done.has(toISO(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Misma idea que la diaria pero por semana calendario (lunes-domingo):
 * alcanza con UNA fecha completada en la semana para que esa semana cuente. */
function computeWeeklyStreak(completedDates: string[], today: Date): number {
  const dates = completedDates.map((d) => new Date(`${d}T00:00:00`));
  const weekHasCompletion = (weekStart: Date) => dates.some((d) => isSameWeek(d, weekStart, { weekStartsOn: 1 }));

  let streak = 0;
  let cursor = startOfWeek(today, { weekStartsOn: 1 });
  if (!weekHasCompletion(cursor)) {
    cursor = subWeeks(cursor, 1);
  }
  while (weekHasCompletion(cursor)) {
    streak++;
    cursor = subWeeks(cursor, 1);
  }
  return streak;
}

export function computeStreak({ completedDates, frequency }: StreakInput, today: Date = new Date()): number {
  if (completedDates.length === 0) return 0;
  return frequency === "semanal" ? computeWeeklyStreak(completedDates, today) : computeDailyStreak(completedDates, today);
}
