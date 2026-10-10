/**
 * Motor de rangos de entrenamiento — módulo PURO (sin React ni store), una sola fuente de verdad.
 * Estilo de `calorie-state.ts`: se prueba con `tools/3d/verify/rank_engine_test.ts`.
 *
 * Cómo se calcula (resumen; detalle y fuentes en docs/rangos-fuentes.md):
 *  1. Por ejercicio: mejor serie completada (sin calentamientos) -> 1RM estimado con Epley
 *     (peso × (1 + reps/30); con 1 rep es el peso; las reps se TOPAN en `REPS_CAP` porque Epley sobreestima
 *     con muchas reps). Ejercicios de peso corporal usan las repeticiones máximas.
 *  2. Se compara contra los cinco percentiles (5/20/50/80/95) del estándar del ejercicio para tu sexo y peso
 *     corporal (se interpola el cociente 1RM/peso corporal entre los pesos de la tabla) y se obtiene un
 *     percentil asumiendo una distribución normal entre esos puntos.
 *  3. El percentil se traduce a rango + nivel con los tramos de `RANK_TIER_DEFS` (cada rango se divide en tres
 *     niveles iguales). El puntaje numérico es `tier*3 + nivel (+ fracción)`: Hierro I = 0 … Campeón III = 23,
 *     Simétrico = 24.
 *  4. Agregación: músculo = promedio de sus 3 mejores ejercicios (así un ejercicio flojo no te castiga y
 *     no hace falta haber hecho todos); grupo = promedio de los músculos con datos; general = promedio de los
 *     grupos con datos. Sin datos = `null` (gris), nunca inventado.
 */
import type { WorkoutSession, WorkoutSet } from "@/lib/types";
import { LEVEL_ROMAN, LEVELS_PER_TIER, RANK_GROUPS, RANK_TIER_DEFS, type RankTierDef } from "@/lib/gym/rank-config";
import { DERIVED, DIRECT, STANDARDS, type Five, type Sex, type Standard } from "@/lib/gym/rank-standards";

/** Tope de repeticiones usado en Epley (con más reps la estimación sobreestima ~10–15 %). */
export const REPS_CAP = 12;
/** Cuántos de los mejores ejercicios de un músculo promedian su rango. */
export const TOP_EXERCISES_PER_MUSCLE = 3;

// ---------------------------------------------------------------------------
// Estadística básica (normal estándar)
// ---------------------------------------------------------------------------

