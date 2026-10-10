/**
 * Plan de Kegel — 3 sesiones por día ("Sesión 1/2/3"), cada una de 9 series
 * de dos patrones de contracción, apuntando a ~4 min por sesión:
 *
 *  - CONTRAE Y SOSTÉN: una contracción sostenida — aprieta 8 s, relaja 6 s
 *    (dentro del máximo de 10 s de sostén que recomienda NHS/Squeezy).
 *  - CONTRAE Y RELAJA: apretones rápidos — aprieta 1 s, relaja 1 s, 15 veces
 *    seguidas (serie "rápida", igual criterio NHS de alternar lento/rápido).
 *
 * Fuentes de referencia (límites de seguridad que respetan los números de arriba):
 *  - NHS: "Pelvic floor exercises" (nhs.uk/conditions/urinary-incontinence/
 *    treatment/pelvic-floor-exercises/): sostener 8-10 s, descanso similar.
 *  - NICE CG171 (2013, actualizado 2019): mínimo 3 meses, varias series/día.
 *  - App Squeezy (NHS endorsada): sostener máx 10 s, 3-4 series, 3 sesiones/día.
 *
 * El CONTENIDO de cada sesión (qué orden traen las 9 series) cambia cada día
 * — determinista por fecha (mismo resultado toda la jornada, distinto al día
 * siguiente) — pero el id/título "Sesión 1/2/3" es siempre el mismo, para que
 * el progreso guardado (`kegelPlanStore`) no dependa del contenido del día.
 */

import { localDayKey } from "./kegel-dates";

// ─────────────────────────────────────────────────────────
// Series: los dos patrones de contracción
// ─────────────────────────────────────────────────────────

export type KegelSeriesKind = "sosten" | "relaja";

export const SERIES_LABEL: Record<KegelSeriesKind, string> = {
  sosten: "Contrae y sostén",
  relaja: "Contrae y relaja",
};

/** Antes de relajar: lo que antes decía "SUELTA" ahora depende del patrón. */
export const RELAX_LABEL: Record<KegelSeriesKind, string> = {
  sosten: "SOSTÉN",
  relaja: "RELAJA",
};

export interface KegelSeriesStep {
  kind: KegelSeriesKind;
  /** Repeticiones aprieta/relaja dentro de esta serie (1 para "sostén", 15 para "relaja"). */
  reps: number;
  squeezeSeconds: number;
  relaxSeconds: number;
}

export const SOSTEN_STEP: KegelSeriesStep = { kind: "sosten", reps: 1, squeezeSeconds: 8, relaxSeconds: 6 };
export const RELAJA_STEP: KegelSeriesStep = { kind: "relaja", reps: 15, squeezeSeconds: 1, relaxSeconds: 1 };

/** Descanso entre series (no después de la última) — ajustado para que las 9 series ronden los 4 min. */
export const REST_BETWEEN_SERIES_SEC = 8;

export function seriesDurationSec(s: KegelSeriesStep): number {
  return (s.squeezeSeconds + s.relaxSeconds) * s.reps;
}

function sessionDurationSec(series: KegelSeriesStep[]): number {
  const active = series.reduce((sum, s) => sum + seriesDurationSec(s), 0);
  return active + REST_BETWEEN_SERIES_SEC * Math.max(0, series.length - 1);
}

// ─────────────────────────────────────────────────────────
// Sesión
// ─────────────────────────────────────────────────────────

export const KEGEL_SESSION_IDS = ["sesion-1", "sesion-2", "sesion-3"] as const;
export type KegelSessionId = (typeof KEGEL_SESSION_IDS)[number];

export interface KegelSessionDef {
  /** Fijo — nunca cambia, es lo que guarda `kegelPlanStore`. */
  id: KegelSessionId;
  /** Fijo — "Sesión 1" / "Sesión 2" / "Sesión 3". */
  title: string;
  /** Las 9 series, en orden — esto SÍ cambia de un día a otro. */
  series: KegelSeriesStep[];
  durationSec: number;
}

