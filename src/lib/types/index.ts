export type ModuleId =
  | "home"
  | "gym"
  | "habitos"
  | "rutinas"
  | "calendario"
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
  | "Antebrazo"
  | "Cuadriceps"
  | "Femoral"
  | "Pantorrilla"
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
  vitaminaB5?: number; // mg (ácido pantoténico)
  vitaminaB6?: number; // mg
  vitaminaB12?: number; // mcg
  folato?: number; // mcg
  colina?: number; // mg
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

/**
 * Perfil nutricional completo de un alimento por su porción base (100g por convención USDA) —
 * comparte forma entre el estado "crudo" (los campos sueltos de `Food`, por compatibilidad con
 * los ~124 alimentos que ya existían antes de este campo) y el estado "cocido" (`Food.cocido`,
 * opcional). Antes "cocido" era una fórmula fija (gramos ÷ 0.7) sobre el mismo perfil crudo — un
 * alimento cocido de verdad tiene su propio dato real (USDA reporta cada estado por separado:
 * la absorción de agua, el índice glicémico y hasta las calorías cambian con la cocción), así que
 * ahora son dos sets de datos independientes, cada uno con su propia fuente documentada.
 */
export interface NutritionProfile {
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasasSaturadas?: number;
  grasasTrans?: number;
  grasasMonoinsaturadas?: number;
  grasasPoliinsaturadas?: number;
  omega3Ala?: number; // g — ácido alfa-linolénico (18:3 n-3)
  omega6Linoleico?: number; // g — ácido linoleico (18:2 n-6)
  colesterol?: number; // mg
  sodio?: number; // mg
  fibra?: number;
  azucares?: number;
  azucaresAnadidos?: number;
  agua?: number; // g
  ceniza?: number; // g
  micronutrientes?: FoodMicronutrients;
}

export interface CookedNutritionProfile extends NutritionProfile {
  /** fdcId de USDA FoodData Central usado para ESTE estado (cocido) — trazabilidad, igual que
   * `Food.fdcIdCrudo` para el estado crudo. */
  fdcId?: number;
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

export interface Food extends NutritionProfile {
  id: string;
  nombre: string;
  marca?: string;
  categoria: string;
  porcion: string; // default portion label, e.g. "100 g"
  pesoGramos?: number; // grams represented by the default porcion
  photoUrl?: string | null;
  barcode?: string;
  /** true = sus valores fueron cruzados contra una fuente real (USDA,
   * revisión manual del usuario) y confirmados. NUNCA asumir `true` por
   * default para un alimento nuevo — antes se hardcodeaba así para toda
   * la base (ver food-utils.ts), lo que hacía aparecer el check verde de
   * "Verificado" en alimentos que nadie había verificado de verdad.
   * Con el modelo crudo/cocido: si el alimento tiene ambos estados
   * aplicables, solo se marca `true` cuando los dos están completos. */
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
  /** fdcId de USDA FoodData Central usado para el estado CRUDO (los campos de `NutritionProfile`
   * de arriba). Ausente = no viene de USDA (dato manual, plato compuesto, etc.). */
  fdcIdCrudo?: number;
  /** Estado "cocido" — un perfil nutricional COMPLETO e independiente (no una fórmula sobre el
   * crudo). Ausente = todavía no se cargó el dato real de cocido para este alimento; el switch
   * crudo/cocido de la pantalla de detalle se deshabilita en ese caso (ver food-detail-screen.tsx),
   * no inventa un valor. */
  cocido?: CookedNutritionProfile;
  /** true = este alimento NO tiene un estado "cocido" que tenga sentido (p.ej. pan, marraqueta —
   * ya son productos horneados) o NO tiene un estado "crudo" que tenga sentido (p.ej. cebolla
   * caramelizada, pollo apanado — son preparaciones). Evita que el formulario de verificación siga
   * insistiendo con la alerta de "falta llenar cocido" para un alimento de un solo estado real. */
  unSoloEstado?: boolean;
  /** Con qué estado abre por default un alimento NUEVO en la pantalla de detalle (arroz, avena,
   * pollo, huevo suelen registrarse ya cocidos, no crudos). Ausente = "crudo". No afecta un
   * `LoggedFood` ya guardado (cada uno conserva su propio `cookedState` de cuando se registró). */
  estadoDefault?: CookedState;
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
  /** Bloque 15: para `tipo === "descendente"` (dropset), el peso baja varias
   * veces sin descanso dentro de la MISMA serie — acá se guarda el peso de
   * cada bajada en orden (ej. [80, 60, 40]). `peso` sigue reflejando el
   * peso de la primera bajada (se usa donde sea que se muestre/calcule un
   * solo número, como el volumen total), pero la lista completa vive acá
   * para mostrarla en el historial. */
  pesosDescendentes?: number[];
  /** Momento (Date.now()) en que se marcó completada — usado para calcular
   * `descansoTomado` de la siguiente serie. */
  completadoAt?: number;
  /** Segundos reales de descanso tomados ANTES de esta serie (tiempo entre
   * que se marcó completa la serie anterior y esta). `undefined` en la
   * primera serie del ejercicio, donde no hay descanso previo que medir. */
  descansoTomado?: number;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  nota?: string;
  restSeconds?: number;
  /** true si este ejercicio se agregó a último momento durante la sesión en
   * vivo (no venía en la rutina/plan original con la que se inició). */
  agregadoEnSesion?: boolean;
  /** Id de grupo (superserie): ejercicios con el mismo `grupo` se hacen uno
   * tras otro sin descanso entre ellos, serie por serie (serie 1 de A, serie
   * 1 de B, descanso, serie 2 de A, serie 2 de B...). `undefined` = no
   * agrupado. Se copia desde `RoutineExercise.grupo` al iniciar la sesión. */
  grupo?: string;
  /** Segundos que tardaste en pasar de máquina/ejercicio anterior a este
   * (desde que se activó automáticamente hasta que tocaste "Aceptar, ya
   * estoy en la máquina"). `undefined` si nunca se midió (p.ej. el primer
   * ejercicio de la sesión, o uno cambiado a mano desde el carrusel). */
  transicionSegundos?: number;
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
  /** Igual que `WorkoutSet.pesosDescendentes` — se puede dejar planeado un
   * dropset (y cuántas bajadas tendrá) ya desde la creación del plan/rutina,
   * no solo durante la sesión en vivo. Se copia tal cual a `WorkoutSet`
   * cuando el plan arranca una sesión (ver `startWorkoutFromRoutine`). */
  pesosDescendentes?: number[];
}

export interface RoutineExercise {
  exerciseId: string;
  sets: RoutineSetPlan[];
  nota?: string;
  soloReps?: boolean;
  restSeconds?: number;
  /** Ver `WorkoutExerciseLog.grupo` — se configura acá, al armar el plan, y
   * se copia a la sesión en vivo cuando arranca el entrenamiento. */
  grupo?: string;
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

/** Bloque 13: registro de qué plan estuvo activo en qué rango de fechas —
 * se abre una entrada nueva (y se cierra la anterior con `fechaFin`) cada
 * vez que `setActivePlan` cambia de plan. `fechaFin: null` significa "sigue
 * siendo el plan activo hoy". */
export interface PlanActivation {
  planId: string;
  fechaInicio: string; // ISO
  fechaFin: string | null;
}

/** Bloque 13: una foto de progreso por mes calendario ("yyyy-MM"), asociada
 * automáticamente al plan que estaba activo cuando se subió. */
export interface ProgressPhoto {
  id: string;
  monthKey: string; // "yyyy-MM"
  photoUrl: string;
  planId?: string;
  createdAt: number;
}
