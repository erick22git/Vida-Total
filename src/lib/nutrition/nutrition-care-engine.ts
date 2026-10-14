/**
 * Nutriólogo virtual — Nutrition Care Process (NCP), el marco de 4 pasos de la Academy of Nutrition
 * and Dietetics (eatrightPRO, "Nutrition Care Process", consultado 2026-10-14): Evaluación →
 * Diagnóstico nutricional → Intervención → Monitoreo. Módulo PURO (sin store, sin React), mismo
 * patrón que `hypertrophy-engine.ts` y `calorie-state.ts`.
 *
 * LÍMITE DURO: esto diagnostica PATRONES DE INGESTA contra las DRI/UL ya citadas en
 * docs/ciencia-nutricion.md — nunca una enfermedad. Ver docs/ciencia-nutriologo.md para fuentes.
 */
import type { LoggedFood, WeightEntry } from "@/lib/types";
import { activeLoggedFoods } from "@/lib/food-utils";
import { getNutrientTargets, type TargetProfile } from "./nutrient-targets";
import { MICRO_REFS } from "./nutrient-reference-data";
import type { AdaptiveCalorieResult } from "@/lib/gym/calorie-adaptive";

export const MIN_WINDOW_DAYS = 7;
export const RECOMMENDED_WINDOW_DAYS = 14;
/** De los días de la ventana, cuántos necesitan al menos un registro para que el patrón cuente como consistente. */
const MIN_LOGGED_DAYS_FRACTION = 0.7;
/** Días bajo la RDA/AI (o sobre el UL) dentro de la ventana para marcar el patrón como sostenido, no ruido de un día. */
const SUSTAINED_FRACTION = 0.6;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** "yyyy-MM-dd" (UTC) que es `n` días antes de `from` — aritmética en UTC (`setUTCDate`), nunca en hora
 * local: usar `setDate` local y comparar contra objetos `Date` en milisegundos (como hacía antes esta
 * función) dejaba el día MÁS VIEJO de la ventana afuera por una carrera de milisegundos entre el
 * momento en que se arma el dato de prueba y el momento en que `evaluate()` llama a `new Date()` — un
 * registro de exactamente "hace `windowDays-1` días" podía quedar excluido por unos pocos ms, de forma
 * no determinística (detectado con una prueba real, no mockeada: `tools/nutrition/window_real_dates_test.ts`).
 * Con comparación de STRINGS "yyyy-MM-dd" el orden lexicográfico ES el orden cronológico, sin esa
 * ambigüedad de milisegundos ni de huso horario — mismo criterio ya usado en `hypertrophy-engine.ts`. */
function dayKeyNDaysBefore(from: Date, n: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return dayKey(d.getTime());
}

// ============================================================================
// Paso 1: Evaluación — promedios diarios de la ventana.
// ============================================================================

export interface NutrientDayValue {
  dateKey: string;
  value: number;
}

export interface EvaluationInput {
  loggedFoods: LoggedFood[];
  weightEntries: WeightEntry[];
  profile: TargetProfile;
  windowDays?: number;
  today?: Date;
}

export interface NutrientEvaluation {
  id: string;
  nombre: string;
  unidad: string;
  promedioDiario: number;
  diasConDato: number;
  diasEnVentana: number;
}

export interface EvaluationResult {
  windowDays: number;
  loggedDays: number;
  /** Fracción de días de la ventana con al menos un registro de comida. */
  adherenciaRegistro: number;
  /** false = ventana con muy pocos días registrados; el diagnóstico (paso 2) no debe usar este resultado. */
  datosSuficientes: boolean;
  nutrientes: Record<string, NutrientEvaluation>;
  pesoTendenciaKg: number | null;
}

/** Agrega los registros de comida de la ventana en un promedio diario por nutriente (incluye macros,
 * ya presentes en `LoggedFood`, y los micronutrientes de `FoodMicronutrients` vía `extras` del alimento
 * resuelto — este motor solo recibe lo que ya viene en `LoggedFood`, que trae macros pero no
 * micronutrientes crudos; por eso solo evalúa calorías/proteína/carbos/grasas con este input y deja los
 * micronutrientes para cuando la pantalla los pase ya resueltos (ver nota en `evaluate`). */
