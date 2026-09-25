import { animationEngine } from "@/lib/animations/animation-engine";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { crossedLevelMilestone } from "@/lib/progress";
import { collectionChange } from "@/lib/3d/scene-collection";
import { habitFigureConfigs } from "@/lib/3d/scene-registry";
import type { ProgressResult } from "@/lib/progress/types";
import type { Habit } from "@/lib/types/habits";

export function isQuantified(habit: Pick<Habit, "type">): boolean {
  return habit.type === "cantidad" || habit.type === "tiempo";
}

/** Cuánto suma cada repetición (mantener presionado) en un hábito de
 * cantidad (+1) o de tiempo (+5 min, o +10 si la meta es de una hora o más). */
export function progressStep(habit: Pick<Habit, "type" | "goal">): number {
  if (habit.type === "tiempo") return (habit.goal ?? 0) >= 60 ? 10 : 5;
  return 1;
}

/** Eventos de una completación del día (y de los hitos que cruza). */
function emitCompletion(habitId: string, prevTotal: number, result: ProgressResult | null) {
  const animationEvent = animationEngine.emit.bind(animationEngine);
  animationEvent({ type: "habit.completed", tier: "action", entityId: habitId, meta: { streak: result?.streak } });

  // Colección de figuras 3D: ¿esta repetición construye una etapa de la figura en curso (y quizá la completa
  // y desbloquea la siguiente)? La escena solo RECIBE este aviso; el progreso lo calcula el store/Progress
  // Engine. Un pequeño desfase deja que primero se vea el check completado.
  const scene = collectionChange(habitFigureConfigs(), prevTotal, prevTotal + 1);
  if (scene.changed) {
    setTimeout(() => {
      const meta = {
        stageFrom: scene.from,
        stageTo: scene.to,
        sceneId: scene.figureId,
        totalFrom: prevTotal,
        totalTo: prevTotal + 1,
        unlockedSceneId: scene.unlockedFigureId,
        figureCompleted: scene.completedNow,
      };
      // La celebración (scene.completed / scene.unlocked, con su sonido y háptico) la emite la vista FIGURA en el
      // momento en que se ve, para que suene junto con la animación y no antes.
      animationEvent({ type: "scene.stage.changed", tier: scene.completedNow ? "epic" : "action", entityId: habitId, meta });
    }, 250);
  }

  // Hito por repeticiones (10/20/…/60): jerarquía "milestone", el 60 es "epic".
  const crossed = crossedLevelMilestone(prevTotal, prevTotal + 1);
  if (crossed) {
    setTimeout(() => {
      animationEvent(
        crossed >= 60
          ? { type: "habit.levelUp", tier: "epic", entityId: habitId, meta: { count: crossed, level: crossed / 10 } }
          : { type: "habit.milestone", tier: "milestone", entityId: habitId, meta: { count: crossed, level: crossed / 10 } },
      );
    }, 380);
  }
  // Si esta repetición además construye la figura 3D, esa secuencia manda: no se apila la celebración de la racha.
  if (result?.milestoneReached && !scene.changed) {
    // Racha de 7/21/66: si además hubo hito de repeticiones, va después para
    // que las dos ceremonias no se pisen.
    setTimeout(() => {
      animationEvent({
        type: "streak.milestone",
        tier: "milestone",
        entityId: habitId,
        meta: { streak: result.streak, milestone: result.milestoneReached ?? undefined },
      });
    }, crossed ? 2600 : 380);
  }
}

/**
 * Business action: registrar una repetición del hábito HOY. La UI nunca hace
 * `setCompleted(true)` — llama esto, que pasa por el store → Progress
 * Engine y después avisa al Animation Engine (que decide sonido, háptico y
 * animación; este módulo no sabe cuáles existen).
 *
 * - Sí/No: completa el hábito.
 * - Cantidad/tiempo: suma un paso; el hábito se completa al llegar a la meta
 *   (mientras tanto solo emite `habit.progress`).
 */
export function completeHabit(habitId: string): ProgressResult | null {
  const state = useHabitsStore.getState();
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit || habit.completedDates.includes(todayISO())) return null;
  const prevTotal = habit.completedDates.length;

  if (isQuantified(habit)) {
    const outcome = state.addHabitProgress(habitId, progressStep(habit));
    if (!outcome) return null;
    if (!outcome.completedNow) {
      animationEngine.emit({
        type: "habit.progress",
        tier: "micro",
        entityId: habitId,
        meta: { count: outcome.value, level: outcome.goal },
      });
      return null;
    }
    emitCompletion(habitId, prevTotal, outcome.result);
    return outcome.result;
  }

  const result = state.toggleHabitToday(habitId);
  emitCompletion(habitId, prevTotal, result);
  return result;
}

/** Deshacer la completación de hoy. Sin ceremonia (no es un logro). */
export function undoHabit(habitId: string): void {
  const habit = useHabitsStore.getState().habits.find((h) => h.id === habitId);
  if (!habit || !habit.completedDates.includes(todayISO())) return;
  useHabitsStore.getState().toggleHabitToday(habitId);
}
