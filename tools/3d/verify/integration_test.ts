// Pruebas de la integración Hábitos <-> Gym (sin navegador): categorías -> colección/fuente, colecciones independientes,
// eventos del bus -> hábito correcto -> acción pendiente (nunca completa solo) -> confirmación -> progreso.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/3d/verify/integration_test.ts
import { CATEGORY_PROFILES, profileForCategory } from "../../../src/lib/habits/category-config";
import { habitProgressSource, habitSceneCollection } from "../../../src/lib/habits/habit-links";
import { collectionChange, collectionStateFor } from "../../../src/lib/3d/scene-collection";
import { figureConfigsFor, sceneFigures } from "../../../src/lib/3d/scene-registry";
import { HABIT_CATEGORIES } from "../../../src/lib/data/habit-categories";
import { emitProgressEvent, progressEvents } from "../../../src/lib/progress/event-bus";
import { startSourceDispatcher } from "../../../src/lib/habits/source-dispatcher";
import { useHabitPromptStore, promptForHabit } from "../../../src/lib/habits/habit-prompts";
import { completeHabit } from "../../../src/lib/habits/complete-habit";
import { todayISO, useHabitsStore } from "../../../src/lib/store/habitsStore";
import { detectGymGoals } from "../../../src/lib/gym/goal-events";
import type { Habit } from "../../../src/lib/types/habits";

/* eslint-disable @typescript-eslint/no-explicit-any */
let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log("FALLA", name, JSON.stringify(got), "esperado", JSON.stringify(want));
  } else console.log("ok   ", name);
}

// 1) Categorías reales -> colección y fuente
const byCat = Object.fromEntries(
  HABIT_CATEGORIES.map((c) => [c.id, { col: habitSceneCollection({ categoryId: c.id }), src: habitProgressSource({ categoryId: c.id, sourceId: undefined })?.id ?? null }]),
);
eq("gym -> gym/workout", byCat.gym, { col: "gym", src: "gym.workout" });
eq("agua -> gym/water", byCat.agua, { col: "gym", src: "gym.water" });
eq("comida -> gym/calories", byCat.comida, { col: "gym", src: "gym.calories" });
for (const id of ["sueno", "lectura", "meditacion", "trabajo", "estudio", "movilidad", "higiene", "finanzas"]) eq(`${id} -> habitos sin fuente`, byCat[id], { col: "habitos", src: null });
eq("sin categoría -> habitos", habitSceneCollection({ categoryId: undefined }), "habitos");
eq("categoría desconocida -> habitos", profileForCategory("xyz").sceneCollection, "habitos");
eq("toda entrada de CATEGORY_PROFILES es una categoría real", Object.keys(CATEGORY_PROFILES).every((k) => HABIT_CATEGORIES.some((c) => c.id === k)), true);
eq("sourceId null = sin vínculo", habitProgressSource({ categoryId: "agua", sourceId: null }), undefined);
eq("sourceId explícito manda", habitProgressSource({ categoryId: "trabajo", sourceId: "gym.water" })?.id, "gym.water");

// 2) Colecciones independientes
eq("habitos tiene 6 figuras", sceneFigures("habitos").map((f) => f.name), ["Bosque", "Castillo", "Casa", "Molino", "Cuarto", "Puente"]);
eq("gym tiene 4 figuras", sceneFigures("gym").map((f) => f.name), ["Esqueleto", "BMW M6", "Fórmula 2", "Bomba"]);
eq("7 etapas cada una", [...sceneFigures("habitos"), ...sceneFigures("gym")].every((f) => f.config.totalStages === 7), true);
const gymCfg = figureConfigsFor("gym");
const st = (t: number) => collectionStateFor(gymCfg, t).figures.map((f) => f.status[0] + f.stage);
eq("gym 0", st(0), ["c0", "l0", "l0", "l0"]);
eq("gym 7 desbloquea BMW", st(7), ["c7", "c0", "l0", "l0"]);
eq("gym 28 todo", st(28), ["c7", "c7", "c7", "c7"]);
eq("gym: completar el día 7 desbloquea la siguiente", collectionChange(gymCfg, 6, 7).unlockedFigureId, "bmw_progression_001");
eq("hábitos no se afecta por gym", collectionStateFor(figureConfigsFor("habitos"), 7).figures.map((f) => f.status[0] + f.stage), ["c7", "c0", "l0", "l0", "l0", "l0"]);