// ─────────────────────────────────────────────────────────
// Progresión por nivel (sin cambios de lógica, solo movido de lugar)
// ─────────────────────────────────────────────────────────

/**
 * Fórmula de nivel: basada en DÍAS CUMPLIDOS (constancia), no en sesiones brutas.
 * Tabla de días cumplidos acumulados para subir al nivel N:
 *   Nivel 1 → 2  : 7 días  (1 semana de práctica)
 *   Nivel 2 → 3  : 21 días
 *   Nivel 3 → 4  : 42 días
 *   Nivel 4 → 5  : 70 días  ...etc.
 * Subir de nivel es una SUGERENCIA visible, no automático — el usuario acepta.
 */
export const LEVEL_DAY_THRESHOLDS = [0, 7, 21, 42, 70, 105, 147, 196, 252, 315] as const;
export const MAX_KEGEL_LEVEL = 10;

export function suggestedLevel(doneDays: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_DAY_THRESHOLDS.length; i++) {
    if (doneDays >= LEVEL_DAY_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, MAX_KEGEL_LEVEL);
}

// ─────────────────────────────────────────────────────────
// Las 3 "formas" de armar las 9 series — a cuál Sesión N le toca cada una,
// y la variante de la forma "tríos", cambian cada día (ver buildDailySessions).
// ─────────────────────────────────────────────────────────

/** 3 series de "relaja" y luego 6 de "sostén", en dos bloques. */
function shapeBlock(): KegelSeriesStep[] {
  return [RELAJA_STEP, RELAJA_STEP, RELAJA_STEP, SOSTEN_STEP, SOSTEN_STEP, SOSTEN_STEP, SOSTEN_STEP, SOSTEN_STEP, SOSTEN_STEP];
}

/** Intercalado parejo (6 sostén : 3 relaja) repartido a lo largo de las 9 series. */
function shapeAlternating(): KegelSeriesStep[] {
  const out: KegelSeriesStep[] = [];
  let sosten = 0;
  let relaja = 0;
  for (let i = 0; i < 9; i++) {
    // En cada paso se elige el patrón cuya cuota (6 o 3 de 9) está más lejos de cumplirse todavía.
    const wantSosten = (sosten + 1) / 6 <= (relaja + 1) / 3;
    if (wantSosten) {
      out.push(SOSTEN_STEP);
      sosten++;
    } else {
      out.push(RELAJA_STEP);
      relaja++;
    }
  }
  return out;
}

/** Tríos repetidos 3 veces: 2 de un patrón + 1 del otro — cuál patrón es "el de 2" cambia por día. */
function shapeTriples(doubledKind: KegelSeriesKind): KegelSeriesStep[] {
  const doubled = doubledKind === "sosten" ? SOSTEN_STEP : RELAJA_STEP;
  const single = doubledKind === "sosten" ? RELAJA_STEP : SOSTEN_STEP;
  const group = [doubled, doubled, single];
  return [...group, ...group, ...group];
}

// ─────────────────────────────────────────────────────────
// PRNG determinista por día (sin dependencias: mulberry32 + hash FNV-ish)
// ─────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Arma las 3 sesiones del día `dayKey` ("yyyy-MM-dd", ver `localDayKey`). Determinista: mismo día → mismo resultado. */
export function buildDailySessions(dayKey: string): KegelSessionDef[] {
  const rng = mulberry32(hashStr(dayKey));
  const doubledKind: KegelSeriesKind = rng() < 0.5 ? "sosten" : "relaja";
  const shapes = seededShuffle([shapeBlock(), shapeAlternating(), shapeTriples(doubledKind)], rng);
  return KEGEL_SESSION_IDS.map((id, i) => {
    const series = shapes[i];
    return { id, title: `Sesión ${i + 1}`, series, durationSec: sessionDurationSec(series) };
  });
}

export function getKegelSession(id: string, dayKey: string = localDayKey()): KegelSessionDef | undefined {
  if (!(KEGEL_SESSION_IDS as readonly string[]).includes(id)) return undefined;
  return buildDailySessions(dayKey).find((s) => s.id === id);
}
