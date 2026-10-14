import type { BodyMeasurementEntry, MuscleGroup } from "@/lib/types";

/**
 * IMC a partir de peso/altura ya cargados en `gymProfile` (nunca se piden de nuevo). Es un índice
 * aproximado, no un diagnóstico — así se muestra en la UI. Fórmula estándar: kg / m².
 */
export function imc(pesoKg: number, alturaCm: number): number | null {
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

export type ImcCategoria = "bajo_peso" | "normal" | "sobrepeso" | "obesidad";

/** Categorías estándar de la OMS (18.5 / 25 / 30) — informativas, nunca diagnóstico. */
export function imcCategoria(valor: number): ImcCategoria {
  if (valor < 18.5) return "bajo_peso";
  if (valor < 25) return "normal";
  if (valor < 30) return "sobrepeso";
  return "obesidad";
}

// ============================================================================
// Rango (Fase 3): qué perímetro de `BodyMeasurementEntry` corresponde a cada `MuscleGroup`, para
// mostrarlo junto al rango de ese músculo. Decisión propia, no una convención publicada: Tríceps y
// Bíceps comparten "brazo contraído" (el mismo perímetro del brazo), Cuádriceps y Femoral comparten
// "muslo" (ambos están en el mismo segmento). Hombros, Espalda, Antebrazo, Abductores y Aductores no
// tienen un perímetro propio en el formulario de perfil avanzado — quedan sin medida, nunca inventada.
// ============================================================================

export type MeasurementField = Exclude<keyof BodyMeasurementEntry, "id" | "date">;

const MUSCLE_TO_FIELD: Partial<Record<MuscleGroup, MeasurementField>> = {
  Pecho: "pechoCm",
  Biceps: "brazoContraidoCm",
  Triceps: "brazoContraidoCm",
  Cuadriceps: "musloCm",
  Femoral: "musloCm",
  Pantorrilla: "pantorrillaCm",
  Abdomen: "cinturaCm",
  Gluteos: "caderaCm",
};

/** `group` es `string` (no `MuscleGroup`) a propósito: la pantalla de Rango navega por una clave de
 * ruta libre que puede ser un músculo o un grupo (brazos, piernas) — un grupo o una clave desconocida
 * simplemente no tiene entrada en la tabla y devuelve `null`, nunca un error. */
export function measurementFieldForMuscle(group: string): MeasurementField | null {
  return (MUSCLE_TO_FIELD as Record<string, MeasurementField | undefined>)[group] ?? null;
}

export interface MuscleMeasurement {
  valueCm: number;
  date: string;
  /** cm respecto de la medición anterior con ese mismo campo; `undefined` si esta es la primera. */
  deltaCm?: number;
}

/** Última medición de un músculo (y la variación respecto de la anterior), a partir del historial
 * completo. `history` no necesita estar ordenado. `null` si el músculo no tiene perímetro propio o
 * nunca se cargó ese campo — nunca se inventa un valor. */
export function latestMuscleMeasurement(group: string, history: BodyMeasurementEntry[]): MuscleMeasurement | null {
  const field = measurementFieldForMuscle(group);
  if (!field) return null;
  const withValue = history
    .filter((e) => typeof e[field] === "number")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (withValue.length === 0) return null;
  const latest = withValue[0];
  const prev = withValue[1];
  const valueCm = latest[field] as number;
  return {
    valueCm,
    date: latest.date,
    deltaCm: prev ? Math.round((valueCm - (prev[field] as number)) * 10) / 10 : undefined,
  };
}
