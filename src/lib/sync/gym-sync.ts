/**
 * Capa de sincronización Supabase para el store de Gym (Calorías, Agua,
 * Entrenamiento, Kegel). Ver `supabase/migrations/0002_module_data_sync.sql`
 * para el esquema y `src/lib/store/gymStore.ts` para el store que consume
 * esto.
 *
 * Diseño:
 *  - Todo acá es "fire and forget": estas funciones devuelven promesas que
 *    el store NUNCA espera (`await`) antes de aplicar el cambio local — la
 *    UI sigue siendo instantánea, igual que hoy. Si Supabase falla o no hay
 *    conexión, se hace `console.warn` y no se lanza ninguna excepción: el
 *    localStorage (vía `persist`, sin cambios) sigue siendo la fuente de
 *    verdad de este dispositivo hasta el próximo sync exitoso.
 *  - Usa el cliente de navegador (`@/lib/supabase/client`, anon key + RLS),
 *    igual que el resto de la app. Nunca la service role key.
 *  - No hay tipos `Database` generados en este proyecto (ver
 *    `src/lib/supabase/client.ts`), así que cada tabla tiene su propia
 *    interfaz mínima de fila (`XRow`) escrita a mano — el mismo patrón que
 *    ya usa el resto del código para los tipos de Supabase.
 *  - Nota sobre ids: antes de este cambio, los ids generados en el cliente
 *    (`uid()` en gymStore.ts, más algunos prefijos como `custom-`/`recipe-`)
 *    no eran UUIDs válidos, pero las columnas `id` de estas tablas son
 *    `uuid`. Se cambió `uid()` para generar `crypto.randomUUID()` y se
 *    quitaron esos prefijos (ver gymStore.ts) — así el mismo id sirve como
 *    key local y como primary key remoto, sin tener que mantener un mapeo
 *    id-local <-> id-remoto.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  Exercise,
  Food,
  FoodPortion,
  LoggedFood,
  MealTemplate,
  MealType,
  MuscleGroup,
  Recipe,
  Routine,
  RoutineExercise,
  TrackableNutrient,
  TrainingPlan,
  WaterEntry,
  WeeklyPlanDay,
  WeightEntry,
  WorkoutSession,
} from "@/lib/types";
import type { DrinkOverride } from "@/lib/data/drinks";

// ============================================================================
// Helpers genéricos
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[gym-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[gym-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[gym-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[gym-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

async function safeFetchOne<T>(
  label: string,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[gym-sync] fetch ${label} falló:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[gym-sync] fetch ${label} lanzó una excepción:`, err);
    return null;
  }
}

/** "YYYY-MM-DD" a partir de un Date, usando componentes LOCALES (no UTC) —
 * evita que un `date` de Postgres cerca de medianoche caiga en el día
 * anterior/siguiente según la zona horaria del navegador. */
function localDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverso de `localDateOnly`, reconstruyendo un Date a medianoche LOCAL
 * (no `new Date("YYYY-MM-DD")`, que Javascript interpreta como UTC). */
function fromDateOnly(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dateOnlyToDateString(dateOnly: string | null): string | null {
  if (!dateOnly) return null;
  return fromDateOnly(dateOnly).toDateString();
}

function dateOnlyToIsoString(dateOnly: string | null): string | null {
  if (!dateOnly) return null;
  return fromDateOnly(dateOnly).toISOString();
}

function isoStringToDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return localDateOnly(new Date(iso));
}

function dateStringToDateOnly(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return localDateOnly(new Date(dateStr));
}

// ============================================================================
// gym_settings (singleton por usuario, debounced desde gymStore.ts)
// ============================================================================

export interface GymSettingsRow {
  user_id: string;
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  water_goal_ml: number;
  tracked_nutrients: TrackableNutrient[];
  show_remaining: boolean;
  dashboard_prefs: { showOtherNutrients: boolean; showWeekStrip: boolean; showFinishDayButton: boolean };
  day_finished_date: string | null;
  drink_overrides: Record<string, DrinkOverride>;
  hidden_drink_ids: string[];
}

export interface GymSettingsPatch {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGoalMl: number;
  trackedNutrients: TrackableNutrient[];
  showRemaining: boolean;
  dashboardPrefs: { showOtherNutrients: boolean; showWeekStrip: boolean; showFinishDayButton: boolean };
  dayFinishedDate: string | null;
  drinkOverrides: Record<string, DrinkOverride>;
  hiddenDrinkIds: string[];
}

