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
import { DEFAULT_WEEKLY_PLAN } from "@/lib/data/weekly-plan";
import type { DrinkOverride } from "@/lib/data/drinks";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

interface GymState {
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
        set((state) => ({
          loggedFoods: [...state.loggedFoods, created],
        }));
        return created;
      },
      removeLoggedFood: (id) =>
        set((state) => ({
          loggedFoods: state.loggedFoods.filter((f) => f.id !== id),
        })),
      updateLoggedFood: (id, patch) =>
        set((state) => ({
          loggedFoods: state.loggedFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      reorderMealFoods: (meal, orderedIds, date) =>
        set((state) => {
          const day = date ?? new Date();
          const inMeal = (f: LoggedFood) => f.meal === meal && isSameDay(new Date(f.timestamp), day);
          const others = state.loggedFoods.filter((f) => !inMeal(f));
          const map = new Map(state.loggedFoods.filter(inMeal).map((f) => [f.id, f] as const));
          const reordered = orderedIds.map((id) => map.get(id)).filter((f): f is LoggedFood => !!f);
          return { loggedFoods: [...others, ...reordered] };
        }),

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
      pasteMeal: (meal, date) =>
        set((state) => {
          if (!state.mealClipboard || state.mealClipboard.length === 0) return state;
          const day = date ?? new Date();
          const pasted = state.mealClipboard.map((f) => ({
            ...f,
            id: uid(),
            meal,
            timestamp: timestampForDate(day),
          }));
          return { loggedFoods: [...state.loggedFoods, ...pasted] };
        }),
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
        set((s) => ({
          loggedFoods: [
            ...s.loggedFoods,
            ...lastMealItems.map((f) => ({ ...f, id: uid(), timestamp: timestampForDate(day) })),
          ],
        }));
        return true;
      },
      clearMeal: (meal, date) =>
        set((state) => {
          const day = date ?? new Date();
          return {
            loggedFoods: state.loggedFoods.filter(
              (f) => !(f.meal === meal && isSameDay(new Date(f.timestamp), day)),
            ),
          };
        }),
      scaleMealPortions: (meal, factor, date) =>
        set((state) => {
          const day = date ?? new Date();
          return {
            loggedFoods: state.loggedFoods.map((f) =>
              f.meal === meal && isSameDay(new Date(f.timestamp), day)
                ? {
                    ...f,
                    calorias: Math.round(f.calorias * factor),
                    proteina: Math.round(f.proteina * factor * 10) / 10,
                    carbos: Math.round(f.carbos * factor * 10) / 10,
                    grasas: Math.round(f.grasas * factor * 10) / 10,
                    cantidad: f.cantidad ? Math.round(f.cantidad * factor * 100) / 100 : f.cantidad,
                    gramos: f.gramos ? Math.round(f.gramos * factor * 10) / 10 : f.gramos,
                  }
                : f,
            ),
          };
        }),
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
        return template;
      },
      applyMealTemplate: (templateId, meal) =>
        set((state) => {
          const template = state.mealTemplates.find((t) => t.id === templateId);
          if (!template) return state;
          return {
            loggedFoods: [
              ...state.loggedFoods,
              ...template.items.map((item) => ({
                ...item,
                id: uid(),
                timestamp: Date.now(),
                meal,
              })),
            ],
          };
        }),

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
        const created: Food = { ...food, id: `custom-${uid()}`, creadoPorUsuario: true };
        set((state) => ({ customFoods: [created, ...state.customFoods] }));
        return created;
      },
      updateCustomFood: (id, patch) =>
        set((state) => ({
          customFoods: state.customFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      favoriteFoodIds: [],
      toggleFavoriteFood: (foodId) =>
        set((state) => ({
          favoriteFoodIds: state.favoriteFoodIds.includes(foodId)
            ? state.favoriteFoodIds.filter((id) => id !== foodId)
            : [...state.favoriteFoodIds, foodId],
        })),
      customPortionsByFood: {},
      addCustomPortion: (foodId, portion) =>
        set((state) => ({
          customPortionsByFood: {
            ...state.customPortionsByFood,
            [foodId]: [...(state.customPortionsByFood[foodId] ?? []), portion],
          },
        })),

      // Recipes
      recipes: [],
      addRecipe: (recipe) => {
        const created: Recipe = { ...recipe, id: `recipe-${uid()}`, createdAt: Date.now() };
        set((state) => ({ recipes: [created, ...state.recipes] }));
        return created;
      },
      updateRecipe: (id, patch) =>
        set((state) => ({
          recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      toggleFavoriteRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, favorito: !r.favorito } : r,
          ),
        })),
      deleteRecipe: (id) =>
        set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) })),

      // Water
      waterGoalMl: 2500,
      waterEntries: [],
      addWater: (ml, drink) =>
        set((state) => ({
          waterEntries: [
            ...state.waterEntries,
            {
              id: uid(),
              ml,
              timestamp: Date.now(),
              drinkId: drink?.id,
              drinkNombre: drink?.nombre,
              drinkEmoji: drink?.emoji,
            },
          ],
        })),
      removeWaterEntry: (id) =>
        set((state) => ({
          waterEntries: state.waterEntries.filter((w) => w.id !== id),
        })),

      // Bebidas
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
      finishWorkout: (opts) =>
        set((state) => {
          if (!state.activeSession) return state;
          const durationSeconds = state.sessionStartedAt
            ? Math.round((Date.now() - state.sessionStartedAt) / 1000)
            : undefined;
          const finished: WorkoutSession = {
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
        }),
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
        return routine;
      },
      updateRoutine: (id, patch) =>
        set((state) => ({
          routines: state.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      deleteRoutine: (id) =>
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) })),
      incrementRoutineCompleted: (id) =>
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id ? { ...r, timesCompleted: r.timesCompleted + 1 } : r,
          ),
        })),

      // Training plans
      plans: [],
      activePlanId: null,
      createPlan: (plan) => {
        const created: TrainingPlan = { ...plan, id: uid(), createdAt: Date.now() };
        set((state) => ({ plans: [created, ...state.plans] }));
        return created;
      },
      setActivePlan: (id) =>
        set((state) => ({
          activePlanId: id,
          plans: state.plans.map((p) => ({ ...p, activo: p.id === id })),
        })),
      applyPlanToWeek: (id) => {
        const plan = get().plans.find((p) => p.id === id);
        if (!plan) return;
        set({ weeklyPlan: plan.dias, activePlanId: id });
      },
      updatePlanDay: (planId, dayIndex, patch) =>
        set((state) => {
          const plans = state.plans.map((p) =>
            p.id === planId
              ? { ...p, dias: p.dias.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)) }
              : p,
          );
          const patchedPlan = plans.find((p) => p.id === planId);
          const weeklyPlan =
            state.activePlanId === planId && patchedPlan ? patchedPlan.dias : state.weeklyPlan;
          return { plans, weeklyPlan };
        }),
      updatePlan: (id, patch) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      // Rank preferences
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
        const created: Exercise = { ...ex, id: `custom-${uid()}` };
        set((state) => ({ customExercises: [...state.customExercises, created] }));
        return created;
      },

      // Weight tracker
      weightEntries: [],
      addWeightEntry: (kg, date) =>
        set((state) => ({
          weightEntries: [
            { id: uid(), kg, date: date ?? new Date().toISOString() },
            ...state.weightEntries,
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        })),
      removeWeightEntry: (id) =>
        set((state) => ({
          weightEntries: state.weightEntries.filter((w) => w.id !== id),
        })),

      // Streak
      streak: 0,
      lastWorkoutCompletedDate: null,

      // Kegel
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
