import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { isSameDay, differenceInCalendarDays } from "date-fns";
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
  WorkoutExerciseLog,
  WorkoutSession,
  WorkoutSet,
} from "@/lib/types";
import { DEFAULT_TRACKED_NUTRIENTS } from "@/lib/types";
import { BASE_FOODS } from "@/lib/food-utils";
import { DEFAULT_WEEKLY_PLAN } from "@/lib/data/weekly-plan";
import type { DrinkOverride } from "@/lib/data/drinks";
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertLoggedFood,
  syncUpdateLoggedFood,
  syncDeleteLoggedFood,
  syncReorderLoggedFoods,
  syncInsertLoggedFoodsBulk,
  syncDeleteLoggedFoodsWhere,
  syncUpdateLoggedFoodsBulk,
  syncInsertMealTemplate,
  syncInsertCustomFood,
  syncUpdateCustomFood,
  syncAddFavoriteFood,
  syncRemoveFavoriteFood,
  syncInsertCustomPortion,
  syncInsertRecipe,
  syncUpdateRecipe,
  syncDeleteRecipe,
  syncInsertWaterEntry,
  syncDeleteWaterEntry,
  syncInsertWorkoutSession,
  syncInsertRoutine,
  syncUpdateRoutine,
  syncDeleteRoutine,
  syncInsertPlan,
  syncUpdatePlan,
  syncSetActivePlan,
  syncInsertCustomExercise,
  syncInsertWeightEntry,
  syncDeleteWeightEntry,
  upsertGymSettings,
  upsertGymWorkoutState,
  hydrateGymStoreFromSupabase,
  type GymHydratedState,
} from "@/lib/sync/gym-sync";

/**
 * Id único usado tanto como key local (React, lookups en el store) como
 * primary key de la fila remota en Supabase (columnas `uuid` — ver
 * supabase/migrations/0002_module_data_sync.sql). Antes generaba un string
 * base36 corto que NO era un UUID válido; se cambió a `crypto.randomUUID()`
 * para que el mismo id sirva en ambos lados sin mantener un mapeo
 * id-local <-> id-remoto.
 */
function uid() {
  return crypto.randomUUID();
}

/** true mientras se aplica un patch de `_hydrateFromRemote` — evita que la
 * suscripción de sync de gym_settings/gym_workout_state (ver abajo de este
 * archivo) reenvíe a Supabase los mismos datos que se acaban de traer. */
let isHydratingFromRemote = false;

/**
 * Timestamp that falls on `date`'s calendar day, keeping the current
 * time-of-day (so ordering within the day stays sensible). Used when an
 * item is added/copied/pasted onto a day other than today.
 */
function timestampForDate(date: Date): number {
  const now = new Date();
  const d = new Date(date);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return d.getTime();
}

export interface GymState {
  // ---------- Nutrition ----------
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  loggedFoods: LoggedFood[];
  addLoggedFood: (
    food: Omit<LoggedFood, "id" | "timestamp">,
  ) => LoggedFood;
  removeLoggedFood: (id: string) => void;
  updateLoggedFood: (id: string, patch: Partial<LoggedFood>) => void;
  reorderMealFoods: (meal: MealType, orderedIds: string[], date?: Date) => void;

  // ---------- Meal actions (menu "···") ----------
  // Todas aceptan un `date` opcional (default: hoy) para poder operar sobre
  // el día que se esté viendo en la pantalla de Calorías, no solo hoy — así
  // se puede copiar/repetir/vaciar la comida de un día pasado.
  mealClipboard: LoggedFood[] | null;
  copyMeal: (meal: MealType, date?: Date) => void;
  pasteMeal: (meal: MealType, date?: Date) => void;
  repeatMeal: (meal: MealType, date?: Date) => boolean;
  clearMeal: (meal: MealType, date?: Date) => void;
  scaleMealPortions: (meal: MealType, factor: number, date?: Date) => void;
  mealTemplates: MealTemplate[];
  saveMealAsTemplate: (meal: MealType, nombre: string, date?: Date) => MealTemplate | null;
  applyMealTemplate: (templateId: string, meal: MealType) => void;

  // ---------- Nutrient tracking preferences ----------
  trackedNutrients: TrackableNutrient[];
  setTrackedNutrients: (keys: TrackableNutrient[]) => void;
  showRemaining: boolean;
  toggleShowRemaining: () => void;
  dayFinishedDate: string | null;
  finishDay: () => void;

  // ---------- Custom foods & favorites ----------
  customFoods: Food[];
  addCustomFood: (food: Omit<Food, "id" | "creadoPorUsuario">) => Food;
  updateCustomFood: (id: string, patch: Partial<Food>) => void;
  /** A diferencia de `updateCustomFood` (que solo actualiza un alimento que
   * el usuario ya creó), esta acción también permite editar/verificar un
   * alimento de la BASE (USDA/regional): si `id` no existe todavía en
   * `customFoods`, crea ahí un "override" con ese mismo id (copiando el
   * alimento base + el patch) que lo tapa en toda la app (ver `mergeFoods`
   * en food-utils.ts). Es el único camino por el que `verificado` puede
   * pasar a `true`. */
  upsertFoodOverride: (id: string, patch: Partial<Food>) => void;
  favoriteFoodIds: string[];
  toggleFavoriteFood: (foodId: string) => void;
  customPortionsByFood: Record<string, FoodPortion[]>;
  addCustomPortion: (foodId: string, portion: FoodPortion) => void;

