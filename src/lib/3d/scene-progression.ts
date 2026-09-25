/**
 * SceneProgression — de progreso a "qué etapa de la escena está construida".
 *
 * Puro: sin React, sin three.js, sin stores. Cualquier módulo (Hábitos, Gym,
 * Paz…) le pasa un número de progreso y una configuración; la escena 3D solo
 * recibe el resultado. La cantidad de etapas NO está fijada acá: una escena
 * puede tener 7, 8, 10 o 60 (`totalStages` sale de la configuración).
 *
 * Convención: etapa 0 = nada construido; etapa k (1..totalStages) = k partes
 * construidas. El progreso se mide en "unidades" (para Hábitos: días
 * completados).
 */
export interface SceneStageConfig {
  /** 1..totalStages */
  stage: number;
  /** Nombre corto de lo que se construye en esta etapa. */
  name: string;
  /** Progreso mínimo (inclusive) para que esta etapa esté construida. */
  unlockAt: number;
  /** Clip glTF que anima la construcción (null = animación procedural en runtime). */
  clip: string | null;
}

export interface SceneProgressionConfig {
  /** Identificador de la escena en el registro 3D (ver docs/3d/asset-registry.json). */
  id: string;
  totalStages: number;
  stages: SceneStageConfig[];
}

export interface SceneState {
  /** 0..totalStages */
  stage: number;
  totalStages: number;
  completed: boolean;
  /** Progreso que desbloquea la próxima etapa (null si ya está completa). */
  nextUnlockAt: number | null;
  /** 0..1 dentro de toda la escena. */
  fraction: number;
}

/** Crea una configuración lineal: la etapa k se desbloquea con `unlockAts[k-1]` (por defecto k). */
export function createSceneConfig(
  id: string,
  names: string[],
  options: { unlockAts?: number[]; clips?: (string | null)[] } = {},
): SceneProgressionConfig {
  const stages = names.map((name, i) => ({
    stage: i + 1,
    name,
    unlockAt: options.unlockAts?.[i] ?? i + 1,
    clip: options.clips?.[i] ?? null,
  }));
  return { id, totalStages: stages.length, stages };
}

/** Etapa alcanzada con `progress` unidades. Idempotente y monótona. */
export function stageFor(config: SceneProgressionConfig, progress: number): number {
  let stage = 0;
  for (const s of config.stages) {
    if (progress >= s.unlockAt) stage = Math.max(stage, s.stage);
  }
  return Math.min(stage, config.totalStages);
}

export function sceneStateFor(config: SceneProgressionConfig, progress: number): SceneState {
  const stage = stageFor(config, progress);
  const next = config.stages.find((s) => s.stage === stage + 1);
  return {
    stage,
    totalStages: config.totalStages,
    completed: stage >= config.totalStages,
    nextUnlockAt: next ? next.unlockAt : null,
    fraction: config.totalStages === 0 ? 0 : stage / config.totalStages,
  };
}

export interface StageChange {
  from: number;
  to: number;
  changed: boolean;
  direction: "up" | "down" | "none";
  /** true si con este cambio se completó la escena. */
  completedNow: boolean;
}

/** Qué pasó al pasar de `prevProgress` a `nextProgress`. */
export function stageChange(config: SceneProgressionConfig, prevProgress: number, nextProgress: number): StageChange {
  const from = stageFor(config, prevProgress);
  const to = stageFor(config, nextProgress);
  return {
    from,
    to,
    changed: from !== to,
    direction: to > from ? "up" : to < from ? "down" : "none",
    completedNow: to >= config.totalStages && from < config.totalStages,
  };
}