export function evaluate(input: EvaluationInput): EvaluationResult {
  const today = input.today ?? new Date();
  const windowDays = input.windowDays ?? RECOMMENDED_WINDOW_DAYS;
  const todayKey = dayKey(today.getTime());
  const windowStartKey = dayKeyNDaysBefore(today, windowDays - 1);

  const foods = activeLoggedFoods(input.loggedFoods).filter((f) => {
    const k = dayKey(f.timestamp);
    return k >= windowStartKey && k <= todayKey;
  });

  const byDay = new Map<string, LoggedFood[]>();
  for (const f of foods) {
    const k = dayKey(f.timestamp);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(f);
  }
  const loggedDays = byDay.size;
  const adherenciaRegistro = loggedDays / windowDays;
  const datosSuficientes = windowDays >= MIN_WINDOW_DAYS && adherenciaRegistro >= MIN_LOGGED_DAYS_FRACTION;

  function avgOf(pick: (f: LoggedFood) => number | undefined): NutrientDayValue[] {
    const byDayValues: NutrientDayValue[] = [];
    for (const [k, list] of byDay) {
      const sum = list.reduce((acc, f) => acc + (pick(f) ?? 0), 0);
      byDayValues.push({ dateKey: k, value: sum });
    }
    return byDayValues;
  }

  function nutrientEval(id: string, nombre: string, unidad: string, pick: (f: LoggedFood) => number | undefined): NutrientEvaluation {
    const values = avgOf(pick);
    const promedioDiario = values.length > 0 ? values.reduce((a, b) => a + b.value, 0) / windowDays : 0;
    return { id, nombre, unidad, promedioDiario, diasConDato: values.length, diasEnVentana: windowDays };
  }

  const nutrientes: Record<string, NutrientEvaluation> = {
    calorias: nutrientEval("calorias", "Calorías", "kcal", (f) => f.calorias),
    proteina: nutrientEval("proteina", "Proteína", "g", (f) => f.proteina),
    carbos: nutrientEval("carbos", "Carbohidratos", "g", (f) => f.carbos),
    grasas: nutrientEval("grasas", "Grasas", "g", (f) => f.grasas),
  };

  const weightByDay = new Map<string, number[]>();
  for (const w of input.weightEntries) {
    const k = dayKey(new Date(w.date).getTime());
    if (k < windowStartKey || k > todayKey) continue;
    if (!weightByDay.has(k)) weightByDay.set(k, []);
    weightByDay.get(k)!.push(w.kg);
  }
  const weightAverages = [...weightByDay.values()].map((vals) => vals.reduce((a, b) => a + b, 0) / vals.length);
  const pesoTendenciaKg = weightAverages.length > 0 ? weightAverages.reduce((a, b) => a + b, 0) / weightAverages.length : null;

  return { windowDays, loggedDays, adherenciaRegistro, datosSuficientes, nutrientes, pesoTendenciaKg };
}

// ============================================================================
// Paso 2: Diagnóstico nutricional — formato PES (Problema, Etiología, Signos/síntomas), SIEMPRE sobre
// patrón de ingesta vs. DRI/UL, nunca una enfermedad. Compara contra `getNutrientTargets` ya citado.
// ============================================================================

export type DiagnosisKind = "riesgo_inadecuado" | "riesgo_exceso";

export interface NutritionDiagnosis {
  kind: DiagnosisKind;
  nutrientId: string;
  nutrientNombre: string;
  /** Problema en formato PES, lenguaje claro (no jerga). */
  problema: string;
  /** Etiología: relacionado con qué patrón de ingesta. */
  etiologia: string;
  /** Signos: la magnitud observada, en formato "X de Y días". */
  signos: string;
  diasFueraDeRango: number;
  diasEnVentana: number;
  promedioObservado: number;
  valorReferencia: number;
  unidad: string;
}

/** Diagnostica patrones de ingesta sostenidos de la evaluación. Nunca corre con `datosSuficientes: false`
 * (ventana insuficiente) — devuelve `[]` en ese caso, documentado así para no forzar un diagnóstico
 * con pocos días. Necesita los micronutrientes ya resueltos aparte (`microDailyTotals`: total del día,
 * un número por cada día CON registro de la ventana, en el mismo orden que importa poco porque solo se
 * cuenta) porque `LoggedFood` no trae micronutrientes crudos en este store — la pantalla los calcula con
 * los mismos alimentos resueltos que usa el contador de Calorías y se los pasa a esta función. Un
 * nutriente se diagnostica solo si el patrón está SOSTENIDO (`SUSTAINED_FRACTION` de los días con
 * registro), no por el promedio solo — un día malo aislado no alcanza. */
