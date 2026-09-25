import { stageFor, type SceneProgressionConfig } from "./scene-progression";

/**
 * Colección de figuras de un módulo (hoy: las 5 de Hábitos), desbloqueadas en orden.
 *
 * Separa tres conceptos que NO deben mezclarse:
 *  A) progreso del hábito  → `total` (repeticiones acumuladas; lo calcula el store)
 *  B) progreso de la figura → cuántas de sus etapas están construidas (0..totalStages de ESA figura)
 *  C) desbloqueo de figuras → una figura se desbloquea al COMPLETAR la anterior
 *
 * Reglas actuales (cambiables sin tocar la UI ni el reproductor): cada repetición suma 1 a la figura
 * actual; la figura i empieza donde termina la i-1. Puro: sin React, three.js ni stores.
 */
export interface FigureState {
  id: string;
  index: number;
  totalStages: number;
  /** Etapas construidas de ESTA figura: 0..totalStages. */
  stage: number;
  status: "locked" | "current" | "complete";
  unlocked: boolean;
}

export interface CollectionState {
  figures: FigureState[];
  /** Figura en curso: la primera desbloqueada sin completar (o la última si todas están completas). */
  currentIndex: number;
  completedCount: number;
  unlockedCount: number;
  allComplete: boolean;
}

/** Repeticiones que ya "gastaron" las figuras anteriores a `index`. */
function offsetFor(order: SceneProgressionConfig[], index: number): number {
  let sum = 0;
  for (let i = 0; i < index; i++) sum += order[i].totalStages;
  return sum;
}

export function collectionStateFor(order: SceneProgressionConfig[], total: number): CollectionState {
  const figures: FigureState[] = order.map((config, index) => {
    const local = Math.max(0, Math.min(total - offsetFor(order, index), config.totalStages));
    const stage = stageFor(config, local);
    const complete = stage >= config.totalStages;
    const prevComplete = index === 0 || total - offsetFor(order, index - 1) >= order[index - 1].totalStages;
    const unlocked = prevComplete;
    return {
      id: config.id,
      index,
      totalStages: config.totalStages,
      stage,
      status: !unlocked ? "locked" : complete ? "complete" : "current",
      unlocked,
    };
  });
  const firstOpen = figures.findIndex((f) => f.unlocked && f.status !== "complete");
  const completedCount = figures.filter((f) => f.status === "complete").length;
  return {
    figures,
    currentIndex: firstOpen === -1 ? Math.max(figures.length - 1, 0) : firstOpen,
    completedCount,
    unlockedCount: figures.filter((f) => f.unlocked).length,
    allComplete: completedCount === figures.length,
  };
}

export interface CollectionChange {
  /** Figura a la que pertenece la repetición (la que se construye). */
  figureIndex: number;
  figureId: string;
  from: number;
  to: number;
  changed: boolean;
  /** Con esta repetición se completó la figura. */
  completedNow: boolean;
  /** Figura que se desbloquea al completar esta (si la hay). */
  unlockedFigureId: string | null;
  collectionCompletedNow: boolean;
}

/** Qué pasó al pasar de `prevTotal` a `nextTotal` repeticiones (solo interesa subir de a una o más). */
export function collectionChange(order: SceneProgressionConfig[], prevTotal: number, nextTotal: number): CollectionChange {
  const prev = collectionStateFor(order, prevTotal);
  const next = collectionStateFor(order, nextTotal);
  // Figura donde ocurre el último paso: la figura en curso ANTES del cambio (si ya estaba todo completo, la última).
  const i = prev.currentIndex;
  const before = prev.figures[i];
  const after = next.figures[i];
  const completedNow = before.status !== "complete" && after.status === "complete";
  const following = order[i + 1];
  return {
    figureIndex: i,
    figureId: before.id,
    from: before.stage,
    to: after.stage,
    changed: after.stage > before.stage,
    completedNow,
    unlockedFigureId: completedNow && following ? following.id : null,
    collectionCompletedNow: !prev.allComplete && next.allComplete,
  };
}
