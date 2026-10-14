/**
 * Nutriólogo (Fase 3): "este alimento me hace mal" — correlación ESTADÍSTICA SIMPLE DE CONTEO entre
 * síntomas reportados (`SymptomEntry`) y los alimentos comidos en las horas previas (`LoggedFood`).
 * NO es un modelo entrenado ni un test de alergia/intolerancia: cuenta, de las veces que se reportó un
 * síntoma, en cuántas aparecía cada alimento en la ventana previa. Módulo PURO (sin store, sin React).
 *
 * Límite duro: el resultado es un patrón a investigar en el propio registro, nunca un diagnóstico de
 * alergia o intolerancia — ver el texto fijo obligatorio en docs/ciencia-nutriologo.md.
 */
import type { LoggedFood, SymptomEntry } from "@/lib/types";

/** Ventana hacia atrás desde el síntoma reportado en la que un alimento cuenta como "comido antes de
 * sentirte así" — convención propia (no hay una fuente clínica de cuánto tarda cada síntoma en
 * aparecer; varía mucho por persona y por síntoma), documentada en docs/ciencia-nutriologo.md. */
export const CORRELATION_WINDOW_HOURS = 4;

/** Mínimo de veces que se reportó un síntoma dado para empezar a mostrar un patrón — con menos, se le
 * pide al usuario seguir registrando en vez de mostrar algo poco confiable. */
export const MIN_SYMPTOM_OCCURRENCES = 5;

export interface FoodSymptomCorrelation {
  foodId: string;
  /** Nombre del alimento en la última vez que apareció (puede variar si el usuario lo renombra). */
  nombre: string;
  /** En cuántas de las `totalOcurrencias` apariciones del síntoma este alimento estaba en la ventana previa. */
  coincidencias: number;
  totalOcurrencias: number;
}

export interface SymptomPatternResult {
  kind: string;
  totalOcurrencias: number;
  /** false = menos de `MIN_SYMPTOM_OCCURRENCES` reportes de este síntoma: no hay patrón confiable todavía. */
  datosSuficientes: boolean;
  /** Ordenado de mayor a menor coincidencia. Vacío si `datosSuficientes` es false. */
  alimentos: FoodSymptomCorrelation[];
}

/** Para un tipo de síntoma, cuenta cuántas veces cada alimento comido apareció dentro de las
 * `CORRELATION_WINDOW_HOURS` previas a cada reporte de ese síntoma. Un alimento comido dos veces antes
 * del MISMO reporte cuenta una sola vez (lo que importa es en cuántos reportes distintos apareció, no
 * cuántas porciones). */
export function correlateSymptom(
  kind: string,
  symptomEntries: SymptomEntry[],
  loggedFoods: LoggedFood[],
): SymptomPatternResult {
  const occurrences = symptomEntries.filter((s) => s.kind === kind);
  const totalOcurrencias = occurrences.length;
  const datosSuficientes = totalOcurrencias >= MIN_SYMPTOM_OCCURRENCES;

  if (!datosSuficientes) {
    return { kind, totalOcurrencias, datosSuficientes, alimentos: [] };
  }

  const windowMs = CORRELATION_WINDOW_HOURS * 60 * 60 * 1000;
  const counts = new Map<string, { nombre: string; coincidencias: number }>();

  for (const occ of occurrences) {
    // La ventana se mide desde el momento en que se REPORTÓ el síntoma (`occ.timestamp`), no desde el
    // alimento ligado (`loggedFoodId` identifica cuál comida disparó el registro, no el ancla de la
    // ventana) — así un alimento comido horas antes de ese ancla igual puede quedar fuera de la ventana.
    const anchorTs = occ.timestamp;
    const seenThisOccurrence = new Set<string>();
    for (const f of loggedFoods) {
      if (f.timestamp > anchorTs || f.timestamp < anchorTs - windowMs) continue;
      if (seenThisOccurrence.has(f.foodId)) continue;
      seenThisOccurrence.add(f.foodId);
      const entry = counts.get(f.foodId) ?? { nombre: f.nombre, coincidencias: 0 };
      entry.coincidencias += 1;
      entry.nombre = f.nombre;
      counts.set(f.foodId, entry);
    }
  }

  const alimentos: FoodSymptomCorrelation[] = [...counts.entries()]
    .map(([foodId, v]) => ({ foodId, nombre: v.nombre, coincidencias: v.coincidencias, totalOcurrencias }))
    .sort((a, b) => b.coincidencias - a.coincidencias);

  return { kind, totalOcurrencias, datosSuficientes, alimentos };
}

/** Todos los tipos de síntoma que ya tienen al menos un reporte, cada uno con su propia correlación. */
export function correlateAllSymptoms(symptomEntries: SymptomEntry[], loggedFoods: LoggedFood[]): SymptomPatternResult[] {
  const kinds = [...new Set(symptomEntries.map((s) => s.kind))];
  return kinds.map((k) => correlateSymptom(k, symptomEntries, loggedFoods));
}
