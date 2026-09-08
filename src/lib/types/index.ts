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

export interface FoodPortion {
  nombre: string; // e.g. "unidad", "taza", "100 g"
  gramos: number;
}

export interface FoodMicronutrients {
  vitaminaA?: number; // mcg
  vitaminaC?: number; // mg
  vitaminaD?: number; // mcg
  vitaminaE?: number; // mg
  vitaminaK?: number; // mcg
  vitaminaB1?: number; // mg
  vitaminaB2?: number; // mg
  vitaminaB3?: number; // mg
  vitaminaB6?: number; // mg
  vitaminaB12?: number; // mcg
  folato?: number; // mcg
  calcio?: number; // mg
  hierro?: number; // mg
  magnesio?: number; // mg
  fosforo?: number; // mg
  potasio?: number; // mg
  zinc?: number; // mg
  selenio?: number; // mcg
  cobre?: number; // mg
  manganeso?: number; // mg
}

export const FOOD_CATEGORIES = [
  "Frutas",
  "Verduras",
  "Proteínas",
  "Lácteos",
  "Granos",
  "Snacks",
  "Bebidas",
  "Otros",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface Food {
  id: string;
  nombre: string;
  marca?: string;
  categoria: string;
  porcion: string; // default portion label, e.g. "100 g"
  pesoGramos?: number; // grams represented by the default porcion
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  grasasTrans?: number;
  colesterol?: number; // mg
  sodio?: number; // mg
  fibra?: number;
  azucares?: number;
  azucaresAnadidos?: number;
  micronutrientes?: FoodMicronutrients;
  photoUrl?: string | null;
  barcode?: string;
  verificado?: boolean; // predefined food from the base dataset
  creadoPorUsuario?: boolean;
  porciones?: FoodPortion[]; // alternate selectable units
}

export type MealType = "desayuno" | "almuerzo" | "cena" | "snacks";

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snacks: "Snacks",
};

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
  cantidad?: number;
  porcionNombre?: string;
  photoUrl?: string | null;
}

export interface RecipeIngredient {
  foodId: string;
  nombre: string;
  cantidad: number;
  porcionNombre: string;
  gramos: number;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

export interface Recipe {
  id: string;
  nombre: string;
  foto?: string | null;
  porciones: number;
  tiempoPrepMin: number;
  tipos: MealType[];
  ingredientes: RecipeIngredient[];
  instrucciones: string[];
  totales: { calorias: number; proteina: number; carbos: number; grasas: number };
  favorito?: boolean;
  fuente?: "manual" | "foto" | "enlace" | "ia";
  enlace?: string;
  createdAt: number;
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
