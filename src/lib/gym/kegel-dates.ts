/**
 * Módulo puro de fechas para Kegel.
 *
 * REGLA: nunca usar toISOString() ni new Date("YYYY-MM-DD") para obtener la
 * fecha "de hoy". Siempre extraer los componentes LOCALES del Date.
 *
 * Decisiones de diseño:
 * - Un día está "cumplido" cuando se alcanzó la meta diaria de sesiones.
 * - La racha es de días CONSECUTIVOS sin gracia: saltar un día la rompe.
 *   (Coherente con el módulo de Calorías/Gym. La racha más larga sirve
 *   de motivación secundaria.)
 */

// ─────────────────────────────────────────────────────────
// Clave de día local
// ─────────────────────────────────────────────────────────

/** "YYYY-MM-DD" usando las partes LOCALES del Date — nunca UTC. */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Reconstruye un Date a medianoche LOCAL a partir de una clave "YYYY-MM-DD". */
export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
}

/**
 * Diferencia de días de calendario: positivo si b es POSTERIOR a a.
 * Nunca usa new Date("YYYY-MM-DD") (que JS interpreta como UTC).
 */
export function daysDiff(keyA: string, keyB: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (dayKeyToDate(keyB).getTime() - dayKeyToDate(keyA).getTime()) / MS_PER_DAY,
  );
}

/**
 * Normaliza cualquier fecha guardada a clave local "YYYY-MM-DD".
 * Maneja:
 *   - Ya es dayKey "2026-10-05"           → devuelve tal cual
 *   - ISO con hora "2026-10-05T14:30:00Z" → extrae partes locales
 *   - Date.toDateString() "Mon Oct 05..."  → parsea y extrae locales
 *   - null / undefined                     → null
 */
export function toLocalDayKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return localDayKey(d);
}

// ─────────────────────────────────────────────────────────
// Racha
// ─────────────────────────────────────────────────────────

export interface KegelStreakResult {
  current: number;
  best: number;
}

/**
 * Calcula la racha actual y la mejor racha histórica a partir del conjunto
 * de claves de días cumplidos.
 *
 * Racha actual: días CONSECUTIVOS que terminan exactamente hoy.
 * Si hoy no está en doneDays, la racha actual es 0.
 *
 * Racha histórica: la corrida más larga de días consecutivos en todo el historial.
 */
export function computeKegelStreak(
  doneDays: ReadonlySet<string>,
  todayKey: string,
): KegelStreakResult {
  if (doneDays.size === 0) return { current: 0, best: 0 };

  // Racha actual: retrocede desde hoy mientras el día esté cumplido
  let current = 0;
  let cursor = todayKey;
  while (doneDays.has(cursor)) {
    current++;
    cursor = prevDayKey(cursor);
  }

  // Racha histórica: ordenar y buscar la corrida más larga
  const sorted = Array.from(doneDays).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if (prev !== null && daysDiff(prev, key) === 1) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = key;
  }
  best = Math.max(best, current);

  return { current, best };
}

function prevDayKey(key: string): string {
  const d = dayKeyToDate(key);
  d.setDate(d.getDate() - 1);
  return localDayKey(d);
}
