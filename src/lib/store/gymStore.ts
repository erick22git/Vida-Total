import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isSameDay, differenceInCalendarDays } from "date-fns";
import type {
  Exercise,
  LoggedFood,
  MealType,
  MuscleGroup,
  Routine,
  RoutineExercise,
  TrainingPlan,
  WaterEntry,
  WeeklyPlanDay,
  WeightEntry,
  WorkoutExerciseLog,
  WorkoutSession,
  WorkoutSet,
} from "@/lib/types";
import { DEFAULT_WEEKLY_PLAN } from "@/lib/data/weekly-plan";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  ) => void;
  removeLoggedFood: (id: string) => void;

  // ---------- Water ----------
  waterGoalMl: number;
  waterEntries: WaterEntry[];
  addWater: (ml: number) => void;
  removeWaterEntry: (id: string) => void;

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
      addLoggedFood: (food) =>
        set((state) => ({
          loggedFoods: [
            ...state.loggedFoods,
            { ...food, id: uid(), timestamp: Date.now() },
          ],
        })),
      removeLoggedFood: (id) =>
        set((state) => ({
          loggedFoods: state.loggedFoods.filter((f) => f.id !== id),
        })),

      // Water
      waterGoalMl: 2500,
      waterEntries: [],
      addWater: (ml) =>
        set((state) => ({
          waterEntries: [
            ...state.waterEntries,
            { id: uid(), ml, timestamp: Date.now() },
          ],
        })),
      removeWaterEntry: (id) =>
        set((state) => ({
          waterEntries: state.waterEntries.filter((w) => w.id !== id),
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
    }),
    {
      name: "vida-total-gym-store",
      storage: createJSONStorage(() => localStorage),
      version: 2,
    },
  ),
);

// ---------- Selectors / helpers ----------

export function useTodayLoggedFoods() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const now = new Date();
  return loggedFoods.filter((f) => isSameDay(new Date(f.timestamp), now));
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