/** Cuantil de la normal estándar (aproximación de Acklam, error < 1.2e-9). */
export function normInv(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Función de distribución de la normal estándar (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp((-z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

const ANCHOR_PCT = [5, 20, 50, 80, 95] as const;
const ANCHOR_Z = ANCHOR_PCT.map((p) => normInv(p / 100));
const Z_LIMIT = 3;

// ---------------------------------------------------------------------------
// 1RM
// ---------------------------------------------------------------------------

export interface OneRepMax {
  value: number;
  /** true si las reps pasaron `REPS_CAP`: se calculó con el tope y la estimación pierde precisión. */
  capped: boolean;
}

/** 1RM estimado (Epley). Con 1 rep devuelve el peso. Las reps se topan en `REPS_CAP`. */
export function estimate1RM(peso: number, reps: number): OneRepMax {
  if (!(peso > 0) || !(reps > 0)) return { value: 0, capped: false };
  const r = Math.min(reps, REPS_CAP);
  return { value: r <= 1 ? peso : peso * (1 + r / 30), capped: reps > REPS_CAP };
}

// ---------------------------------------------------------------------------
// Estándares: interpolación por peso corporal y percentiles
// ---------------------------------------------------------------------------

/** Cinco valores [P5…P95] del estándar para ese sexo y peso corporal. */
export function anchorsFor(std: Standard, sexo: Sex, bodyKg: number): Five {
  const rows = sexo === "hombre" ? std.hombre : std.mujer;
  const bw = Math.max(1, bodyKg);
  // kg: se interpola el COCIENTE levantado/peso corporal (más estable al extrapolar); reps: valores directos.
  const val = (row: [number, Five], i: number) => (std.kind === "kg" ? row[1][i] / row[0] : row[1][i]);
  const out = [0, 0, 0, 0, 0] as Five;
  for (let i = 0; i < 5; i++) {
    let v: number;
    if (bw <= rows[0][0]) v = val(rows[0], i);
    else if (bw >= rows[rows.length - 1][0]) v = val(rows[rows.length - 1], i);
    else {
      const j = rows.findIndex((r) => r[0] >= bw);
      const lo = rows[j - 1];
      const hi = rows[j];
      const t = (bw - lo[0]) / (hi[0] - lo[0]);
      v = val(lo, i) + (val(hi, i) - val(lo, i)) * t;
    }
    out[i] = std.kind === "kg" ? v * bw : v;
  }
  return out;
}

/** Fuerza los cinco valores a ser estrictamente crecientes (algunas tablas de reps repiten ceros). */
function strictlyIncreasing(a: Five): Five {
  const eps = Math.max(0.01, a[4] * 0.005);
  const out = [...a] as Five;
  for (let i = 1; i < 5; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + eps;
  return out;
}

/** Percentil (0–100) que corresponde a `value` según los cinco puntos del estándar. */
export function valueToPercentile(value: number, anchors: Five): number {
  const a = strictlyIncreasing(anchors);
  let z: number;
  if (value <= a[0]) {
    const slope = (ANCHOR_Z[1] - ANCHOR_Z[0]) / (a[1] - a[0]);
    z = ANCHOR_Z[0] - (a[0] - value) * slope;
  } else if (value >= a[4]) {
    const slope = (ANCHOR_Z[4] - ANCHOR_Z[3]) / (a[4] - a[3]);
    z = ANCHOR_Z[4] + (value - a[4]) * slope;
  } else {
    let i = 0;
    while (i < 3 && value > a[i + 1]) i++;
    z = ANCHOR_Z[i] + ((value - a[i]) / (a[i + 1] - a[i])) * (ANCHOR_Z[i + 1] - ANCHOR_Z[i]);
  }
  z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, z));
  return normCdf(z) * 100;
}

/** Inversa de `valueToPercentile`: qué valor hace falta para llegar a ese percentil. */
export function percentileToValue(pct: number, anchors: Five): number {
  const a = strictlyIncreasing(anchors);
  const z = normInv(Math.min(0.9999, Math.max(0.0001, pct / 100)));
  if (z <= ANCHOR_Z[0]) {
    const slope = (a[1] - a[0]) / (ANCHOR_Z[1] - ANCHOR_Z[0]);
    return Math.max(0, a[0] + (z - ANCHOR_Z[0]) * slope);
  }
  if (z >= ANCHOR_Z[4]) {
    const slope = (a[4] - a[3]) / (ANCHOR_Z[4] - ANCHOR_Z[3]);
    return a[4] + (z - ANCHOR_Z[4]) * slope;
  }
  let i = 0;
  while (i < 3 && z > ANCHOR_Z[i + 1]) i++;
  return a[i] + ((z - ANCHOR_Z[i]) / (ANCHOR_Z[i + 1] - ANCHOR_Z[i])) * (a[i + 1] - a[i]);
}

// ---------------------------------------------------------------------------
// Percentil -> rango + nivel
// ---------------------------------------------------------------------------

/** Percentil donde EMPIEZA cada rango (Hierro = 0; el resto = 100 − topPct). */
export function tierStartPercentile(i: number): number {
  const t = RANK_TIER_DEFS[i];
  return t.topPct === null ? 0 : 100 - t.topPct;
}

export interface RankResult {
  /** Puntaje continuo: tier*3 + 3·(avance dentro del rango). Hierro I ≈ 0, Simétrico = 24. */
  score: number;
  /** Escalón entero: tier*3 + nivel (0-based). */
  step: number;
  tierIndex: number;
  tier: RankTierDef;
  /** 1, 2 ó 3; null en rangos sin niveles (Simétrico). */
  level: 1 | 2 | 3 | null;
  /** "PLATA III". */
  label: string;
  percentile: number;
}

/** Último escalón posible (Simétrico, sin niveles). */
export const MAX_STEP = (RANK_TIER_DEFS.length - 1) * LEVELS_PER_TIER;

export function rankFromPercentile(pct: number): RankResult {
  const p = Math.max(0, Math.min(99.999, pct));
  let tierIndex = 0;
  for (let i = RANK_TIER_DEFS.length - 1; i >= 0; i--) {
    if (p >= tierStartPercentile(i)) {
      tierIndex = i;
      break;
    }
  }
  const tier = RANK_TIER_DEFS[tierIndex];
  const next = RANK_TIER_DEFS[tierIndex + 1] ? tierStartPercentile(tierIndex + 1) : 100;
  const frac = tier.levels ? Math.min(0.9999, (p - tierStartPercentile(tierIndex)) / (next - tierStartPercentile(tierIndex))) : 0;
  const levelIdx = tier.levels ? Math.min(2, Math.floor(frac * LEVELS_PER_TIER)) : 0;
  const step = tierIndex * LEVELS_PER_TIER + (tier.levels ? levelIdx : 0);
  const score = tierIndex * LEVELS_PER_TIER + frac * LEVELS_PER_TIER;
  return makeRank(step, score, p);
}

function makeRank(step: number, score: number, percentile: number): RankResult {
  const tierIndex = Math.min(RANK_TIER_DEFS.length - 1, Math.floor(step / LEVELS_PER_TIER));
  const tier = RANK_TIER_DEFS[tierIndex];
  const level = tier.levels ? ((step % LEVELS_PER_TIER) + 1) as 1 | 2 | 3 : null;
  return {
    score,
    step,
    tierIndex,
    tier,
    level,
    label: `${tier.name.toUpperCase()}${level ? ` ${LEVEL_ROMAN[level - 1]}` : ""}`,
    percentile,
  };
}

/** Rango a partir de un puntaje continuo (para promedios de músculos / grupos). */
export function rankFromScore(score: number): RankResult {
  const s = Math.max(0, Math.min(MAX_STEP, score));
  const tierIndex = Math.min(RANK_TIER_DEFS.length - 1, Math.floor(s / LEVELS_PER_TIER));
  const tier = RANK_TIER_DEFS[tierIndex];
  const step = tier.levels ? Math.min(MAX_STEP - 1, Math.floor(s)) : MAX_STEP;
  const lo = tierStartPercentile(tierIndex);
  const hi = RANK_TIER_DEFS[tierIndex + 1] ? tierStartPercentile(tierIndex + 1) : 100;
  const frac = tier.levels ? (s - tierIndex * LEVELS_PER_TIER) / LEVELS_PER_TIER : 0;
  return makeRank(step, s, lo + (hi - lo) * frac);
}

/** Percentil donde empieza un escalón (para saber cuánto falta para el siguiente nivel). */
export function stepStartPercentile(step: number): number {
  const tierIndex = Math.min(RANK_TIER_DEFS.length - 1, Math.floor(step / LEVELS_PER_TIER));
  const lo = tierStartPercentile(tierIndex);
  if (!RANK_TIER_DEFS[tierIndex].levels) return lo;
  const hi = tierStartPercentile(tierIndex + 1);
  return lo + ((hi - lo) * (step % LEVELS_PER_TIER)) / LEVELS_PER_TIER;
}

// ---------------------------------------------------------------------------
// Un ejercicio
// ---------------------------------------------------------------------------

export interface ResolvedStandard {
  standard: Standard;
  /** El valor levantado se divide por esto antes de compararlo (1 en estándares directos). */
  factor: number;
  /** true si el ejercicio se deriva de otro (no tiene tabla propia). */
  estimated: boolean;
}

export function standardForExercise(exerciseId: string): ResolvedStandard | null {
  const direct = DIRECT[exerciseId];
  if (direct && STANDARDS[direct]) return { standard: STANDARDS[direct], factor: 1, estimated: false };
  const d = DERIVED[exerciseId];
  if (d && STANDARDS[d.base]) return { standard: STANDARDS[d.base], factor: d.factor, estimated: true };
  return null;
}

export interface Performance {
  /** kg del set elegido (0 en ejercicios de peso corporal). */
  peso: number;
  reps: number;
  /** Valor comparable: 1RM estimado (kg) o repeticiones máximas (reps). */
  value: number;
  capped: boolean;
}

/** Mejor serie de un ejercicio en el historial (series completadas, sin calentamiento). */
export function bestPerformance(exerciseId: string, sessions: WorkoutSession[], kind: "kg" | "reps"): Performance | null {
  let best: Performance | null = null;
  for (const session of sessions) {
    for (const ex of session.ejercicios) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets as WorkoutSet[]) {
        if (!set.completado || set.tipo === "calentamiento" || !(set.reps > 0)) continue;
        let perf: Performance;
        if (kind === "reps") {
          perf = { peso: 0, reps: set.reps, value: set.reps, capped: false };
        } else {
          if (!(set.peso > 0)) continue;
          const e = estimate1RM(set.peso, set.reps);
          perf = { peso: set.peso, reps: set.reps, value: e.value, capped: e.capped };
        }
        if (!best || perf.value > best.value) best = perf;
      }
    }
  }
  return best;
}

export interface ExerciseRank {
  exerciseId: string;
  rank: RankResult;
  estimated: boolean;
  performance: Performance;
  kind: "kg" | "reps";
  /** Qué hace falta para el siguiente nivel (null si ya es el máximo). */
  next: { label: string; value: number; missing: number } | null;
  /** true si este rango sale de una corrección manual (calculadora → "Reemplazar en el rango") en vez
   * de la mejor serie del historial — ver `RankOverride`. */
  overridden?: boolean;
}

/** Corrección manual de un ejercicio: pisa la mejor serie del historial (`bestPerformance`) para ESE
 * ejercicio sin borrar ni tocar ninguna serie registrada — pensado para cuando una marca mal anotada
 * (p. ej. un peso tipeado de más) infla el rango y el usuario prefiere decir "en realidad es este" en
 * vez de tener que encontrar y corregir la serie exacta en su historial. Opt-in: la calculadora de
 * rango SOLO la crea si el usuario toca "Reemplazar en el rango" — nunca automáticamente. */
export interface RankOverride {
  peso: number;
  reps: number;
  value: number;
  setAt: number;
}

export interface BodyInfo {
  sexo: Sex;
  pesoKg: number;
}

/** Rango de un valor ya calculado (1RM en kg o repeticiones) contra el estándar resuelto de un ejercicio. */
export function rankFromValue(res: ResolvedStandard, value: number, body: BodyInfo): { rank: RankResult; next: ExerciseRank["next"] } {
  const anchors = anchorsFor(res.standard, body.sexo, body.pesoKg);
  const rank = rankFromPercentile(valueToPercentile(value / res.factor, anchors));
  let next: ExerciseRank["next"] = null;
  if (rank.step < MAX_STEP) {
    const nextStep = rank.step + 1;
    const needed = percentileToValue(stepStartPercentile(nextStep), anchors) * res.factor;
    const nextRank = makeRank(nextStep, nextStep, stepStartPercentile(nextStep));
    next = { label: nextRank.label, value: needed, missing: Math.max(0, needed - value) };
  }
  return { rank, next };
}

export function rankExercise(
  exerciseId: string,
  sessions: WorkoutSession[],
  body: BodyInfo,
  override?: RankOverride | null,
): ExerciseRank | null {
  const res = standardForExercise(exerciseId);
  if (!res) return null;
  const perf: Performance | null = override
    ? { peso: override.peso, reps: override.reps, value: override.value, capped: false }
    : bestPerformance(exerciseId, sessions, res.standard.kind);
  if (!perf || !(perf.value > 0)) return null;
  const { rank, next } = rankFromValue(res, perf.value, body);
  return { exerciseId, rank, estimated: res.estimated, performance: perf, kind: res.standard.kind, next, overridden: !!override };
}

/** Peso a poner en la barra para alcanzar un 1RM objetivo haciendo `reps` repeticiones (inversa de Epley). */
export function weightForOneRepMax(target1RM: number, reps: number): number {
  const r = Math.min(Math.max(1, reps), REPS_CAP);
  return r <= 1 ? target1RM : target1RM / (1 + r / 30);
}

// ---------------------------------------------------------------------------
// Músculos, grupos y rango general
// ---------------------------------------------------------------------------

export interface AggregateRank {
  rank: RankResult | null;
  /** Ejercicios / músculos con rango sobre el total posible, para mostrar cobertura. */
  rated: number;
  total: number;
}

export interface RankProfile {
  byExercise: Record<string, ExerciseRank>;
  byMuscle: Record<string, AggregateRank>;
  byGroup: Record<string, AggregateRank>;
  general: AggregateRank;
}

export interface ExerciseLite {
  id: string;
  categoria: string;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeRankProfile(input: {
  exercises: ExerciseLite[];
  sessions: WorkoutSession[];
  body: BodyInfo;
  /** Ejercicios que el usuario sacó del rango global (siguen teniendo su rango, pero no suman a músculo/grupo/general). */
  excluded?: string[];
  /** Correcciones manuales por ejercicio — ver `RankOverride`. */
  overrides?: Record<string, RankOverride>;
}): RankProfile {
  const { exercises, sessions, body } = input;
  const excluded = new Set(input.excluded ?? []);
  const overrides = input.overrides ?? {};
  const byExercise: Record<string, ExerciseRank> = {};
  for (const ex of exercises) {
    const r = rankExercise(ex.id, sessions, body, overrides[ex.id]);
    if (r) byExercise[ex.id] = r;
  }

  const byMuscle: Record<string, AggregateRank> = {};
  const categories = Array.from(new Set(exercises.map((e) => e.categoria))).filter((c) => c !== "Cardio");
  for (const cat of categories) {
    const inCat = exercises.filter((e) => e.categoria === cat);
    const scores = inCat
      .filter((e) => byExercise[e.id] && !excluded.has(e.id))
      .map((e) => byExercise[e.id].rank.score)
      .sort((a, b) => b - a)
      .slice(0, TOP_EXERCISES_PER_MUSCLE);
    byMuscle[cat] = {
      rank: scores.length ? rankFromScore(mean(scores)) : null,
      rated: inCat.filter((e) => byExercise[e.id]).length,
      total: inCat.length,
    };
  }

  const byGroup: Record<string, AggregateRank> = {};
  for (const g of RANK_GROUPS) {
    if (g.key === "cuerpo") continue;
    const muscles = g.categories.filter((c) => byMuscle[c]);
    const withRank = muscles.filter((c) => byMuscle[c].rank);
    byGroup[g.key] = {
      rank: withRank.length ? rankFromScore(mean(withRank.map((c) => byMuscle[c].rank!.score))) : null,
      rated: withRank.length,
      total: muscles.length,
    };
  }

  const groupsWithRank = Object.values(byGroup).filter((g) => g.rank);
  const general: AggregateRank = {
    rank: groupsWithRank.length ? rankFromScore(mean(groupsWithRank.map((g) => g.rank!.score))) : null,
    rated: groupsWithRank.length,
    total: Object.keys(byGroup).length,
  };
  return { byExercise, byMuscle, byGroup, general };
}

/** Qué datos del perfil faltan para poder calcular rangos. */
export function missingBodyInfo(profile: { sexo?: Sex; pesoKg?: number } | null | undefined): ("sexo" | "peso")[] {
  const out: ("sexo" | "peso")[] = [];
  if (!profile?.sexo) out.push("sexo");
  if (!(profile?.pesoKg && profile.pesoKg > 0)) out.push("peso");
  return out;
}
