import type {
  AthleteExercise,
  AthletePlan,
  RoutineExercise,
  RoutineSetPlan,
  TrainingPlan,
  WeeklyPlanDay,
} from "@/lib/types";
import { DAY_LABELS } from "@/lib/data/weekly-plan";
import exercisesData from "@/lib/data/exercises.json";
import { formatRest, suggestRest } from "@/lib/training/rest-guidelines";
import type { Exercise } from "@/lib/types";

const CATALOG = exercisesData as Exercise[];

export const HEAVY_SET_GUIDE = "Serie pesada: cerca del fallo en las últimas 2–3 reps (buena técnica). No hay peso cargado: usá el tuyo.";

/** Tipos de serie que genera `toSets` para el ejercicio (normal / fallo / descendente). */
export function athleteSetTypes(ex: AthleteExercise): RoutineSetPlan["tipo"][] {
  return toSets(ex).map((s) => s.tipo);
}

export interface AthleteRest {
  seconds: number;
  /** "fuente" = lo da la fuente del atleta (manda); "guia" = guía por tipo de ejercicio y de serie. */
  origen: "fuente" | "guia";
  reason: string;
}

export function athleteExerciseRest(ex: AthleteExercise, catalog: Exercise[] = CATALOG): AthleteRest {
  if (ex.descansoSeg) return { seconds: ex.descansoSeg, origen: "fuente", reason: "dato de la fuente" };
  const s = suggestRest({
    exerciseId: ex.exerciseId,
    exercise: catalog.find((e) => e.id === ex.exerciseId),
    setTypes: athleteSetTypes(ex),
    seriePesada: ex.seriePesada,
  });
  return { seconds: s.seconds, origen: "guia", reason: s.reason };
}

function toSets(ex: AthleteExercise): RoutineSetPlan[] {
  const alFallo = Math.min(ex.seriesAlFallo ?? 0, ex.series);
  return Array.from({ length: ex.series }, (_, i) => {
    const esUltima = i === ex.series - 1;
    if (esUltima && ex.descendente) {
      // Mismo formato que el módulo de series descendentes: la primera bajada incluye el peso de la serie.
      return {
        peso: 0,
        reps: ex.repsMax,
        tipo: "descendente",
        pesosDescendentes: Array(ex.descendente.bajadas + 1).fill(0),
        repsDescendentes: Array(ex.descendente.bajadas).fill(0),
      };
    }
    return { peso: 0, reps: ex.repsPorSerie?.[i] ?? ex.repsMax, tipo: i >= ex.series - alFallo && alFallo > 0 ? "fallo" : "normal" };
  });
}

export function athleteExerciseToRoutine(ex: AthleteExercise): RoutineExercise {
  const rango = ex.repsMin === ex.repsMax ? `${ex.repsMax} reps` : `${ex.repsMin}–${ex.repsMax} reps`;
  const rest = athleteExerciseRest(ex);
  const partes = [
    rango,
    ex.tempo && `tempo ${ex.tempo}`,
    ex.descendente?.descripcion,
    ex.seriePesada && HEAVY_SET_GUIDE,
    `Descanso ${formatRest(rest.seconds)} (${rest.origen === "fuente" ? "según la fuente" : `guía: ${rest.reason}`})`,
    ex.nota,
  ].filter(Boolean);
  return {
    exerciseId: ex.exerciseId,
    sets: toSets(ex),
    nota: partes.join(" · "),
    restSeconds: rest.seconds,
    grupo: ex.grupo,
  };
}

interface CopyDeps {
  saveRoutine: (nombre: string, ejercicios: RoutineExercise[]) => { id: string };
  createPlan: (plan: Omit<TrainingPlan, "id" | "createdAt">) => TrainingPlan;
}

/** Copia una rutina de atleta (solo lectura) a Routine + TrainingPlan propios y editables. Devuelve el plan creado. */
export function copyAthletePlan(plan: AthletePlan, deps: CopyDeps): TrainingPlan {
  const routineIds = plan.dias.map((d) =>
    deps.saveRoutine(`${plan.atleta} · ${d.nombre}`, d.ejercicios.map(athleteExerciseToRoutine)).id,
  );
  const dias: WeeklyPlanDay[] = DAY_LABELS.map((day, i) => {
    const idx = plan.semana[i];
    if (idx == null) return { day, grupoMuscular: "Descanso" };
    return { day, grupoMuscular: plan.dias[idx].grupoMuscular, routineId: routineIds[idx] };
  });
  return deps.createPlan({
    nombre: `${plan.atleta}: ${plan.nombre}`,
    contexto: `Rutina de ${plan.atleta} · ${plan.diasPorSemana} días/semana`,
    categoria: "En el Gym",
    notas: `Copiada de la rutina de ${plan.atleta}. Fuente: ${plan.fuentes[0]?.titulo ?? "ver detalle"}.`,
    dias,
    daysPerWeek: plan.diasPorSemana,
    minsPerSession: plan.minsPorSesion,
  });
}
