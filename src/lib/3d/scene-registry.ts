import { createSceneConfig, type SceneProgressionConfig } from "./scene-progression";

/**
 * Registro 3D en runtime (espejo mínimo de docs/3d/asset-registry.json: solo lo que la app necesita
 * para montar una escena). Sumar una figura nueva (montaña, gimnasio…) es agregar una entrada acá
 * + su GLB: el motor de etapas, el reproductor, la colección y la interfaz no cambian.
 */
export type SceneIcon = "forest" | "castle" | "house" | "windmill" | "room";

export interface SceneAssetDef {
  config: SceneProgressionConfig;
  /** Nombre visible de la figura. */
  name: string;
  icon: SceneIcon;
  /** GLB con Meshopt. Vive en /public/models (ignorado por git mientras la licencia sea UNVERIFIED). */
  glbUrl: string;
  module: "habitos" | "gym" | "paz" | "voz" | "outfit" | "finanzas";
  /** Datos de procedencia (obligatorios en el registro). */
  license: string;
  source: string;
  /** Etapas que cierran con la celebración final. */
  celebrationStages: number[];
  /** Dirección de cámara (desde el objeto hacia la cámara, ejes glTF Y-arriba), FOV vertical y altura del objetivo. */
  camera: { direction: [number, number, number]; fov: number; targetY: number };
}

const clipsFor = (n: number) => Array.from({ length: n }, (_, i) => `STAGE_${i + 1}`);

/** Bosque: el día 4 (pasto) se anima en runtime, no tiene clip. */
export const FOREST_SCENE: SceneAssetDef = {
  config: createSceneConfig(
    "forest_progression_001",
    ["Terreno", "Agua", "Rocas", "Pasto", "Primeros árboles", "Más árboles y detalles", "Escena completa"],
    { clips: ["STAGE_1", "STAGE_2", "STAGE_3", null, "STAGE_5", "STAGE_6", "STAGE_7"] },
  ),
  name: "Bosque",
  icon: "forest",
  glbUrl: "/models/forest_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  camera: { direction: [-0.56, 0.53, 0.64], fov: 24, targetY: 0.7 },
};

export const CASTLE_SCENE: SceneAssetDef = {
  config: createSceneConfig("castle_progression_001", ["Base", "Muros", "Torres", "Estructura", "Detalles", "Vegetación", "Castillo completo"], { clips: clipsFor(7) }),
  name: "Castillo",
  icon: "castle",
  glbUrl: "/models/castle_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  camera: { direction: [-0.56, 0.53, 0.64], fov: 24, targetY: 0.7 },
};

export const HOUSE_SCENE: SceneAssetDef = {
  config: createSceneConfig("house_progression_001", ["Base", "Estructura", "Paredes", "Techo", "Ventanas y puertas", "Detalles", "Casa completa"], { clips: clipsFor(7) }),
  name: "Casa",
  icon: "house",
  glbUrl: "/models/house_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  camera: { direction: [-0.56, 0.53, 0.64], fov: 24, targetY: 0.7 },
};

export const WINDMILL_SCENE: SceneAssetDef = {
  config: createSceneConfig("windmill_progression_001", ["Base", "Cimientos", "Cuerpo", "Techo", "Aspas", "Detalles", "Molino completo"], { clips: clipsFor(7) }),
  name: "Molino",
  icon: "windmill",
  glbUrl: "/models/windmill_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  camera: { direction: [-0.56, 0.5, 0.66], fov: 24, targetY: 0.7 },
};

export const ROOM_SCENE: SceneAssetDef = {
  config: createSceneConfig("room_progression_001", ["Base", "Paredes", "Piso", "Muebles", "Decoración", "Iluminación", "Cuarto completo"], { clips: clipsFor(7) }),
  name: "Cuarto",
  icon: "room",
  glbUrl: "/models/room_progression_001_meshopt.glb",
  module: "habitos",
  license: "UNVERIFIED",
  source: "UNVERIFIED",
  celebrationStages: [7],
  camera: { direction: [-0.56, 0.53, 0.64], fov: 24, targetY: 0.7 },
};

/** Figuras de Hábitos EN ORDEN de desbloqueo. */
export const HABIT_FIGURES: SceneAssetDef[] = [FOREST_SCENE, CASTLE_SCENE, HOUSE_SCENE, WINDMILL_SCENE, ROOM_SCENE];

const SCENES: Record<string, SceneAssetDef> = Object.fromEntries(HABIT_FIGURES.map((s) => [s.config.id, s]));

export const DEFAULT_SCENE_ID = FOREST_SCENE.config.id;

export function getSceneAsset(id: string = DEFAULT_SCENE_ID): SceneAssetDef {
  return SCENES[id] ?? FOREST_SCENE;
}

/** Configuraciones en orden (entrada de `collectionStateFor` / `collectionChange`). */
export function habitFigureConfigs(): SceneProgressionConfig[] {
  return HABIT_FIGURES.map((s) => s.config);
}
