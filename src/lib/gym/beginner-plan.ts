import type { MuscleGroup, RoutineExercise, TrainingPlan, WeeklyPlanDay } from "@/lib/types";
import { DAY_LABELS } from "@/lib/data/weekly-plan";

/**
 * Rutina de principiante SUGERIDA: cuerpo completo, 3 días a la semana (lunes, miércoles, viernes), máquinas y mancuernas, pocas
 * series y técnica antes que peso. Se ofrece a quien entra por primera vez a Entrenamiento; la persona puede elegirla o armar la suya.
 * Los ejercicios son ids del catálogo propio (`exercises.json`). El peso queda en 0: lo elige cada quien.
 */
interface BeginnerExercise {
  exerciseId: string;
  series: number;
  reps: number;
  nota?: string;
}

interface BeginnerDay {
  nombre: string;
  grupoMuscular: MuscleGroup;
  ejercicios: BeginnerExercise[];
}

export const BEGINNER_DAYS: BeginnerDay[] = [
  {
    nombre: "Cuerpo completo A",
    grupoMuscular: "Cuadriceps",
    ejercicios: [
      { exerciseId: "sentadilla-goblet", series: 3, reps: 10 },
      { exerciseId: "press-banca-mancuernas", series: 3, reps: 10 },
      { exerciseId: "jalon-polea", series: 3, reps: 10 },
      { exerciseId: "press-militar-mancuernas", series: 2, reps: 10 },
      { exerciseId: "plancha", series: 3, reps: 30, nota: "30 segundos por serie" },
    ],
  },
  {
    nombre: "Cuerpo completo B",
    grupoMuscular: "Espalda",
    ejercicios: [
      { exerciseId: "prensa-piernas", series: 3, reps: 12 },
      { exerciseId: "press-banca-maquina", series: 3, reps: 10 },
      { exerciseId: "remo-sentado-polea", series: 3, reps: 10 },
      { exerciseId: "curl-biceps-mancuernas", series: 2, reps: 12 },
      { exerciseId: "extension-triceps-polea", series: 2, reps: 12 },
    ],
  },
  {
    nombre: "Cuerpo completo C",
    grupoMuscular: "Gluteos",
    ejercicios: [
      { exerciseId: "zancadas", series: 3, reps: 10 },
      { exerciseId: "remo-mancuerna", series: 3, reps: 10 },
      { exerciseId: "press-banca-mancuernas", series: 3, reps: 10 },
      { exerciseId: "hip-thrust", series: 3, reps: 10 },
      { exerciseId: "curl-martillo", series: 2, reps: 12 },
    ],
  },
];

/** Día de la semana (0 = lunes) en el que cae cada día de la rutina. */
const WEEK_SLOTS = [0, 2, 4];

interface Deps {
  saveRoutine: (nombre: string, ejercicios: RoutineExercise[]) => { id: string };
  createPlan: (plan: Omit<TrainingPlan, "id" | "createdAt">) => TrainingPlan;
}

/** Crea las 3 rutinas y el plan semanal propios (editables) y devuelve el plan. */
export function createBeginnerPlan(deps: Deps): TrainingPlan {
  const routineIds = BEGINNER_DAYS.map(
    (d) =>
      deps.saveRoutine(
        `Principiante · ${d.nombre}`,
        d.ejercicios.map((e) => ({
          exerciseId: e.exerciseId,
          nota: e.nota,
          sets: Array.from({ length: e.series }, () => ({ peso: 0, reps: e.reps, tipo: "normal" as const })),
        })),
      ).id,
  );
  const dias: WeeklyPlanDay[] = DAY_LABELS.map((day, i) => {
    const slot = WEEK_SLOTS.indexOf(i);
    if (slot === -1) return { day, grupoMuscular: "Descanso" };
    return { day, grupoMuscular: BEGINNER_DAYS[slot].grupoMuscular, routineId: routineIds[slot] };
  });
  return deps.createPlan({
    nombre: "Principiante · Cuerpo completo",
    contexto: "Gimnasio · 3 días/semana",
    categoria: "En el Gym",
    notas: "Rutina sugerida para empezar: cuerpo completo, lunes, miércoles y viernes. Elegí un peso con el que sientas que podrías hacer 2 repeticiones más.",
    dias,
    daysPerWeek: 3,
    minsPerSession: 45,
  });
}
