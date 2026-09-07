export type ModuleId =
  | "home"
  | "gym"
  | "habitos"
  | "outfit"
  | "paz-mental"
  | "finanzas"
  | "voz";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  href: string;
  color: string; // css var name, e.g. "--gym"
  icon: string; // lucide icon name, resolved in nav components
}

export type MuscleGroup =
  | "Pecho"
  | "Espalda"
  | "Hombros"
  | "Biceps"
  | "Triceps"
  | "Piernas"
  | "Abdomen"
  | "Gluteos"
  | "Cardio";

export type Difficulty = "Principiante" | "Intermedio" | "Avanzado";

export interface Exercise {
  id: string;
  nombre: string;
  categoria: MuscleGroup;
  musculoPrimario: string;
  musculosSecundarios: string[];
  equipo: string;
  nivel: Difficulty;
  instrucciones: string[];
  imagen?: string;
}

export interface Food {
  id: string;
  nombre: string;
  categoria: string;
  porcion: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

export type MealType = "desayuno" | "almuerzo" | "cena" | "snacks";

export interface LoggedFood {
  id: string;
  foodId: string;
  nombre: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  meal: MealType;
  timestamp: number;
}

export interface WaterEntry {
  id: string;
  ml: number;
  timestamp: number;
}

export type SetType = "normal" | "calentamiento" | "descendente" | "fallo";

export interface WorkoutSet {
  id: string;
  peso: number;
  reps: number;
  completado: boolean;
  fallo: boolean;
  tipo?: SetType;
  soloReps?: boolean;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  nota?: string;
  restSeconds?: number;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO date
  grupoMuscular: MuscleGroup;
  ejercicios: WorkoutExerciseLog[];
  completado: boolean;
  nombre?: string;
  durationSeconds?: number;
  routineId?: string;
}

export type Rank = "Bronce" | "Plata" | "Oro" | "Platino" | "Sin rango";

export interface WeeklyPlanDay {
  day: string; // "L" | "M" | "X" | "J" | "V" | "S" | "D"
  grupoMuscular: MuscleGroup | "Descanso";
  routineId?: string;
}

// ---------- Exercise type (peso/reps vs solo reps vs tiempo) ----------
export type ExerciseInputType = "peso_reps" | "solo_reps" | "tiempo";

// ---------- Routines ----------
export interface RoutineSetPlan {
  peso: number;
  reps: number;
  tipo: SetType;
}

export interface RoutineExercise {
  exerciseId: string;
  sets: RoutineSetPlan[];
  nota?: string;
  soloReps?: boolean;
}

export interface Routine {
  id: string;
  nombre: string;
  ejercicios: RoutineExercise[];
  createdAt: number;
  timesCompleted: number;
}

// ---------- Weight tracker ----------
export interface WeightEntry {
  id: string;
  kg: number;
  date: string; // ISO date
}

// ---------- Rank / SP per exercise ----------
export interface ExerciseRankMeta {
  includeInGlobal: boolean;
}

// ---------- Weekly training plans (planificaciones) ----------
export interface TrainingPlan {
  id: string;
  nombre: string;
  contexto: string; // e.g. "Gimnasio comercial · 5 días/semana"
  categoria: string; // "En el Gym" | "Calistenia" | ...
  dias: WeeklyPlanDay[];
  activo?: boolean;
  createdAt: number;
  daysPerWeek: number;
  minsPerSession: number;
}