export async function upsertGymSettings(userId: string, s: GymSettingsPatch): Promise<void> {
  const row: GymSettingsRow = {
    user_id: userId,
    calorie_goal: s.calorieGoal,
    protein_goal: s.proteinGoal,
    carbs_goal: s.carbsGoal,
    fat_goal: s.fatGoal,
    water_goal_ml: s.waterGoalMl,
    tracked_nutrients: s.trackedNutrients,
    show_remaining: s.showRemaining,
    dashboard_prefs: s.dashboardPrefs,
    day_finished_date: dateStringToDateOnly(s.dayFinishedDate),
    drink_overrides: s.drinkOverrides,
    hidden_drink_ids: s.hiddenDrinkIds,
  };
  await safeWrite("upsert gym_settings", () =>
    createClient().from("gym_settings").upsert(row, { onConflict: "user_id" }),
  );
}

async function fetchGymSettings(userId: string): Promise<Partial<GymSettingsPatch>> {
  const row = await safeFetchOne<GymSettingsRow>("gym_settings", () =>
    createClient().from("gym_settings").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (!row) return {};
  return {
    calorieGoal: row.calorie_goal,
    proteinGoal: row.protein_goal,
    carbsGoal: row.carbs_goal,
    fatGoal: row.fat_goal,
    waterGoalMl: row.water_goal_ml,
    trackedNutrients: row.tracked_nutrients,
    showRemaining: row.show_remaining,
    dashboardPrefs: row.dashboard_prefs,
    dayFinishedDate: dateOnlyToDateString(row.day_finished_date),
    drinkOverrides: row.drink_overrides ?? {},
    hiddenDrinkIds: row.hidden_drink_ids ?? [],
  };
}

// ============================================================================
// gym_workout_state (singleton por usuario, debounced desde gymStore.ts)
// ============================================================================

export interface GymWorkoutStateRow {
  user_id: string;
  active_plan_id: string | null;
  weekly_plan: WeeklyPlanDay[];
  excluded_from_global_rank: string[];
  streak: number;
  last_workout_completed_date: string | null;
  kegel_level: number;
  kegel_streak: number;
  kegel_last_session_date: string | null;
  kegel_total_sessions: number;
}

export interface GymWorkoutStatePatch {
  activePlanId: string | null;
  weeklyPlan: WeeklyPlanDay[];
  excludedFromGlobalRank: string[];
  streak: number;
  lastWorkoutCompletedDate: string | null;
  kegelLevel: number;
  kegelStreak: number;
  kegelLastSessionDate: string | null;
  kegelTotalSessions: number;
}

export async function upsertGymWorkoutState(userId: string, s: GymWorkoutStatePatch): Promise<void> {
  const row: GymWorkoutStateRow = {
    user_id: userId,
    active_plan_id: s.activePlanId,
    weekly_plan: s.weeklyPlan,
    excluded_from_global_rank: s.excludedFromGlobalRank,
    streak: s.streak,
    last_workout_completed_date: isoStringToDateOnly(s.lastWorkoutCompletedDate),
    kegel_level: s.kegelLevel,
    kegel_streak: s.kegelStreak,
    kegel_last_session_date: isoStringToDateOnly(s.kegelLastSessionDate),
    kegel_total_sessions: s.kegelTotalSessions,
  };
  await safeWrite("upsert gym_workout_state", () =>
    createClient().from("gym_workout_state").upsert(row, { onConflict: "user_id" }),
  );
}

async function fetchGymWorkoutState(userId: string): Promise<Partial<GymWorkoutStatePatch>> {
  const row = await safeFetchOne<GymWorkoutStateRow>("gym_workout_state", () =>
    createClient().from("gym_workout_state").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (!row) return {};
  return {
    activePlanId: row.active_plan_id,
    weeklyPlan: row.weekly_plan,
    excludedFromGlobalRank: row.excluded_from_global_rank ?? [],
    streak: row.streak,
    lastWorkoutCompletedDate: dateOnlyToIsoString(row.last_workout_completed_date),
    kegelLevel: row.kegel_level,
    kegelStreak: row.kegel_streak,
    kegelLastSessionDate: dateOnlyToIsoString(row.kegel_last_session_date),
    kegelTotalSessions: row.kegel_total_sessions,
  };
}

// ============================================================================
// logged_foods
// ============================================================================

export interface LoggedFoodRow {
  id: string;
  user_id: string;
  food_id: string;
  nombre: string;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  meal: MealType;
  logged_date: string;
  logged_at: string;
  cantidad: number | null;
  porcion_nombre: string | null;
  gramos: number | null;
  photo_url: string | null;
  cooked_state: string | null;
  activo: boolean;
  source: string | null;
  orden: number;
}

function loggedFoodToRow(f: LoggedFood, userId: string, orden: number): LoggedFoodRow {
  const at = new Date(f.timestamp);
  return {
    id: f.id,
    user_id: userId,
    food_id: f.foodId,
    nombre: f.nombre,
    calorias: f.calorias,
    proteina: f.proteina,
    carbos: f.carbos,
    grasas: f.grasas,
    meal: f.meal,
    logged_date: localDateOnly(at),
    logged_at: at.toISOString(),
    cantidad: f.cantidad ?? null,
    porcion_nombre: f.porcionNombre ?? null,
    gramos: f.gramos ?? null,
    photo_url: f.photoUrl ?? null,
    cooked_state: f.cookedState ?? null,
    activo: f.activo ?? true,
    source: f.source ?? null,
    orden,
  };
}

function rowToLoggedFood(row: LoggedFoodRow): LoggedFood {
  return {
    id: row.id,
    foodId: row.food_id,
    nombre: row.nombre,
    calorias: row.calorias,
    proteina: row.proteina,
    carbos: row.carbos,
    grasas: row.grasas,
    meal: row.meal,
    timestamp: new Date(row.logged_at).getTime(),
    cantidad: row.cantidad ?? undefined,
    porcionNombre: row.porcion_nombre ?? undefined,
    gramos: row.gramos ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    cookedState: (row.cooked_state as LoggedFood["cookedState"]) ?? undefined,
    activo: row.activo,
    source: (row.source as LoggedFood["source"]) ?? undefined,
  };
}

async function fetchLoggedFoods(userId: string): Promise<LoggedFood[]> {
  const rows = await safeFetchList<LoggedFoodRow>("logged_foods", () =>
    createClient()
      .from("logged_foods")
      .select("*")
      .eq("user_id", userId)
      .order("logged_date", { ascending: true })
      .order("meal", { ascending: true })
      .order("orden", { ascending: true }),
  );
  return rows.map(rowToLoggedFood);
}

/** Inserta un alimento registrado. `orden` es la posición dentro de su
 * comida+día — se le pasa el índice ya calculado por el store (cantidad de
 * ítems existentes en esa comida/día al momento de agregar). */
export function syncInsertLoggedFood(food: LoggedFood, orden: number, userId: string): void {
  void safeWrite("insert logged_foods", () =>
    createClient().from("logged_foods").insert(loggedFoodToRow(food, userId, orden)),
  );
}

export function syncUpdateLoggedFood(id: string, patch: Partial<LoggedFood>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.foodId !== undefined) row.food_id = patch.foodId;
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.calorias !== undefined) row.calorias = patch.calorias;
  if (patch.proteina !== undefined) row.proteina = patch.proteina;
  if (patch.carbos !== undefined) row.carbos = patch.carbos;
  if (patch.grasas !== undefined) row.grasas = patch.grasas;
  if (patch.meal !== undefined) row.meal = patch.meal;
  if (patch.timestamp !== undefined) {
    const at = new Date(patch.timestamp);
    row.logged_at = at.toISOString();
    row.logged_date = localDateOnly(at);
  }
  if (patch.cantidad !== undefined) row.cantidad = patch.cantidad;
  if (patch.porcionNombre !== undefined) row.porcion_nombre = patch.porcionNombre;
  if (patch.gramos !== undefined) row.gramos = patch.gramos;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.cookedState !== undefined) row.cooked_state = patch.cookedState;
  if (patch.activo !== undefined) row.activo = patch.activo;
  if (patch.source !== undefined) row.source = patch.source;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update logged_foods", () =>
    createClient().from("logged_foods").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteLoggedFood(id: string, userId: string): void {
  void safeWrite("delete logged_foods", () =>
    createClient().from("logged_foods").delete().eq("id", id).eq("user_id", userId),
  );
}

