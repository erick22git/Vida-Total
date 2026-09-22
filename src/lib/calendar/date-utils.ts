import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

/** Utilidades de fecha compartidas — pensadas para cualquier módulo que
 * necesite un selector de fecha (Hábitos, Rutinas, y más adelante Gym,
 * Agua...), no solo para `/calendario`. */

export function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Franja de `count` días centrada en `center` (por defecto hoy), con
 * `center` en el medio — usado por `DateStrip`. */
export function dayRange(center: Date, count: number): Date[] {
  const half = Math.floor(count / 2);
  return Array.from({ length: count }, (_, i) => addDays(center, i - half));
}

export function shortWeekday(date: Date): string {
  return format(date, "EEEEEE", { locale: es }).toUpperCase();
}

export function dayNumber(date: Date): string {
  return format(date, "d");
}
