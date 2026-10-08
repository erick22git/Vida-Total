import type { Exercise, MuscleGroup, RoutineExercise } from "@/lib/types";

export interface MuscleShare {
  categoria: string;
  /** Porcentaje entero; todos los músculos de una rutina suman exactamente 100. */
  pct: number;
}

/** Método de "series fraccionadas": una serie cuenta 1 para el músculo principal del ejercicio y 0.5
 * para cada músculo secundario (series indirectas). Es el método con mejor ajuste en los
 * metaanálisis de Pelland et al., Sports Medicine (doi 10.1007/s40279-025-02344-w): 'fractional'
 * (indirectas × 0.5) superó a 'total' (2×Log(BF) = 9.48) y a 'direct' (10.29) para hipertrofia. */
const DIRECT = 1;
const INDIRECT = 0.5;

/** Músculos secundarios del dataset (texto libre) -> grupo muscular de la app. `null` = no se cuenta. */
function secondaryToGroup(raw: string): MuscleGroup | null {
  const n = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (/^cu.?driceps$/.test(n) || n === "piernas") return "Cuadriceps";
  switch (n) {
    case "hombros": return "Hombros";
    case "isquiotibiales": return "Femoral";
    case "triceps": return "Triceps";
    case "biceps": return "Biceps";
    case "gluteos": return "Gluteos";
    case "gemelos":
    case "tibial anterior": return "Pantorrilla";
    case "antebrazo":
    case "antebrazos": return "Antebrazo";
    case "trapecio":
    case "espalda":
    case "espalda media":
    case "espalda baja":
    case "dorsal ancho":
    case "lumbar": return "Espalda";
    case "pectoral":
    case "pecho": return "Pecho";
    case "abdomen":
    case "core": return "Abdomen";
    case "aductores de cadera": return "Aductores";
    case "abductores de cadera": return "Abductores";
    case "cardio": return "Cardio";
    default: return null;
  }
}

/**
 * Qué músculos trabaja una rutina y cuánto, sobre 100%. Cuenta series fraccionadas: cada serie suma 1
 * al músculo principal del ejercicio y 0.5 a cada secundario (un press de banca = 1 de Pecho + 0.5 de
 * Tríceps + 0.5 de Hombros). Los totales por músculo se pasan a porcentaje sobre 100 con el método del
 * mayor resto, de mayor a menor. Es una estimación del reparto del VOLUMEN, no una medida fisiológica
 * exacta de cuánto trabaja cada músculo.
 */
export function muscleParticipation(ejercicios: RoutineExercise[], allExercises: Exercise[]): MuscleShare[] {
  const points = new Map<string, number>();
  for (const rex of ejercicios) {
    const ex = allExercises.find((e) => e.id === rex.exerciseId);
    if (!ex) continue;
    const secondaries = [...new Set(ex.musculosSecundarios.map(secondaryToGroup).filter((g): g is MuscleGroup => !!g && g !== ex.categoria))];
    const sets = rex.sets.length;
    points.set(ex.categoria, (points.get(ex.categoria) ?? 0) + sets * DIRECT);
    for (const g of secondaries) points.set(g, (points.get(g) ?? 0) + sets * INDIRECT);
  }
  const total = [...points.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const raw = [...points].map(([categoria, v]) => ({ categoria, exact: (v / total) * 100 }));
  const floors = raw.map((r) => ({ ...r, pct: Math.floor(r.exact) }));
  let missing = 100 - floors.reduce((s, r) => s + r.pct, 0);
  [...floors]
    .sort((a, b) => b.exact - b.pct - (a.exact - a.pct))
    .forEach((r) => {
      if (missing > 0) {
        r.pct++;
        missing--;
      }
    });
  return floors
    .map(({ categoria, pct }) => ({ categoria, pct }))
    .filter((r) => r.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}
