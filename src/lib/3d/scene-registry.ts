import { createSceneConfig, type SceneProgressionConfig } from "./scene-progression";

/**
 * Registro 3D en runtime (espejo mínimo de docs/3d/asset-registry.json: solo lo que la app
 * necesita para montar una escena). Agregar una escena nueva (montaña, casa, gym…) es sumar
 * una entrada acá + su GLB; el motor de etapas, el reproductor y la integración no cambian.
 */
export interface SceneAssetDef {
  config: SceneProgressionConfig;
  /** GLB con Meshopt. Vive en /public/models (ignorado por git mientras la licencia sea UNVERIFIED). */
  glbUrl: string;
  module: "habitos" | "gym" | "paz" | "voz" | "outfit" | "finanzas";
  /** Datos de procedencia (obligatorios en el registro). */
  license: string;
  source: string;
  /** Etapas que cierran con una celebración (partículas + pulso). */
  celebrationStages: number[];
  /** Dirección de cámara (desde el objeto hacia la cámara, ejes glTF Y-arriba) y FOV vertical. */
  camera: { direction: [number, number, number]; fov: number; targetY: number };
}

const FOREST_NAMES = [
  "Terreno",
  "Agua",
  "Rocas",
  "Pasto",
  "Primeros árboles",
  "Más árboles y detalles",
  "Escena completa",
];

/** Bosque de 7 días: un clip por día salvo el día 4 (pasto), que se anima en runtime. */
export const FOREST_SCENE: SceneAssetDef = {
  config: createSceneConfig("forest_progression_001", FOREST_NAMES, {
    clips: ["STAGE_1", "STAGE_2", "STAGE_3", null, "STAGE_5", "STAGE_6", "STAGE_7"],
  }),
  glbUrl: "/models/forest_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  // Misma dirección que la cámara de Blender (-15.75, 14.96 arriba, 18.05) hacia el centro del diorama.
  camera: { direction: [-0.56, 0.53, 0.64], fov: 24, targetY: 0.7 },
};

const SCENES: Record<string, SceneAssetDef> = {
  [FOREST_SCENE.config.id]: FOREST_SCENE,
};

/** Escena que muestra hoy cualquier hábito (a futuro: campo `sceneAssetId` por hábito o por categoría). */
export const DEFAULT_SCENE_ID = FOREST_SCENE.config.id;

export function getSceneAsset(id: string = DEFAULT_SCENE_ID): SceneAssetDef {
  return SCENES[id] ?? FOREST_SCENE;
}