export function diagnose(
  evaluation: EvaluationResult,
  targets: ReturnType<typeof getNutrientTargets>,
  microDailyTotals: Record<string, number[]>,
): NutritionDiagnosis[] {
  if (!evaluation.datosSuficientes) return [];
  const out: NutritionDiagnosis[] = [];

  for (const m of MICRO_REFS) {
    const target = targets.targets[m.id];
    if (!target || target.sinDatoEnAlimentos) continue;
    const days = microDailyTotals[m.id];
    if (!days || days.length === 0) continue;
    const diasEnVentana = days.length;
    const promedioObservado = days.reduce((a, b) => a + b, 0) / diasEnVentana;

    if (target.sentido === "meta" && target.objetivo > 0) {
      const diasBajo = days.filter((v) => v < target.objetivo).length;
      if (diasBajo / diasEnVentana >= SUSTAINED_FRACTION && promedioObservado < target.objetivo) {
        const pct = Math.round((promedioObservado / target.objetivo) * 100);
        out.push({
          kind: "riesgo_inadecuado",
          nutrientId: m.id,
          nutrientNombre: m.nombre,
          problema: `Riesgo de ingesta inadecuada de ${m.nombre}`,
          etiologia: `Ingesta sostenida por debajo de la ${target.tipo} de ${m.nombre}`,
          signos: `${diasBajo} de ${diasEnVentana} días por debajo de la ${target.tipo} (promedio ${r1(promedioObservado)} ${m.unidad} de ${target.objetivo} ${m.unidad}, ${pct} %)`,
          diasFueraDeRango: diasBajo,
          diasEnVentana,
          promedioObservado,
          valorReferencia: target.objetivo,
          unidad: m.unidad,
        });
      }
    }

    if (target.ul) {
      const diasSobre = days.filter((v) => v > target.ul!).length;
      if (diasSobre / diasEnVentana >= SUSTAINED_FRACTION) {
        out.push({
          kind: "riesgo_exceso",
          nutrientId: m.id,
          nutrientNombre: m.nombre,
          problema: `Riesgo de exceso de ${m.nombre}`,
          etiologia: `Ingesta sostenida por encima del nivel máximo tolerable (UL) de ${m.nombre}`,
          signos: `${diasSobre} de ${diasEnVentana} días por encima del UL (promedio ${r1(promedioObservado)} ${m.unidad} de un UL de ${target.ul} ${m.unidad})`,
          diasFueraDeRango: diasSobre,
          diasEnVentana,
          promedioObservado,
          valorReferencia: target.ul,
          unidad: m.unidad,
        });
      }
    }
  }

  return out;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ============================================================================
// Paso 3: Intervención — sugerencia accionable, siempre Aceptar/Descartar (nunca cambia metas sola).
// ============================================================================

export interface NutrientIntervention {
  nutrientId: string;
  mensaje: string;
  /** Alimentos de la propia base del usuario que subirían este nutriente (ids a resolver en la pantalla). */
  alimentosSugeridosIds: string[];
}

/** Arma el mensaje de intervención para un diagnóstico de inadecuación — qué alimentos (ya elegidos por
 * la pantalla, que conoce la base completa) y cuánto haría falta agregar. Pura composición de texto:
 * no decide alimentos (eso requiere buscar en la base, fuera de este módulo puro). */
export function buildIntervention(diagnosis: NutritionDiagnosis, alimentosSugeridosIds: string[]): NutrientIntervention {
  const falta = r1(Math.max(0, diagnosis.valorReferencia - diagnosis.promedioObservado));
  return {
    nutrientId: diagnosis.nutrientId,
    mensaje: `Para cerrar la brecha de ${diagnosis.nutrientNombre} te faltarían unos ${falta} ${diagnosis.unidad} más por día.`,
    alimentosSugeridosIds,
  };
}

/** Fase 2: "peso que no avanza" — el nutriólogo NO reimplementa el ajuste adaptativo de calorías (ya
 * existe completo en `calorie-adaptive.ts`, con su propia UI de Aceptar/Descartar en Ajustes de
 * Calorías): esta función solo decide si ese resultado se muestra como una intervención más del
 * nutriólogo, para no duplicar el cálculo de TDEE real en dos lugares. Devuelve `null` cuando no hay
 * nada que ofrecer (datos insuficientes o la meta ya está bien calibrada) — ver docs/ciencia-nutriologo.md
 * para por qué no se construyó una estimación de calorías quemadas por entrenamiento aparte. */
export interface CalorieGoalIntervention {
  mensaje: string;
  suggestedCalorieGoal: number;
}

export function calorieGoalIntervention(adaptive: AdaptiveCalorieResult): CalorieGoalIntervention | null {
  if (adaptive.status !== "suggestion" || adaptive.suggestedCalorieGoal === undefined) return null;
  return { mensaje: adaptive.mensaje, suggestedCalorieGoal: adaptive.suggestedCalorieGoal };
}

// ============================================================================
// Paso 4: Monitoreo — re-evalúa tras la misma ventana para ver si el patrón mejoró.
// ============================================================================

export type MonitoringStatus = "mejoro" | "igual" | "empeoro" | "sin_comparar";

export interface MonitoringResult {
  status: MonitoringStatus;
  anterior: number;
  actual: number;
}

/** Compara el promedio observado anterior (al momento del diagnóstico) contra el actual, mismo criterio
 * de "meta"/"límite" que el diagnóstico original. `toleranciaPct` evita marcar "empeoró" por ruido. */
export function monitor(diagnosis: NutritionDiagnosis, promedioActual: number, toleranciaPct = 0.05): MonitoringResult {
  const anterior = diagnosis.promedioObservado;
  const diffPct = anterior !== 0 ? (promedioActual - anterior) / Math.abs(anterior) : 0;
  if (Math.abs(diffPct) <= toleranciaPct) return { status: "igual", anterior, actual: promedioActual };
  const haciaReferencia =
    diagnosis.kind === "riesgo_inadecuado" ? promedioActual > anterior : promedioActual < anterior;
  return { status: haciaReferencia ? "mejoro" : "empeoro", anterior, actual: promedioActual };
}