/** Reordenamiento por arrastre dentro de una comida: reescribe `orden` para
 * cada id en su nueva posición. Varias llamadas pequeñas en vez de una sola
 * — no hace falta un upsert masivo para el tamaño típico de una comida. */
export function syncReorderLoggedFoods(orderedIds: string[], userId: string): void {
  const supabase = createClient();
  orderedIds.forEach((id, index) => {
    void safeWrite("reorder logged_foods", () =>
      supabase.from("logged_foods").update({ orden: index }).eq("id", id).eq("user_id", userId),
    );
  });
}

/** Inserta varios alimentos de una vez (copiar/pegar/repetir comida, aplicar
 * plantilla) — cada uno ya trae su `orden` relativo calculado por el store. */
export function syncInsertLoggedFoodsBulk(
  foods: { food: LoggedFood; orden: number }[],
  userId: string,
): void {
  if (foods.length === 0) return;
  void safeWrite("bulk insert logged_foods", () =>
    createClient()
      .from("logged_foods")
      .insert(foods.map(({ food, orden }) => loggedFoodToRow(food, userId, orden))),
  );
}

export function syncDeleteLoggedFoodsWhere(ids: string[], userId: string): void {
  if (ids.length === 0) return;
  void safeWrite("bulk delete logged_foods", () =>
    createClient().from("logged_foods").delete().in("id", ids).eq("user_id", userId),
  );
}

export function syncUpdateLoggedFoodsBulk(
  updates: { id: string; patch: Partial<LoggedFood> }[],
  userId: string,
): void {
  updates.forEach(({ id, patch }) => syncUpdateLoggedFood(id, patch, userId));
}

