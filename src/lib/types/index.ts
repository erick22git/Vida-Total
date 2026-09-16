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
  | "Abductores"
  | "Aductores"
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
  /** true = sus valores fueron cruzados contra una fuente real (USDA,
   * revisión manual del usuario) y confirmados. NUNCA asumir `true` por
   * default para un alimento nuevo — antes se hardcodeaba así para toda
   * la base (ver food-utils.ts), lo que hacía aparecer el check verde de
   * "Verificado" en alimentos que nadie había verificado de verdad. */
  verificado?: boolean;
  /** false = el alimento existe (tiene id, aparece en listas) pero sus
   * valores nutricionales todavía no fueron completados con datos reales
   * — p.ej. algo capturado por texto libre en Lista sin coincidencia en
   * la base. Ausente/true = tiene valores reales cargados. Un alimento
   * con `configurado: false` no debe registrarse en una comida hasta que
   * el usuario lo complete (ver /gym/calorias/crear-alimento?editId=). */
  configurado?: boolean;
  creadoPorUsuario?: boolean;
  porciones?: FoodPortion[]; // alternate selectable units
}

export type MealType = "desayuno" | "almuerzo" | "cena" | "snack1" | "snack2";

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snack1: "Snack 1",
  snack2: "Snack 2",
};

export type CookedState = "cocido" | "crudo";

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
  gramos?: number;
  photoUrl?: string | null;
  cookedState?: CookedState;
  /** Si es false, el alimento sigue en el registro (visible, se puede reactivar)
   * pero no cuenta en ningún total de calorías/macros. Default: true. */
  activo?: boolean;
  /** De dónde vino este registro (para mostrar un badge/ícono distinto). Sin
   * valor = entrada manual/normal, como hasta ahora. */
  source?: "escaner-ia";
}

/** A meal saved explicitly by name for later reuse (see "Compartir > Como plantilla"). */
export interface MealTemplate {
  id: string;
  nombre: string;
  meal: MealType;
  items: Omit<LoggedFood, "id" | "timestamp" | "meal">[];
  createdAt: number;
}

/** Extra nutrients the user has opted into tracking on the "Otros nutrientes" card. */
export const TRACKABLE_NUTRIENTS = [
  // Nutrientes
  "carbsNetos",
  // Nutrientes a limitar
  "grasasTrans",
  "azucaresAnadidos",
  // Vitaminas
  "vitaminaA",
  "vitaminaB1",
  "vitaminaB2",
  "vitaminaB3",
  "vitaminaB5",
  "vitaminaB6",
  "vitaminaB12",
  "vitaminaC",
  "vitaminaD",
  "vitaminaE",
  "vitaminaK",
  "folato",
  // Minerales
  "calcio",
  "hierro",
  "magnesio",
  "fosforo",
  "potasio",
  "zinc",
  "selenio",
  "cobre",
  "manganeso",
  // Otros
  "alcohol",
  // Default card nutrients
  "azucares",
  "fibra",
  "sodio",
  "grasasSaturadas",
] as const;
export type TrackableNutrient = (typeof TRACKABLE_NUTRIENTS)[number];

export const NUTRIENT_LABELS: Record<TrackableNutrient, { label: string; unit: string; goal: number }> = {
  carbsNetos: { label: "Carbs Netos", unit: "g", goal: 150 },
  grasasTrans: { label: "Grasas Trans", unit: "g", goal: 2 },
  azucaresAnadidos: { label: "Azúcares añadidos", unit: "g", goal: 25 },
  vitaminaA: { label: "Vitamina A", unit: "mcg", goal: 900 },
  vitaminaB1: { label: "Vitamina B1", unit: "mg", goal: 1.2 },
  vitaminaB2: { label: "Vitamina B2", unit: "mg", goal: 1.3 },
  vitaminaB3: { label: "Vitamina B3", unit: "mg", goal: 16 },
  vitaminaB5: { label: "Vitamina B5", unit: "mg", goal: 5 },
  vitaminaB6: { label: "Vitamina B6", unit: "mg", goal: 1.7 },
  vitaminaB12: { label: "Vitamina B12", unit: "mcg", goal: 2.4 },
  vitaminaC: { label: "Vitamina C", unit: "mg", goal: 90 },
  vitaminaD: { label: "Vitamina D", unit: "mcg", goal: 20 },
  vitaminaE: { label: "Vitamina E", unit: "mg", goal: 15 },
  vitaminaK: { label: "Vitamina K", unit: "mcg", goal: 120 },
  folato: { label: "Folato", unit: "mcg", goal: 400 },
  calcio: { label: "Calcio", unit: "mg", goal: 1000 },
  hierro: { label: "Hierro", unit: "mg", goal: 18 },
  magnesio: { label: "Magnesio", unit: "mg", goal: 420 },
  fosforo: { label: "Fósforo", unit: "mg", goal: 700 },
  potasio: { label: "Potasio", unit: "mg", goal: 3400 },
  zinc: { label: "Zinc", unit: "mg", goal: 11 },
  selenio: { label: "Selenio", unit: "mcg", goal: 55 },
  cobre: { label: "Cobre", unit: "mg", goal: 0.9 },
  manganeso: { label: "Manganeso", unit: "mg", goal: 2.3 },
  alcohol: { label: "Alcohol", unit: "g", goal: 0 },
  azucares: { label: "Azúcares", unit: "g", goal: 50 },
  fibra: { label: "Fibra", unit: "g", goal: 28 },
  sodio: { label: "Sodio", unit: "mg", goal: 2300 },
  grasasSaturadas: { label: "Grasas saturadas", unit: "g", goal: 20 },
};

export const NUTRIENT_SECTIONS: { label: string; keys: TrackableNutrient[] }[] = [
  { label: "Nutrientes", keys: ["carbsNetos"] },
  { label: "Nutrientes a limitar", keys: ["grasasTrans", "azucaresAnadidos"] },
  {
    label: "Vitaminas",
    keys: [
      "vitaminaA",
      "vitaminaB1",
      "vitaminaB2",
      "vitaminaB3",
      "vitaminaB5",
      "vitaminaB6",
      "vitaminaB12",
      "vitaminaC",
      "vitaminaD",
      "vitaminaE",
      "vitaminaK",
      "folato",
    ],
  },
  {
    label: "Minerales",
    keys: ["calcio", "hierro", "magnesio", "fosforo", "potasio", "zinc", "selenio", "cobre", "manganeso"],
  },
  { label: "Otros", keys: ["alcohol"] },
];

export const DEFAULT_TRACKED_NUTRIENTS: TrackableNutrient[] = ["azucares", "fibra", "sodio", "grasasSaturadas"];

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
  /** Bebida elegida en el selector (ver lib/data/drinks.ts) — opcional porque
   * los accesos rápidos (+150ml, etc.) siguen registrando sin especificar tipo. */
  drinkId?: string;
  drinkNombre?: string;
  drinkEmoji?: string;
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
  restSeconds?: number;
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
  categoria: string; // "En el Gym" | "Calistenia" | ... (el usuario puede crear categorías nuevas con solo escribir un nombre distinto)
  /** Observación libre del usuario sobre el plan — se muestra junto a la categoría. */
  notas?: string;
  dias: WeeklyPlanDay[];
  activo?: boolean;
  createdAt: number;
  daysPerWeek: number;
  minsPerSession: number;
}