  // ---------- Recipes ----------
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, "id" | "createdAt">) => Recipe;
  updateRecipe: (id: string, patch: Partial<Recipe>) => void;
  toggleFavoriteRecipe: (id: string) => void;
  deleteRecipe: (id: string) => void;

  // ---------- Water ----------
  waterGoalMl: number;
  waterEntries: WaterEntry[];
  addWater: (ml: number, drink?: { id: string; nombre: string; emoji: string }) => void;
  removeWaterEntry: (id: string) => void;

  // ---------- Bebidas (catálogo editable, ver lib/data/drinks.ts) ----------
  /** Cambios del usuario sobre una bebida del catálogo (nombre/ícono/color/
   * propiedades) — se guardan aparte y se combinan con la data base al leer. */
  drinkOverrides: Record<string, DrinkOverride>;
  setDrinkOverride: (id: string, patch: DrinkOverride) => void;
  hiddenDrinkIds: string[];
  toggleDrinkHidden: (id: string) => void;

  // ---------- Workout ----------
  weeklyPlan: WeeklyPlanDay[];
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  activeExerciseIndex: number;
  sessionStartedAt: number | null;
  restingExerciseId: string | null;
  restEndsAt: number | null;
  startWorkout: (
    grupoMuscular: MuscleGroup,
    exerciseIds: string[],
    routineId?: string,
  ) => void;
  startWorkoutFromRoutine: (routine: Routine) => void;
  setActiveExerciseIndex: (i: number) => void;
  addSetToExercise: (exerciseId: string) => void;
  updateSet: (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  replaceExercise: (oldExerciseId: string, newExerciseId: string) => void;
  setExerciseNote: (exerciseId: string, nota: string) => void;
  setExerciseRest: (exerciseId: string, seconds: number) => void;
  startRest: (exerciseId: string, seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  clearRest: () => void;
  finishWorkout: (opts?: { nombre?: string }) => void;
  cancelWorkout: () => void;

  // ---------- Routines ----------
  routines: Routine[];
  saveRoutine: (nombre: string, ejercicios: RoutineExercise[]) => Routine;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  incrementRoutineCompleted: (id: string) => void;

  // ---------- Training plans (planificaciones) ----------
  plans: TrainingPlan[];
  activePlanId: string | null;
  createPlan: (plan: Omit<TrainingPlan, "id" | "createdAt">) => TrainingPlan;
  setActivePlan: (id: string) => void;
  applyPlanToWeek: (id: string) => void;
  updatePlanDay: (planId: string, dayIndex: number, patch: Partial<WeeklyPlanDay>) => void;
  /** Edita nombre/categoría/notas de un plan (no toca sus días). */
  updatePlan: (id: string, patch: Partial<Pick<TrainingPlan, "nombre" | "categoria" | "notas" | "contexto">>) => void;

  // ---------- Rank preferences ----------
  excludedFromGlobalRank: string[];
  toggleExerciseGlobalRank: (exerciseId: string) => void;

  // ---------- Custom exercises ----------
  customExercises: Exercise[];
  addCustomExercise: (ex: Omit<Exercise, "id">) => Exercise;

  // ---------- Body weight tracker ----------
  weightEntries: WeightEntry[];
  addWeightEntry: (kg: number, date?: string) => void;
  removeWeightEntry: (id: string) => void;

  // ---------- Streak ----------
  streak: number;
  lastWorkoutCompletedDate: string | null;

  // ---------- Kegel ----------
  kegelLevel: number;
  kegelStreak: number;
  kegelLastSessionDate: string | null; // ISO date string
  kegelTotalSessions: number;
  completeKegelSession: () => void;

  // ---------- Dashboard personalization ----------
  dashboardPrefs: {
    showOtherNutrients: boolean;
    showWeekStrip: boolean;
    showFinishDayButton: boolean;
  };
  setDashboardPref: (key: keyof GymState["dashboardPrefs"], value: boolean) => void;

  // ---------- Remote sync (Supabase) — interno, no UI pública ----------
  /** Reemplaza slices del estado con lo traído de Supabase al loguearse.
   * Ver `hydrateGymStoreFromSupabase` (src/lib/sync/gym-sync.ts) y su único
   * llamador en `UserScopeScript`. No se persiste (es una función, zustand
   * `persist` solo serializa datos vía JSON.stringify) ni se expone como
   * API pública del store más allá de este uso interno. */
  _hydrateFromRemote: (patch: Partial<GymState>) => void;
}

export const useGymStore = create<GymState>()(
  persist(
    (set, get) => ({
      // Nutrition
      calorieGoal: 2000,
      proteinGoal: 140,
      carbsGoal: 220,
      fatGoal: 60,
      loggedFoods: [],
      addLoggedFood: (food) => {
        const created: LoggedFood = { activo: true, ...food, id: uid(), timestamp: Date.now() };
        const uidUser = getCurrentUserId();
        let orden = 0;
        set((state) => {
          orden = state.loggedFoods.filter(
            (f) => f.meal === created.meal && isSameDay(new Date(f.timestamp), new Date(created.timestamp)),
          ).length;
          return { loggedFoods: [...state.loggedFoods, created] };
        });
        if (uidUser) syncInsertLoggedFood(created, orden, uidUser);
        return created;
      },
      removeLoggedFood: (id) => {
        set((state) => ({
          loggedFoods: state.loggedFoods.filter((f) => f.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteLoggedFood(id, uidUser);
      },
      updateLoggedFood: (id, patch) => {
        set((state) => ({
          loggedFoods: state.loggedFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateLoggedFood(id, patch, uidUser);
      },
      reorderMealFoods: (meal, orderedIds, date) => {
        set((state) => {
          const day = date ?? new Date();
          const inMeal = (f: LoggedFood) => f.meal === meal && isSameDay(new Date(f.timestamp), day);
          const others = state.loggedFoods.filter((f) => !inMeal(f));
          const map = new Map(state.loggedFoods.filter(inMeal).map((f) => [f.id, f] as const));
          const reordered = orderedIds.map((id) => map.get(id)).filter((f): f is LoggedFood => !!f);
          return { loggedFoods: [...others, ...reordered] };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncReorderLoggedFoods(orderedIds, uidUser);
      },

      // Meal actions (menu "···")
      mealClipboard: null,
      copyMeal: (meal, date) =>
        set((state) => {
          const day = date ?? new Date();
          const items = state.loggedFoods.filter(
            (f) => f.meal === meal && isSameDay(new Date(f.timestamp), day),
          );
          return { mealClipboard: items.length ? items : null };
        }),
      pasteMeal: (meal, date) => {
        const day = date ?? new Date();
        let pasted: LoggedFood[] = [];
        let baseOrden = 0;
        set((state) => {
          if (!state.mealClipboard || state.mealClipboard.length === 0) return state;
          baseOrden = state.loggedFoods.filter(
            (f) => f.meal === meal && isSameDay(new Date(f.timestamp), day),
          ).length;
          pasted = state.mealClipboard.map((f) => ({
            ...f,
            id: uid(),
            meal,
            timestamp: timestampForDate(day),
          }));
          return { loggedFoods: [...state.loggedFoods, ...pasted] };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && pasted.length > 0) {
          syncInsertLoggedFoodsBulk(
            pasted.map((food, i) => ({ food, orden: baseOrden + i })),
            uidUser,
          );
        }
      },
      repeatMeal: (meal, date) => {
        const state = get();
        const day = date ?? new Date();
        const past = state.loggedFoods
          .filter((f) => f.meal === meal && !isSameDay(new Date(f.timestamp), day) && f.timestamp < timestampForDate(day))
          .sort((a, b) => b.timestamp - a.timestamp);
        if (past.length === 0) return false;
        const lastTimestamp = past[0].timestamp;
        const lastDay = new Date(lastTimestamp);
        const lastMealItems = past.filter((f) => isSameDay(new Date(f.timestamp), lastDay));
        const baseOrden = state.loggedFoods.filter(
          (f) => f.meal === meal && isSameDay(new Date(f.timestamp), day),
        ).length;
        const repeated = lastMealItems.map((f) => ({ ...f, id: uid(), timestamp: timestampForDate(day) }));
        set((s) => ({
          loggedFoods: [...s.loggedFoods, ...repeated],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncInsertLoggedFoodsBulk(
            repeated.map((food, i) => ({ food, orden: baseOrden + i })),
            uidUser,
          );
        }
        return true;
      },
      clearMeal: (meal, date) => {
        const day = date ?? new Date();
        let removedIds: string[] = [];
        set((state) => {
          const toRemove = state.loggedFoods.filter((f) => f.meal === meal && isSameDay(new Date(f.timestamp), day));
          removedIds = toRemove.map((f) => f.id);
          return {
            loggedFoods: state.loggedFoods.filter(
              (f) => !(f.meal === meal && isSameDay(new Date(f.timestamp), day)),
            ),
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteLoggedFoodsWhere(removedIds, uidUser);
      },
      scaleMealPortions: (meal, factor, date) => {
        const day = date ?? new Date();
        const updates: { id: string; patch: Partial<LoggedFood> }[] = [];
        set((state) => ({
          loggedFoods: state.loggedFoods.map((f) => {
            if (!(f.meal === meal && isSameDay(new Date(f.timestamp), day))) return f;
            const patch: Partial<LoggedFood> = {
              calorias: Math.round(f.calorias * factor),
              proteina: Math.round(f.proteina * factor * 10) / 10,
              carbos: Math.round(f.carbos * factor * 10) / 10,
              grasas: Math.round(f.grasas * factor * 10) / 10,
              cantidad: f.cantidad ? Math.round(f.cantidad * factor * 100) / 100 : f.cantidad,
              gramos: f.gramos ? Math.round(f.gramos * factor * 10) / 10 : f.gramos,
            };
            updates.push({ id: f.id, patch });
            return { ...f, ...patch };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateLoggedFoodsBulk(updates, uidUser);
      },
      mealTemplates: [],
      saveMealAsTemplate: (meal, nombre, date) => {
        const state = get();
        const day = date ?? new Date();
        const items = state.loggedFoods.filter(
          (f) => f.meal === meal && isSameDay(new Date(f.timestamp), day),
        );
        if (items.length === 0) return null;
        const template: MealTemplate = {
          id: uid(),
          nombre,
          meal,
          items: items.map((f) => ({
            foodId: f.foodId,
            nombre: f.nombre,
            calorias: f.calorias,
            proteina: f.proteina,
            carbos: f.carbos,
            grasas: f.grasas,
            cantidad: f.cantidad,
            porcionNombre: f.porcionNombre,
            gramos: f.gramos,
            photoUrl: f.photoUrl,
            cookedState: f.cookedState,
          })),
          createdAt: Date.now(),
        };
        set((s) => ({ mealTemplates: [template, ...s.mealTemplates] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertMealTemplate(template, uidUser);
        return template;
      },
      applyMealTemplate: (templateId, meal) => {
        let created: LoggedFood[] = [];
        let baseOrden = 0;
        set((state) => {
          const template = state.mealTemplates.find((t) => t.id === templateId);
          if (!template) return state;
          const day = new Date();
          baseOrden = state.loggedFoods.filter(
            (f) => f.meal === meal && isSameDay(new Date(f.timestamp), day),
          ).length;
          created = template.items.map((item) => ({
            ...item,
            id: uid(),
            timestamp: Date.now(),
            meal,
          }));
          return {
            loggedFoods: [...state.loggedFoods, ...created],
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && created.length > 0) {
          syncInsertLoggedFoodsBulk(
            created.map((food, i) => ({ food, orden: baseOrden + i })),
            uidUser,
          );
        }
      },

      // Nutrient tracking preferences
      trackedNutrients: DEFAULT_TRACKED_NUTRIENTS,
      setTrackedNutrients: (keys) => set({ trackedNutrients: keys }),
      showRemaining: false,
      toggleShowRemaining: () => set((state) => ({ showRemaining: !state.showRemaining })),
      dayFinishedDate: null,
      finishDay: () => set({ dayFinishedDate: new Date().toDateString() }),

      // Custom foods & favorites
      customFoods: [],
      addCustomFood: (food) => {
        const created: Food = { ...food, id: uid(), creadoPorUsuario: true };
        set((state) => ({ customFoods: [created, ...state.customFoods] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertCustomFood(created, uidUser);
        return created;
      },
      updateCustomFood: (id, patch) => {
        set((state) => ({
          customFoods: state.customFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateCustomFood(id, patch, uidUser);
      },
      upsertFoodOverride: (id, patch) => {
        const alreadyCustom = get().customFoods.some((f) => f.id === id);
        set((state) => {
          if (alreadyCustom) {
            return { customFoods: state.customFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
          }
          const base = BASE_FOODS.find((f) => f.id === id);
          if (!base) return {};
          return { customFoods: [{ ...base, ...patch }, ...state.customFoods] };
        });
        // Nota: `custom_foods.id` en Supabase es `uuid` (ver migración
        // 0002_module_data_sync.sql) — un override de un alimento base usa
        // el mismo id de texto que el alimento (p.ej. "pechuga-pollo"), que
        // no es un uuid válido, así que por ahora este tipo de override es
        // SOLO LOCAL (localStorage), no se sincroniza entre dispositivos.
        // TODO: si esto se vuelve un problema real, agregar una tabla
        // aparte (p.ej. food_overrides con food_id text) para sincronizarlo.
        const uidUser = getCurrentUserId();
        if (uidUser && alreadyCustom) syncUpdateCustomFood(id, patch, uidUser);
      },
      favoriteFoodIds: [],
      toggleFavoriteFood: (foodId) => {
        const wasFavorite = get().favoriteFoodIds.includes(foodId);
        set((state) => ({
          favoriteFoodIds: wasFavorite
            ? state.favoriteFoodIds.filter((id) => id !== foodId)
            : [...state.favoriteFoodIds, foodId],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          if (wasFavorite) syncRemoveFavoriteFood(foodId, uidUser);
          else syncAddFavoriteFood(foodId, uidUser);
        }
      },
      customPortionsByFood: {},
      addCustomPortion: (foodId, portion) => {
        set((state) => ({
          customPortionsByFood: {
            ...state.customPortionsByFood,
            [foodId]: [...(state.customPortionsByFood[foodId] ?? []), portion],
          },
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertCustomPortion(foodId, portion, uidUser);
      },

      // Recipes
      recipes: [],
      addRecipe: (recipe) => {
        const created: Recipe = { ...recipe, id: uid(), createdAt: Date.now() };
        set((state) => ({ recipes: [created, ...state.recipes] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertRecipe(created, uidUser);
        return created;
      },
      updateRecipe: (id, patch) => {
        set((state) => ({
          recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateRecipe(id, patch, uidUser);
      },
      toggleFavoriteRecipe: (id) => {
        let nextFavorito = false;
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== id) return r;
            nextFavorito = !r.favorito;
            return { ...r, favorito: nextFavorito };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateRecipe(id, { favorito: nextFavorito }, uidUser);
      },
      deleteRecipe: (id) => {
        set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteRecipe(id, uidUser);
      },

      // Water
      waterGoalMl: 2500,
      waterEntries: [],
      addWater: (ml, drink) => {
        const created: WaterEntry = {
          id: uid(),
          ml,
          timestamp: Date.now(),
          drinkId: drink?.id,
          drinkNombre: drink?.nombre,
          drinkEmoji: drink?.emoji,
        };
        set((state) => ({
          waterEntries: [...state.waterEntries, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertWaterEntry(created, uidUser);
      },
      removeWaterEntry: (id) => {
        set((state) => ({
          waterEntries: state.waterEntries.filter((w) => w.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteWaterEntry(id, uidUser);
      },

      // Bebidas (drinkOverrides/hiddenDrinkIds sincronizan solos vía la
      // suscripción de gym_settings al final de este archivo)
      drinkOverrides: {},
      setDrinkOverride: (id, patch) =>
        set((state) => ({
          drinkOverrides: {
            ...state.drinkOverrides,
            [id]: { ...state.drinkOverrides[id], ...patch },
          },
        })),
      hiddenDrinkIds: [],
      toggleDrinkHidden: (id) =>
        set((state) => ({
          hiddenDrinkIds: state.hiddenDrinkIds.includes(id)
            ? state.hiddenDrinkIds.filter((d) => d !== id)
            : [...state.hiddenDrinkIds, id],
        })),

      // Workout
      weeklyPlan: DEFAULT_WEEKLY_PLAN,
      sessions: [],
      activeSession: null,
      activeExerciseIndex: 0,
      sessionStartedAt: null,
      restingExerciseId: null,
      restEndsAt: null,
      startWorkout: (grupoMuscular, exerciseIds, routineId) =>
        set(() => ({
          activeSession: {
            id: uid(),
            date: new Date().toISOString(),
            grupoMuscular,
            routineId,
            ejercicios: exerciseIds.map<WorkoutExerciseLog>((exerciseId) => ({
              exerciseId,
              restSeconds: 90,
              sets: [
                { id: uid(), peso: 0, reps: 10, completado: false, fallo: false, tipo: "normal" },
                { id: uid(), peso: 0, reps: 10, completado: false, fallo: false, tipo: "normal" },
                { id: uid(), peso: 0, reps: 10, completado: false, fallo: false, tipo: "normal" },
              ],
            })),
            completado: false,
          },
          activeExerciseIndex: 0,
          sessionStartedAt: Date.now(),
          restingExerciseId: null,
          restEndsAt: null,
        })),
      startWorkoutFromRoutine: (routine) =>
        set(() => ({
          activeSession: {
            id: uid(),
            date: new Date().toISOString(),
            grupoMuscular: "Cardio", // placeholder, distribution shown separately
            routineId: routine.id,
            nombre: routine.nombre,
            ejercicios: routine.ejercicios.map<WorkoutExerciseLog>((rex) => ({
              exerciseId: rex.exerciseId,
              nota: rex.nota,
              restSeconds: 90,
              sets: rex.sets.map((s) => ({
                id: uid(),
                peso: s.peso,
                reps: s.reps,
                completado: false,
                fallo: false,
                tipo: s.tipo,
                soloReps: rex.soloReps,
              })),
            })),
            completado: false,
          },
          activeExerciseIndex: 0,
          sessionStartedAt: Date.now(),
          restingExerciseId: null,
          restEndsAt: null,
        })),
      setActiveExerciseIndex: (i) => set({ activeExerciseIndex: i }),
      addSetToExercise: (exerciseId) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === exerciseId
                  ? {
                      ...ex,
                      sets: [
                        ...ex.sets,
                        {
                          id: uid(),
                          peso: ex.sets[ex.sets.length - 1]?.peso ?? 0,
                          reps: ex.sets[ex.sets.length - 1]?.reps ?? 10,
                          completado: false,
                          fallo: false,
                          tipo: "normal" as const,
                        },
                      ],
                    }
                  : ex,
              ),
            },
          };
        }),
      updateSet: (exerciseId, setId, patch) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === exerciseId
                  ? {
                      ...ex,
                      sets: ex.sets.map((s) =>
                        s.id === setId ? { ...s, ...patch } : s,
                      ),
                    }
                  : ex,
              ),
            },
          };
        }),
      removeSet: (exerciseId, setId) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === exerciseId
                  ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
                  : ex,
              ),
            },
          };
        }),
      replaceExercise: (oldExerciseId, newExerciseId) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === oldExerciseId
                  ? { ...ex, exerciseId: newExerciseId }
                  : ex,
              ),
            },
          };
        }),
      setExerciseNote: (exerciseId, nota) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === exerciseId ? { ...ex, nota } : ex,
              ),
            },
          };
        }),
      setExerciseRest: (exerciseId, seconds) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              ejercicios: state.activeSession.ejercicios.map((ex) =>
                ex.exerciseId === exerciseId ? { ...ex, restSeconds: seconds } : ex,
              ),
            },
          };
        }),
      startRest: (exerciseId, seconds) =>
        set({ restingExerciseId: exerciseId, restEndsAt: Date.now() + seconds * 1000 }),
      adjustRest: (deltaSeconds) =>
        set((state) => {
          if (!state.restEndsAt) return state;
          const next = state.restEndsAt + deltaSeconds * 1000;
          return { restEndsAt: Math.max(Date.now(), next) };
        }),
      clearRest: () => set({ restingExerciseId: null, restEndsAt: null }),
      finishWorkout: (opts) => {
        let finished: WorkoutSession | null = null;
        set((state) => {
          if (!state.activeSession) return state;
          const durationSeconds = state.sessionStartedAt
            ? Math.round((Date.now() - state.sessionStartedAt) / 1000)
            : undefined;
          finished = {
            ...state.activeSession,
            nombre: opts?.nombre ?? state.activeSession.nombre,
            completado: true,
            durationSeconds,
          };
          const today = new Date();
          let streak = state.streak;
          if (state.lastWorkoutCompletedDate) {
            const last = new Date(state.lastWorkoutCompletedDate);
            const diff = differenceInCalendarDays(today, last);
            if (diff === 1) streak += 1;
            else if (diff > 1) streak = 1;
          } else {
            streak = 1;
          }
          return {
            sessions: [finished, ...state.sessions],
            activeSession: null,
            activeExerciseIndex: 0,
            sessionStartedAt: null,
            restingExerciseId: null,
            restEndsAt: null,
            streak,
            lastWorkoutCompletedDate: today.toISOString(),
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && finished) syncInsertWorkoutSession(finished, uidUser);
      },
      cancelWorkout: () =>
        set({
          activeSession: null,
          activeExerciseIndex: 0,
          sessionStartedAt: null,
          restingExerciseId: null,
          restEndsAt: null,
        }),

      // Routines
      routines: [],
      saveRoutine: (nombre, ejercicios) => {
        const routine: Routine = {
          id: uid(),
          nombre,
          ejercicios,
          createdAt: Date.now(),
          timesCompleted: 0,
        };
        set((state) => ({ routines: [routine, ...state.routines] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertRoutine(routine, uidUser);
        return routine;
      },
      updateRoutine: (id, patch) => {
        set((state) => ({
          routines: state.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateRoutine(id, patch, uidUser);
      },
      deleteRoutine: (id) => {
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteRoutine(id, uidUser);
      },
      incrementRoutineCompleted: (id) => {
        let nextTimesCompleted = 0;
        set((state) => ({
          routines: state.routines.map((r) => {
            if (r.id !== id) return r;
            nextTimesCompleted = r.timesCompleted + 1;
            return { ...r, timesCompleted: nextTimesCompleted };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateRoutine(id, { timesCompleted: nextTimesCompleted }, uidUser);
      },

      // Training plans
      plans: [],
      activePlanId: null,
      createPlan: (plan) => {
        const created: TrainingPlan = { ...plan, id: uid(), createdAt: Date.now() };
        set((state) => ({ plans: [created, ...state.plans] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertPlan(created, uidUser);
        return created;
      },
      setActivePlan: (id) => {
        const allIds = get().plans.map((p) => p.id);
        set((state) => ({
          activePlanId: id,
          plans: state.plans.map((p) => ({ ...p, activo: p.id === id })),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncSetActivePlan(allIds, id, uidUser);
      },
      applyPlanToWeek: (id) => {
        const plan = get().plans.find((p) => p.id === id);
        if (!plan) return;
        // weeklyPlan/activePlanId viven en gym_workout_state y sincronizan
        // solos vía la suscripción al final de este archivo.
        set({ weeklyPlan: plan.dias, activePlanId: id });
      },
      updatePlanDay: (planId, dayIndex, patch) => {
        let patchedDias: WeeklyPlanDay[] | null = null;
        set((state) => {
          const plans = state.plans.map((p) => {
            if (p.id !== planId) return p;
            const dias = p.dias.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d));
            patchedDias = dias;
            return { ...p, dias };
          });
          const patchedPlan = plans.find((p) => p.id === planId);
          const weeklyPlan =
            state.activePlanId === planId && patchedPlan ? patchedPlan.dias : state.weeklyPlan;
          return { plans, weeklyPlan };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && patchedDias) syncUpdatePlan(planId, { dias: patchedDias }, uidUser);
      },
      updatePlan: (id, patch) => {
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdatePlan(id, patch, uidUser);
      },

      // Rank preferences (excludedFromGlobalRank vive en gym_workout_state,
      // sincroniza solo vía la suscripción al final de este archivo)
      excludedFromGlobalRank: [],
      toggleExerciseGlobalRank: (exerciseId) =>
        set((state) => ({
          excludedFromGlobalRank: state.excludedFromGlobalRank.includes(exerciseId)
            ? state.excludedFromGlobalRank.filter((id) => id !== exerciseId)
            : [...state.excludedFromGlobalRank, exerciseId],
        })),

      // Custom exercises
      customExercises: [],
      addCustomExercise: (ex) => {
        const created: Exercise = { ...ex, id: uid() };
        set((state) => ({ customExercises: [...state.customExercises, created] }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertCustomExercise(created, uidUser);
        return created;
      },

      // Weight tracker
      weightEntries: [],
      addWeightEntry: (kg, date) => {
        const created: WeightEntry = { id: uid(), kg, date: date ?? new Date().toISOString() };
        set((state) => ({
          weightEntries: [created, ...state.weightEntries].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertWeightEntry(created, uidUser);
      },
      removeWeightEntry: (id) => {
        set((state) => ({
          weightEntries: state.weightEntries.filter((w) => w.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteWeightEntry(id, uidUser);
      },

      // Streak
      streak: 0,
      lastWorkoutCompletedDate: null,

      // Kegel (todos estos campos viven en gym_workout_state y sincronizan
      // solos vía la suscripción al final de este archivo)
      kegelLevel: 1,
      kegelStreak: 0,
      kegelLastSessionDate: null,
      kegelTotalSessions: 0,
      completeKegelSession: () =>
        set((state) => {
          const today = new Date();
          let streak = state.kegelStreak;
          if (state.kegelLastSessionDate) {
            const last = new Date(state.kegelLastSessionDate);
            const diff = differenceInCalendarDays(today, last);
            if (diff === 1) streak += 1;
            else if (diff > 1) streak = 1;
            // diff === 0 -> already did a session today, keep streak
          } else {
            streak = 1;
          }
          const totalSessions = state.kegelTotalSessions + 1;
          const level = Math.min(10, 1 + Math.floor(totalSessions / 5));
          return {
            kegelStreak: streak,
            kegelLastSessionDate: today.toISOString(),
            kegelTotalSessions: totalSessions,
            kegelLevel: level,
          };
        }),

      // Dashboard personalization
      dashboardPrefs: {
        showOtherNutrients: true,
        showWeekStrip: true,
        showFinishDayButton: true,
      },
      setDashboardPref: (key, value) =>
        set((state) => ({
          dashboardPrefs: { ...state.dashboardPrefs, [key]: value },
        })),

      // Remote sync (Supabase)
      _hydrateFromRemote: (patch) => {
        isHydratingFromRemote = true;
        set(patch);
        isHydratingFromRemote = false;
      },
    }),
    {
      name: "vida-total-gym-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-gym-store")),
      version: 5,
      migrate: (persisted, version) => {
        const state = persisted as GymState;
        if (version < 5) {
          state.dashboardPrefs = {
            showOtherNutrients: true,
            showWeekStrip: true,
            showFinishDayButton: true,
          };
        }
        if (version < 4) {
          const remap = (m: unknown) => (m === "snacks" ? "snack1" : m);
          if (Array.isArray(state.loggedFoods)) {
            state.loggedFoods = state.loggedFoods.map((f) => ({ ...f, meal: remap(f.meal) as MealType }));
          }
          if (Array.isArray(state.recipes)) {
            state.recipes = state.recipes.map((r) => ({
              ...r,
              tipos: (r.tipos ?? []).map((t) => remap(t) as MealType),
            }));
          }
        }
        return state;
      },
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — wiring
// ============================================================================
//
// Dos mecanismos distintos, a propósito:
//
// 1) Entidades (loggedFoods, customFoods, recipes, routines, etc.): cada
//    acción del store de arriba llama directamente a su función `syncXxx`
//    correspondiente (src/lib/sync/gym-sync.ts) justo después de `set(...)`,
//    fire-and-forget. Se pudo instrumentar así porque siempre pasan por una
//    acción nombrada del store.
//
// 2) "Settings" (gym_settings y gym_workout_state): varios de estos campos
//    (p.ej. calorieGoal/proteinGoal/carbsGoal/fatGoal) se mutan hoy con
//    `useGymStore.setState(...)` directo desde componentes de UI, sin pasar
//    por una acción del store — instrumentar acción por acción no los
//    cubriría. En su lugar, nos suscribimos al store completo y comparamos
//    referencias de los campos relevantes (zustand hace merge shallow en
//    `set`, así que un campo que no cambió conserva la MISMA referencia
//    entre el estado anterior y el nuevo — comparar con `!==` alcanza, sin
//    necesitar un deep-equal). Esto también nos da el debounce pedido
//    (~800ms) en un solo lugar en vez de repetirlo en cada setter.

const SETTINGS_KEYS = [
  "calorieGoal",
  "proteinGoal",
  "carbsGoal",
  "fatGoal",
  "waterGoalMl",
  "trackedNutrients",
  "showRemaining",
  "dashboardPrefs",
  "dayFinishedDate",
  "drinkOverrides",
  "hiddenDrinkIds",
] as const satisfies readonly (keyof GymState)[];

const WORKOUT_STATE_KEYS = [
  "activePlanId",
  "weeklyPlan",
  "excludedFromGlobalRank",
  "streak",
  "lastWorkoutCompletedDate",
  "kegelLevel",
  "kegelStreak",
  "kegelLastSessionDate",
  "kegelTotalSessions",
] as const satisfies readonly (keyof GymState)[];

function pick<K extends keyof GymState>(state: GymState, keys: readonly K[]): Pick<GymState, K> {
  const result = {} as Pick<GymState, K>;
  for (const key of keys) result[key] = state[key];
  return result;
}

const DEBOUNCE_MS = 800;
let settingsDebounce: ReturnType<typeof setTimeout> | null = null;
let workoutStateDebounce: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== "undefined") {
  useGymStore.subscribe((state, prevState) => {
    if (isHydratingFromRemote) return;
    const uidUser = getCurrentUserId();
    if (!uidUser) return;

    if (SETTINGS_KEYS.some((key) => state[key] !== prevState[key])) {
      if (settingsDebounce) clearTimeout(settingsDebounce);
      const snapshot = pick(state, SETTINGS_KEYS);
      settingsDebounce = setTimeout(() => {
        void upsertGymSettings(uidUser, snapshot);
      }, DEBOUNCE_MS);
    }

    if (WORKOUT_STATE_KEYS.some((key) => state[key] !== prevState[key])) {
      if (workoutStateDebounce) clearTimeout(workoutStateDebounce);
      const snapshot = pick(state, WORKOUT_STATE_KEYS);
      workoutStateDebounce = setTimeout(() => {
        void upsertGymWorkoutState(uidUser, snapshot);
      }, DEBOUNCE_MS);
    }
  });
}

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce — nunca
 * borra datos locales. Fundamental para la primera sincronización de un
 * usuario que ya venía usando la app antes de que existiera esta capa: en
 * ese caso las 14 tablas de Supabase están vacías (no hay ninguna fila
 * para `userId` todavía), y un merge ingenuo tipo "el remoto manda"
 * reemplazaría meses de historial local por arrays vacíos en el primer
 * login. Devuelve también las filas que eran solo locales, para que el
 * llamador las suba a Supabase (backfill) y dejen de ser solo-locales.
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/** Igual que `mergeById` pero para arrays de ids simples (favoriteFoodIds). */
function mergeIds(remote: string[], local: string[]): { merged: string[]; localOnly: string[] } {
  const remoteSet = new Set(remote);
  const localOnly = local.filter((id) => !remoteSet.has(id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Trae las 14 tablas de Gym de Supabase para `userId`, las MEZCLA (nunca
 * reemplaza) con lo que ya hay en el store, y sube (backfill) cualquier
 * dato que solo existiera localmente — así un usuario que ya tenía meses
 * de historial en este dispositivo termina con esos datos también en la
 * nube en su primer login post-sync, en vez de perderlos. Pensado para
 * llamarse UNA vez por sesión de login, apenas se conoce el userId (ver
 * `UserScopeScript`). Tolerante a fallos: si Supabase no responde, cada
 * tabla cae de vuelta a `[]`/`{}` y el merge deja todo el estado local
 * intacto (mezclar con vacío no quita nada).
 */
export async function hydrateGymStore(userId: string): Promise<void> {
  const remote: GymHydratedState = await hydrateGymStoreFromSupabase(userId);
  const local = useGymStore.getState();

  const loggedFoods = mergeById(remote.loggedFoods, local.loggedFoods);
  const mealTemplates = mergeById(remote.mealTemplates, local.mealTemplates);
  const customFoods = mergeById(remote.customFoods, local.customFoods);
  const favoriteFoodIds = mergeIds(remote.favoriteFoodIds, local.favoriteFoodIds);
  const recipes = mergeById(remote.recipes, local.recipes);
  const waterEntries = mergeById(remote.waterEntries, local.waterEntries);
  const sessions = mergeById(remote.sessions, local.sessions);
  const routines = mergeById(remote.routines, local.routines);
  const plans = mergeById(remote.plans, local.plans);
  const customExercises = mergeById(remote.customExercises, local.customExercises);
  const weightEntries = mergeById(remote.weightEntries, local.weightEntries);

  // customPortionsByFood: Record<foodId, FoodPortion[]> — no tiene `id`
  // propio, se deduplica por (nombre, gramos) dentro de cada food.
  const customPortionsByFood: Record<string, FoodPortion[]> = { ...remote.customPortionsByFood };
  const localOnlyPortions: { foodId: string; portion: FoodPortion }[] = [];
  for (const [foodId, localPortions] of Object.entries(local.customPortionsByFood)) {
    const remotePortions = customPortionsByFood[foodId] ?? [];
    const known = new Set(remotePortions.map((p) => `${p.nombre}__${p.gramos}`));
    const extra = localPortions.filter((p) => !known.has(`${p.nombre}__${p.gramos}`));
    if (extra.length > 0) {
      customPortionsByFood[foodId] = [...remotePortions, ...extra];
      for (const portion of extra) localOnlyPortions.push({ foodId, portion });
    } else if (remotePortions.length > 0) {
      customPortionsByFood[foodId] = remotePortions;
    }
  }

  const patch: Partial<GymState> = {
    loggedFoods: loggedFoods.merged,
    mealTemplates: mealTemplates.merged,
    customFoods: customFoods.merged,
    favoriteFoodIds: favoriteFoodIds.merged,
    customPortionsByFood,
    recipes: recipes.merged,
    waterEntries: waterEntries.merged,
    sessions: sessions.merged,
    routines: routines.merged,
    plans: plans.merged,
    customExercises: customExercises.merged,
    weightEntries: weightEntries.merged,
    ...remote.settings,
    ...remote.workoutState,
  };
  useGymStore.getState()._hydrateFromRemote(patch);

  // Backfill: sube a Supabase lo que era solo local, para que un usuario
  // con historial previo a esta capa de sync termine de verdad con sus
  // datos en la nube (y no solo "conservados localmente para siempre").
  // orden de logged_foods: se recalcula agrupando por (meal, día) igual
  // que hace `addLoggedFood` al insertar uno nuevo.
  const ordenSeen = new Map<string, number>();
  for (const food of loggedFoods.localOnly) {
    const groupKey = `${food.meal}__${new Date(food.timestamp).toDateString()}`;
    const orden = ordenSeen.get(groupKey) ?? 0;
    ordenSeen.set(groupKey, orden + 1);
    syncInsertLoggedFood(food, orden, userId);
  }
  for (const template of mealTemplates.localOnly) syncInsertMealTemplate(template, userId);
  for (const food of customFoods.localOnly) syncInsertCustomFood(food, userId);
  for (const foodId of favoriteFoodIds.localOnly) syncAddFavoriteFood(foodId, userId);
  for (const { foodId, portion } of localOnlyPortions) syncInsertCustomPortion(foodId, portion, userId);
  for (const recipe of recipes.localOnly) syncInsertRecipe(recipe, userId);
  for (const entry of waterEntries.localOnly) syncInsertWaterEntry(entry, userId);
  for (const session of sessions.localOnly) syncInsertWorkoutSession(session, userId);
  for (const routine of routines.localOnly) syncInsertRoutine(routine, userId);
  for (const plan of plans.localOnly) syncInsertPlan(plan, userId);
  for (const exercise of customExercises.localOnly) syncInsertCustomExercise(exercise, userId);
  for (const entry of weightEntries.localOnly) syncInsertWeightEntry(entry, userId);
}

// ---------- Selectors / helpers ----------

export function useTodayLoggedFoods() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const now = new Date();
  return loggedFoods.filter((f) => isSameDay(new Date(f.timestamp), now));
}

/** Como useTodayLoggedFoods, pero para cualquier día — usado en la pantalla
 * de Calorías para poder retroceder/avanzar de fecha y ver/copiar el
 * registro de otros días. */
export function useLoggedFoodsForDate(date: Date) {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  return loggedFoods.filter((f) => isSameDay(new Date(f.timestamp), date));
}

export function useTodayWaterEntries() {
  const waterEntries = useGymStore((s) => s.waterEntries);
  const now = new Date();
  return waterEntries.filter((w) => isSameDay(new Date(w.timestamp), now));
}

export function mealTotals(foods: LoggedFood[], meal: MealType) {
  return foods
    .filter((f) => f.meal === meal)
    .reduce((sum, f) => sum + f.calorias, 0);
}

/** Most recently logged foods, unique by foodId, newest first. */
export function useRecentFoods(limit = 12) {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const seen = new Set<string>();
  const recent: LoggedFood[] = [];
  for (const f of [...loggedFoods].sort((a, b) => b.timestamp - a.timestamp)) {
    if (seen.has(f.foodId)) continue;
    seen.add(f.foodId);
    recent.push(f);
    if (recent.length >= limit) break;
  }
  return recent;
}