// 3) Eventos -> hábito correcto -> pendiente -> confirmación
function habit(id: string, categoryId: string | undefined, extra: Partial<Habit> = {}): Habit {
  return { id, name: id, icon: "Star", color: "#fff", frequency: "diario", streak: 0, completedDates: [], categoryId, milestonesUnlocked: [], ...extra };
}
useHabitsStore.setState({
  habits: [
    habit("h-agua", "agua"),
    habit("h-cal", "comida"),
    habit("h-gym", "gym"),
    habit("h-trabajo", "trabajo"),
    habit("h-agua-off", "agua", { sourceId: null }),
    habit("h-agua-hecho", "agua", { completedDates: [todayISO()] }),
    habit("h-agua-cant", "agua", { type: "cantidad", goal: 8, unit: "vasos" }),
  ],
});
const stop = startSourceDispatcher(() => {});
const pendingIds = () => useHabitPromptStore.getState().prompts.map((p) => p.habitId).sort();

emitProgressEvent("water.goal_reached", "t1");
eq("water -> solo hábitos de agua vinculados y pendientes", pendingIds(), ["h-agua", "h-agua-cant"]);
eq("NO se completó ninguno solo", useHabitsStore.getState().habits.filter((h) => h.id !== "h-agua-hecho").every((h) => h.completedDates.length === 0), true);
emitProgressEvent("calories.goal_reached", "t2");
emitProgressEvent("workout.completed", "t3");
eq("calories + workout suman comida y gym", pendingIds(), ["h-agua", "h-agua-cant", "h-cal", "h-gym"]);
eq("hábito de trabajo / sin vínculo / ya hecho: intactos", pendingIds().some((id) => ["h-trabajo", "h-agua-off", "h-agua-hecho"].includes(id)), false);
emitProgressEvent("sleep.goal_reached", "t4");
eq("evento sin fuente conocida no rompe nada", pendingIds().length, 4);

const before = useHabitsStore.getState().habits.find((h) => h.id === "h-agua")!.completedDates.length;
completeHabit("h-agua");
const after = useHabitsStore.getState().habits.find((h) => h.id === "h-agua")!;
eq("confirmar completa el hábito (+1 repetición)", after.completedDates.length, before + 1);
eq("confirmar limpia el pendiente", promptForHabit(useHabitPromptStore.getState().prompts, "h-agua", todayISO()), undefined);
completeHabit("h-agua-cant");
const cant = useHabitsStore.getState().habits.find((h) => h.id === "h-agua-cant")!;
eq("hábito de cantidad confirmado por la fuente se cierra completo", { done: cant.completedDates.includes(todayISO()), v: cant.values?.[todayISO()] }, { done: true, v: 8 });
completeHabit("h-trabajo");
eq("hábito sin relación se completa normal", useHabitsStore.getState().habits.find((h) => h.id === "h-trabajo")!.completedDates.length, 1);
stop();

// 4) Detector de objetivos de Gym (transiciones, no estado)
const now = new Date();
const base: any = { waterGoalMl: 2500, calorieGoal: 2000, waterEntries: [], loggedFoods: [], sessions: [], lastWorkoutCompletedDate: null };
const seen: string[] = [];
const un = progressEvents.subscribe((e) => seen.push(e.type));
let n = 0;
const entry = (ml: number, ago = 0) => ({ id: `w${n++}`, ml, timestamp: now.getTime() - ago });
detectGymGoals(base, { ...base, waterEntries: [entry(1500)] }, now);
eq("agua bajo la meta: sin evento", seen, []);
detectGymGoals({ ...base, waterEntries: [entry(1500, 60000)] }, { ...base, waterEntries: [entry(1500, 60000), entry(1000)] }, now);
eq("agua cruza la meta: water.goal_reached", seen, ["water.goal_reached"]);
detectGymGoals({ ...base, waterEntries: [entry(2600, 60000)] }, { ...base, waterEntries: [entry(2600, 60000), entry(200)] }, now);
eq("ya estaba sobre la meta: no repite", seen, ["water.goal_reached"]);
detectGymGoals(base, { ...base, waterEntries: [entry(3000, 3_600_000)] }, now);
eq("hidratación (entradas viejas) no dispara", seen, ["water.goal_reached"]);
const food = (kcal: number, ago = 0) => ({ id: `f${n++}`, calorias: kcal, timestamp: now.getTime() - ago, activo: true });
detectGymGoals({ ...base, loggedFoods: [food(1500, 60000)] }, { ...base, loggedFoods: [food(1500, 60000), food(600)] }, now);
eq("calorías cruzan el objetivo", seen, ["water.goal_reached", "calories.goal_reached"]);
detectGymGoals(base, { ...base, sessions: [{ id: "s1", completado: true }], lastWorkoutCompletedDate: now.toISOString() }, now);
eq("entrenamiento terminado", seen, ["water.goal_reached", "calories.goal_reached", "workout.completed"]);
detectGymGoals(base, { ...base, sessions: [{ id: "s2", completado: true }], lastWorkoutCompletedDate: new Date(now.getTime() - 3_600_000).toISOString() }, now);
eq("sesión vieja (hidratación) no dispara", seen.length, 3);
un();

console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
process.exit(fails === 0 ? 0 : 1);
