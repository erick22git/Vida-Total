import type { Milestone } from "@/lib/progress/types";

/**
 * Jerarquía de intensidad — nunca todo el peso visual al mismo nivel.
 * "micro": el tap en sí (feedback instantáneo, ~100-150ms).
 * "action": completar algo (hábito, paso de rutina) — la ceremonia
 *   principal de esta fase (~400-700ms).
 * "milestone": racha de 7/21/66 días — algo más grande, poco frecuente.
 * "epic": reservado para más adelante (subir de nivel, plan completo...).
 */
export type AnimationTier = "micro" | "action" | "milestone" | "epic";

export type AnimationEventType =
  | "check.press-start" // empezó a mantener presionado
  | "check.press-cancel" // soltó antes de tiempo
  | "habit.completed"
  | "scene.stage.changed" // la figura 3D del hábito subió de etapa (día)
  | "scene.completed" // la figura quedó completa
  | "habit.progress" // un paso de un hábito de cantidad/tiempo (aún sin completar)
  | "habit.swipeNext" // cambio horizontal al hábito siguiente
  | "habit.swipePrevious"
  | "habit.viewChange" // cambio vertical de vista (check/año/figura)
  | "habit.milestone" // 10/20/30/40/50 repeticiones
  | "habit.levelUp" // 60 repeticiones: hábito dominado
  | "routine.completed"
  | "streak.milestone";

export interface AnimationEvent {
  type: AnimationEventType;
  tier: AnimationTier;
  entityId: string;
  meta?: { streak?: number; milestone?: Milestone; count?: number; level?: number; stageFrom?: number; stageTo?: number };
}