// ============================================================================
// meal_templates
// ============================================================================

export interface MealTemplateRow {
  id: string;
  user_id: string;
  nombre: string;
  meal: MealType;
  items: MealTemplate["items"];
  created_at: string;
}

function rowToMealTemplate(row: MealTemplateRow): MealTemplate {
  return {
    id: row.id,
    nombre: row.nombre,
    meal: row.meal,
    items: row.items,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchMealTemplates(userId: string): Promise<MealTemplate[]> {
  const rows = await safeFetchList<MealTemplateRow>("meal_templates", () =>
    createClient().from("meal_templates").select("*").eq("user_id", userId),
  );
  return rows.map(rowToMealTemplate);
}

export function syncInsertMealTemplate(template: MealTemplate, userId: string): void {
  const row: MealTemplateRow = {
    id: template.id,
    user_id: userId,
    nombre: template.nombre,
    meal: template.meal,
    items: template.items,
    created_at: new Date(template.createdAt).toISOString(),
  };
  void safeWrite("insert meal_templates", () => createClient().from("meal_templates").insert(row));
}

// ============================================================================
// custom_foods
// ============================================================================

export interface CustomFoodRow {
  id: string;
  user_id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  porcion: string;
  peso_gramos: number | null;
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
  grasas_saturadas: number | null;
  grasas_trans: number | null;
  colesterol: number | null;
  sodio: number | null;
  fibra: number | null;
  azucares: number | null;
  azucares_anadidos: number | null;
  micronutrientes: Food["micronutrientes"] | null;
  photo_url: string | null;
  barcode: string | null;
  porciones: FoodPortion[] | null;
}

function foodToRow(f: Food, userId: string): CustomFoodRow {
  return {
    id: f.id,
    user_id: userId,
    nombre: f.nombre,
    marca: f.marca ?? null,
    categoria: f.categoria,
    porcion: f.porcion,
    peso_gramos: f.pesoGramos ?? null,
    calorias: f.calorias,
    proteina: f.proteina,
    carbos: f.carbos,
    grasas: f.grasas,
    grasas_saturadas: f.grasasSaturadas ?? null,
    grasas_trans: f.grasasTrans ?? null,
    colesterol: f.colesterol ?? null,
    sodio: f.sodio ?? null,
    fibra: f.fibra ?? null,
    azucares: f.azucares ?? null,
    azucares_anadidos: f.azucaresAnadidos ?? null,
    micronutrientes: f.micronutrientes ?? null,
    photo_url: f.photoUrl ?? null,
    barcode: f.barcode ?? null,
    porciones: f.porciones ?? null,
  };
}

function rowToFood(row: CustomFoodRow): Food {
  return {
    id: row.id,
    nombre: row.nombre,
    marca: row.marca ?? undefined,
    categoria: row.categoria,
    porcion: row.porcion,
    pesoGramos: row.peso_gramos ?? undefined,
    calorias: row.calorias,
    proteina: row.proteina,
    carbos: row.carbos,
    grasas: row.grasas,
    grasasSaturadas: row.grasas_saturadas ?? undefined,
    grasasTrans: row.grasas_trans ?? undefined,
    colesterol: row.colesterol ?? undefined,
    sodio: row.sodio ?? undefined,
    fibra: row.fibra ?? undefined,
    azucares: row.azucares ?? undefined,
    azucaresAnadidos: row.azucares_anadidos ?? undefined,
    micronutrientes: row.micronutrientes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    barcode: row.barcode ?? undefined,
    porciones: row.porciones ?? undefined,
    creadoPorUsuario: true,
  };
}

async function fetchCustomFoods(userId: string): Promise<Food[]> {
  const rows = await safeFetchList<CustomFoodRow>("custom_foods", () =>
    createClient().from("custom_foods").select("*").eq("user_id", userId),
  );
  return rows.map(rowToFood);
}

export function syncInsertCustomFood(food: Food, userId: string): void {
  void safeWrite("insert custom_foods", () => createClient().from("custom_foods").insert(foodToRow(food, userId)));
}

export function syncUpdateCustomFood(id: string, patch: Partial<Food>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.marca !== undefined) row.marca = patch.marca;
  if (patch.categoria !== undefined) row.categoria = patch.categoria;
  if (patch.porcion !== undefined) row.porcion = patch.porcion;
  if (patch.pesoGramos !== undefined) row.peso_gramos = patch.pesoGramos;
  if (patch.calorias !== undefined) row.calorias = patch.calorias;
  if (patch.proteina !== undefined) row.proteina = patch.proteina;
  if (patch.carbos !== undefined) row.carbos = patch.carbos;
  if (patch.grasas !== undefined) row.grasas = patch.grasas;
  if (patch.grasasSaturadas !== undefined) row.grasas_saturadas = patch.grasasSaturadas;
  if (patch.grasasTrans !== undefined) row.grasas_trans = patch.grasasTrans;
  if (patch.colesterol !== undefined) row.colesterol = patch.colesterol;
  if (patch.sodio !== undefined) row.sodio = patch.sodio;
  if (patch.fibra !== undefined) row.fibra = patch.fibra;
  if (patch.azucares !== undefined) row.azucares = patch.azucares;
  if (patch.azucaresAnadidos !== undefined) row.azucares_anadidos = patch.azucaresAnadidos;
  if (patch.micronutrientes !== undefined) row.micronutrientes = patch.micronutrientes;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.barcode !== undefined) row.barcode = patch.barcode;
  if (patch.porciones !== undefined) row.porciones = patch.porciones;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update custom_foods", () =>
    createClient().from("custom_foods").update(row).eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// favorite_foods
// ============================================================================

interface FavoriteFoodRow {
  food_id: string;
}

async function fetchFavoriteFoodIds(userId: string): Promise<string[]> {
  const rows = await safeFetchList<FavoriteFoodRow>("favorite_foods", () =>
    createClient().from("favorite_foods").select("food_id").eq("user_id", userId),
  );
  return rows.map((r) => r.food_id);
}

export function syncAddFavoriteFood(foodId: string, userId: string): void {
  void safeWrite("insert favorite_foods", () =>
    createClient().from("favorite_foods").upsert({ user_id: userId, food_id: foodId }, { onConflict: "user_id,food_id" }),
  );
}

export function syncRemoveFavoriteFood(foodId: string, userId: string): void {
  void safeWrite("delete favorite_foods", () =>
    createClient().from("favorite_foods").delete().eq("user_id", userId).eq("food_id", foodId),
  );
}

// ============================================================================
// custom_portions
// ============================================================================

interface CustomPortionRow {
  food_id: string;
  nombre: string;
  gramos: number;
}

async function fetchCustomPortions(userId: string): Promise<Record<string, FoodPortion[]>> {
  const rows = await safeFetchList<CustomPortionRow>("custom_portions", () =>
    createClient().from("custom_portions").select("food_id, nombre, gramos").eq("user_id", userId),
  );
  const byFood: Record<string, FoodPortion[]> = {};
  for (const row of rows) {
    const list = byFood[row.food_id] ?? (byFood[row.food_id] = []);
    list.push({ nombre: row.nombre, gramos: row.gramos });
  }
  return byFood;
}

export function syncInsertCustomPortion(foodId: string, portion: FoodPortion, userId: string): void {
  void safeWrite("insert custom_portions", () =>
    createClient()
      .from("custom_portions")
      .insert({ user_id: userId, food_id: foodId, nombre: portion.nombre, gramos: portion.gramos }),
  );
}

// ============================================================================
// recipes
// ============================================================================

export interface RecipeRow {
  id: string;
  user_id: string;
  nombre: string;
  foto: string | null;
  porciones: number;
  tiempo_prep_min: number;
  tipos: MealType[];
  ingredientes: Recipe["ingredientes"];
  instrucciones: string[];
  totales: Recipe["totales"];
  favorito: boolean;
  fuente: string | null;
  enlace: string | null;
  created_at: string;
}

function recipeToRow(r: Recipe, userId: string): RecipeRow {
  return {
    id: r.id,
    user_id: userId,
    nombre: r.nombre,
    foto: r.foto ?? null,
    porciones: r.porciones,
    tiempo_prep_min: r.tiempoPrepMin,
    tipos: r.tipos,
    ingredientes: r.ingredientes,
    instrucciones: r.instrucciones,
    totales: r.totales,
    favorito: r.favorito ?? false,
    fuente: r.fuente ?? null,
    enlace: r.enlace ?? null,
    created_at: new Date(r.createdAt).toISOString(),
  };
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    nombre: row.nombre,
    foto: row.foto ?? undefined,
    porciones: row.porciones,
    tiempoPrepMin: row.tiempo_prep_min,
    tipos: row.tipos,
    ingredientes: row.ingredientes,
    instrucciones: row.instrucciones,
    totales: row.totales,
    favorito: row.favorito,
    fuente: (row.fuente as Recipe["fuente"]) ?? undefined,
    enlace: row.enlace ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const rows = await safeFetchList<RecipeRow>("recipes", () =>
    createClient().from("recipes").select("*").eq("user_id", userId),
  );
  return rows.map(rowToRecipe);
}

export function syncInsertRecipe(recipe: Recipe, userId: string): void {
  void safeWrite("insert recipes", () => createClient().from("recipes").insert(recipeToRow(recipe, userId)));
}

export function syncUpdateRecipe(id: string, patch: Partial<Recipe>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.foto !== undefined) row.foto = patch.foto;
  if (patch.porciones !== undefined) row.porciones = patch.porciones;
  if (patch.tiempoPrepMin !== undefined) row.tiempo_prep_min = patch.tiempoPrepMin;
  if (patch.tipos !== undefined) row.tipos = patch.tipos;
  if (patch.ingredientes !== undefined) row.ingredientes = patch.ingredientes;
  if (patch.instrucciones !== undefined) row.instrucciones = patch.instrucciones;
  if (patch.totales !== undefined) row.totales = patch.totales;
  if (patch.favorito !== undefined) row.favorito = patch.favorito;
  if (patch.fuente !== undefined) row.fuente = patch.fuente;
  if (patch.enlace !== undefined) row.enlace = patch.enlace;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update recipes", () =>
    createClient().from("recipes").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteRecipe(id: string, userId: string): void {
  void safeWrite("delete recipes", () =>
    createClient().from("recipes").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// water_entries
// ============================================================================

interface WaterEntryRow {
  id: string;
  user_id: string;
  ml: number;
  logged_at: string;
  drink_id: string | null;
  drink_nombre: string | null;
  drink_emoji: string | null;
}

function waterEntryToRow(w: WaterEntry, userId: string): WaterEntryRow {
  return {
    id: w.id,
    user_id: userId,
    ml: w.ml,
    logged_at: new Date(w.timestamp).toISOString(),
    drink_id: w.drinkId ?? null,
    drink_nombre: w.drinkNombre ?? null,
    drink_emoji: w.drinkEmoji ?? null,
  };
}

function rowToWaterEntry(row: WaterEntryRow): WaterEntry {
  return {
    id: row.id,
    ml: row.ml,
    timestamp: new Date(row.logged_at).getTime(),
    drinkId: row.drink_id ?? undefined,
    drinkNombre: row.drink_nombre ?? undefined,
    drinkEmoji: row.drink_emoji ?? undefined,
  };
}

async function fetchWaterEntries(userId: string): Promise<WaterEntry[]> {
  const rows = await safeFetchList<WaterEntryRow>("water_entries", () =>
    createClient().from("water_entries").select("*").eq("user_id", userId),
  );
  return rows.map(rowToWaterEntry);
}

export function syncInsertWaterEntry(entry: WaterEntry, userId: string): void {
  void safeWrite("insert water_entries", () =>
    createClient().from("water_entries").insert(waterEntryToRow(entry, userId)),
  );
}

export function syncDeleteWaterEntry(id: string, userId: string): void {
  void safeWrite("delete water_entries", () =>
    createClient().from("water_entries").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// workout_sessions (solo sesiones TERMINADAS — la activa no se sincroniza)
// ============================================================================

interface WorkoutSessionRow {
  id: string;
  user_id: string;
  session_date: string;
  grupo_muscular: MuscleGroup;
  ejercicios: WorkoutSession["ejercicios"];
  completado: boolean;
  nombre: string | null;
  duration_seconds: number | null;
  routine_id: string | null;
}

function workoutSessionToRow(s: WorkoutSession, userId: string): WorkoutSessionRow {
  return {
    id: s.id,
    user_id: userId,
    session_date: dateStringToDateOnly(s.date) ?? localDateOnly(new Date()),
    grupo_muscular: s.grupoMuscular,
    ejercicios: s.ejercicios,
    completado: s.completado,
    nombre: s.nombre ?? null,
    duration_seconds: s.durationSeconds ?? null,
    routine_id: s.routineId ?? null,
  };
}

function rowToWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    date: dateOnlyToIsoString(row.session_date) ?? new Date().toISOString(),
    grupoMuscular: row.grupo_muscular,
    ejercicios: row.ejercicios,
    completado: row.completado,
    nombre: row.nombre ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    routineId: row.routine_id ?? undefined,
  };
}

async function fetchWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const rows = await safeFetchList<WorkoutSessionRow>("workout_sessions", () =>
    createClient().from("workout_sessions").select("*").eq("user_id", userId),
  );
  return rows.map(rowToWorkoutSession);
}

export function syncInsertWorkoutSession(session: WorkoutSession, userId: string): void {
  void safeWrite("insert workout_sessions", () =>
    createClient().from("workout_sessions").insert(workoutSessionToRow(session, userId)),
  );
}

// ============================================================================
// routines
// ============================================================================

interface RoutineRow {
  id: string;
  user_id: string;
  nombre: string;
  ejercicios: RoutineExercise[];
  times_completed: number;
  created_at: string;
}

function routineToRow(r: Routine, userId: string): RoutineRow {
  return {
    id: r.id,
    user_id: userId,
    nombre: r.nombre,
    ejercicios: r.ejercicios,
    times_completed: r.timesCompleted,
    created_at: new Date(r.createdAt).toISOString(),
  };
}

function rowToRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    nombre: row.nombre,
    ejercicios: row.ejercicios,
    timesCompleted: row.times_completed,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchRoutines(userId: string): Promise<Routine[]> {
  const rows = await safeFetchList<RoutineRow>("routines", () =>
    createClient().from("routines").select("*").eq("user_id", userId),
  );
  return rows.map(rowToRoutine);
}

export function syncInsertRoutine(routine: Routine, userId: string): void {
  void safeWrite("insert routines", () => createClient().from("routines").insert(routineToRow(routine, userId)));
}

export function syncUpdateRoutine(id: string, patch: Partial<Routine>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.ejercicios !== undefined) row.ejercicios = patch.ejercicios;
  if (patch.timesCompleted !== undefined) row.times_completed = patch.timesCompleted;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update routines", () =>
    createClient().from("routines").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteRoutine(id: string, userId: string): void {
  void safeWrite("delete routines", () =>
    createClient().from("routines").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// training_plans
// ============================================================================

interface TrainingPlanRow {
  id: string;
  user_id: string;
  nombre: string;
  contexto: string | null;
  categoria: string | null;
  notas: string | null;
  dias: WeeklyPlanDay[];
  activo: boolean;
  days_per_week: number | null;
  mins_per_session: number | null;
  created_at: string;
}

function planToRow(p: TrainingPlan, userId: string): TrainingPlanRow {
  return {
    id: p.id,
    user_id: userId,
    nombre: p.nombre,
    contexto: p.contexto ?? null,
    categoria: p.categoria ?? null,
    notas: p.notas ?? null,
    dias: p.dias,
    activo: p.activo ?? false,
    days_per_week: p.daysPerWeek ?? null,
    mins_per_session: p.minsPerSession ?? null,
    created_at: new Date(p.createdAt).toISOString(),
  };
}

function rowToPlan(row: TrainingPlanRow): TrainingPlan {
  return {
    id: row.id,
    nombre: row.nombre,
    contexto: row.contexto ?? "",
    categoria: row.categoria ?? "",
    notas: row.notas ?? undefined,
    dias: row.dias,
    activo: row.activo,
    daysPerWeek: row.days_per_week ?? 0,
    minsPerSession: row.mins_per_session ?? 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchTrainingPlans(userId: string): Promise<TrainingPlan[]> {
  const rows = await safeFetchList<TrainingPlanRow>("training_plans", () =>
    createClient().from("training_plans").select("*").eq("user_id", userId),
  );
  return rows.map(rowToPlan);
}

export function syncInsertPlan(plan: TrainingPlan, userId: string): void {
  void safeWrite("insert training_plans", () =>
    createClient().from("training_plans").insert(planToRow(plan, userId)),
  );
}

export function syncUpdatePlan(id: string, patch: Record<string, unknown>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.contexto !== undefined) row.contexto = patch.contexto;
  if (patch.categoria !== undefined) row.categoria = patch.categoria;
  if (patch.notas !== undefined) row.notas = patch.notas;
  if (patch.dias !== undefined) row.dias = patch.dias;
  if (patch.activo !== undefined) row.activo = patch.activo;
  if (patch.daysPerWeek !== undefined) row.days_per_week = patch.daysPerWeek;
  if (patch.minsPerSession !== undefined) row.mins_per_session = patch.minsPerSession;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update training_plans", () =>
    createClient().from("training_plans").update(row).eq("id", id).eq("user_id", userId),
  );
}

/** `setActivePlan` marca `activo=true` en un plan y `false` en el resto —
 * se refleja con una actualización por plan (la lista de planes de un
 * usuario es chica, no vale la pena un RPC para esto). */
export function syncSetActivePlan(planIds: string[], activeId: string, userId: string): void {
  const supabase = createClient();
  planIds.forEach((id) => {
    void safeWrite("set active plan", () =>
      supabase.from("training_plans").update({ activo: id === activeId }).eq("id", id).eq("user_id", userId),
    );
  });
}

// ============================================================================
// custom_exercises
// ============================================================================

interface CustomExerciseRow {
  id: string;
  user_id: string;
  nombre: string;
  categoria: MuscleGroup;
  musculo_primario: string | null;
  musculos_secundarios: string[];
  equipo: string | null;
  nivel: string | null;
  instrucciones: string[];
  imagen: string | null;
}

function exerciseToRow(ex: Exercise, userId: string): CustomExerciseRow {
  return {
    id: ex.id,
    user_id: userId,
    nombre: ex.nombre,
    categoria: ex.categoria,
    musculo_primario: ex.musculoPrimario ?? null,
    musculos_secundarios: ex.musculosSecundarios ?? [],
    equipo: ex.equipo ?? null,
    nivel: ex.nivel ?? null,
    instrucciones: ex.instrucciones ?? [],
    imagen: ex.imagen ?? null,
  };
}

function rowToExercise(row: CustomExerciseRow): Exercise {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    musculoPrimario: row.musculo_primario ?? "",
    musculosSecundarios: row.musculos_secundarios ?? [],
    equipo: row.equipo ?? "",
    nivel: (row.nivel as Exercise["nivel"]) ?? "Principiante",
    instrucciones: row.instrucciones ?? [],
    imagen: row.imagen ?? undefined,
  };
}

async function fetchCustomExercises(userId: string): Promise<Exercise[]> {
  const rows = await safeFetchList<CustomExerciseRow>("custom_exercises", () =>
    createClient().from("custom_exercises").select("*").eq("user_id", userId),
  );
  return rows.map(rowToExercise);
}

export function syncInsertCustomExercise(exercise: Exercise, userId: string): void {
  void safeWrite("insert custom_exercises", () =>
    createClient().from("custom_exercises").insert(exerciseToRow(exercise, userId)),
  );
}

// ============================================================================
// weight_entries
// ============================================================================

interface WeightEntryRow {
  id: string;
  user_id: string;
  kg: number;
  entry_date: string;
}

function weightEntryToRow(w: WeightEntry, userId: string): WeightEntryRow {
  return {
    id: w.id,
    user_id: userId,
    kg: w.kg,
    entry_date: dateStringToDateOnly(w.date) ?? localDateOnly(new Date()),
  };
}

function rowToWeightEntry(row: WeightEntryRow): WeightEntry {
  return {
    id: row.id,
    kg: row.kg,
    date: dateOnlyToIsoString(row.entry_date) ?? new Date().toISOString(),
  };
}

async function fetchWeightEntries(userId: string): Promise<WeightEntry[]> {
  const rows = await safeFetchList<WeightEntryRow>("weight_entries", () =>
    createClient().from("weight_entries").select("*").eq("user_id", userId),
  );
  return rows.map(rowToWeightEntry);
}

export function syncInsertWeightEntry(entry: WeightEntry, userId: string): void {
  void safeWrite("insert weight_entries", () =>
    createClient().from("weight_entries").insert(weightEntryToRow(entry, userId)),
  );
}

export function syncDeleteWeightEntry(id: string, userId: string): void {
  void safeWrite("delete weight_entries", () =>
    createClient().from("weight_entries").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface GymHydratedState {
  loggedFoods: LoggedFood[];
  mealTemplates: MealTemplate[];
  customFoods: Food[];
  favoriteFoodIds: string[];
  customPortionsByFood: Record<string, FoodPortion[]>;
  recipes: Recipe[];
  waterEntries: WaterEntry[];
  sessions: WorkoutSession[];
  routines: Routine[];
  plans: TrainingPlan[];
  customExercises: Exercise[];
  weightEntries: WeightEntry[];
  // Los campos de gym_settings/gym_workout_state solo se incluyen si ya
  // existe una fila remota para ese usuario — si no, se dejan los valores
  // locales/por defecto tal cual (la primera escritura creará la fila).
  settings: Partial<GymSettingsPatch>;
  workoutState: Partial<GymWorkoutStatePatch>;
}

/**
 * Trae las 14 tablas de Gym para `userId` y devuelve un objeto listo para
 * mezclar (merge) en el estado del store. No escribe nada — el store decide
 * cómo aplicar el patch (ver `_hydrateFromRemote` en gymStore.ts).
 *
 * Cada tabla se trae de forma independiente y tolerante a fallos (una tabla
 * caída no bloquea a las demás); si TODO falla (sin conexión), devuelve
 * arrays vacíos / objetos vacíos y el store simplemente no sobreescribe
 * nada relevante más allá de lo que ya trae `persist` de localStorage.
 */
export async function hydrateGymStoreFromSupabase(userId: string): Promise<GymHydratedState> {
  const [
    loggedFoods,
    mealTemplates,
    customFoods,
    favoriteFoodIds,
    customPortionsByFood,
    recipes,
    waterEntries,
    sessions,
    routines,
    plans,
    customExercises,
    weightEntries,
    settings,
    workoutState,
  ] = await Promise.all([
    fetchLoggedFoods(userId),
    fetchMealTemplates(userId),
    fetchCustomFoods(userId),
    fetchFavoriteFoodIds(userId),
    fetchCustomPortions(userId),
    fetchRecipes(userId),
    fetchWaterEntries(userId),
    fetchWorkoutSessions(userId),
    fetchRoutines(userId),
    fetchTrainingPlans(userId),
    fetchCustomExercises(userId),
    fetchWeightEntries(userId),
    fetchGymSettings(userId),
    fetchGymWorkoutState(userId),
  ]);

  return {
    loggedFoods,
    mealTemplates,
    customFoods,
    favoriteFoodIds,
    customPortionsByFood,
    recipes,
    waterEntries,
    sessions,
    routines,
    plans,
    customExercises,
    weightEntries,
    settings,
    workoutState,
  };
}
