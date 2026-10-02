import type { Exercise, MuscleGroup, RoutineExercise } from "@/lib/types";

export interface MuscleShare {
  categoria: string;
  /** Porcentaje entero; todos los músculos de una rutina suman exactamente 100. */
  pct: number;
}

/** Lo que aporta el músculo principal de un ejercicio cuando además tiene músculos secundarios. */
const PRIMARY_WEIGHT = 0.65;

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
    case "gemelos": return "Pantorrilla";
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
 * Qué músculos trabaja una rutina y cuánto, sobre 100%. Cada serie reparte su "esfuerzo" entre el
 * músculo principal del ejercicio (65%, o 100% si no tiene secundarios) y sus secundarios (el resto,
 * en partes iguales) — así un press de banca suma Pecho pero también Tríceps y Hombros, en vez de
 * contar todo para un solo grupo. Se normaliza a 100 con el método del mayor resto, ordenado de
 * mayor a menor.
 */
export function muscleParticipation(ejercicios: RoutineExercise[], allExercises: Exercise[]): MuscleShare[] {
  const points = new Map<string, number>();
  for (const rex of ejercicios) {
    const ex = allExercises.find((e) => e.id === rex.exerciseId);
    if (!ex) continue;
    const secondaries = [...new Set(ex.musculosSecundarios.map(secondaryToGroup).filter((g): g is MuscleGroup => !!g && g !== ex.categoria))];
    const sets = rex.sets.length;
    const primary = secondaries.length > 0 ? PRIMARY_WEIGHT : 1;
    points.set(ex.categoria, (points.get(ex.categoria) ?? 0) + sets * primary);
    for (const g of secondaries) {
      points.set(g, (points.get(g) ?? 0) + (sets * (1 - PRIMARY_WEIGHT)) / secondaries.length);
    }
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
