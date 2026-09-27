/**
 * Registro de los GRÁFICOS 3D de calorías (colección «calorias-graficos»). No usa `SceneAssetDef` (ese esquema es de figuras por etapas de 7
 * días); estos modelos muestran un VALOR CONTINUO que les llega ya calculado desde `calorie-state.ts` (nunca calculan su propio porcentaje).
 * Espejo de docs/3d/asset-registry.json en runtime: solo lo que la app necesita para montar el gráfico.
 */
export type GaugeKind = "canister" | "meter" | "battery";

export interface GaugeAssetDef {
  id: GaugeKind;
  name: string;
  glbUrl: string;
  /** Colección lógica (para no mezclar su ciclo de vida con las figuras de progreso de Hábitos/Gym). */
  sceneCollection: "calorias-graficos";
  license: string;
  source: string;
  /** false = referencia/prototipo: NO publicar en producción tal cual. */
  publishable: boolean;
  /** false mientras el GLB no esté integrado: el selector lo muestra como «próximamente». */
  available: boolean;
  licenseNote?: string;
}

export const GAUGE_COLLECTION = "calorias-graficos" as const;

export const GAUGES: Record<GaugeKind, GaugeAssetDef> = {
  canister: {
    id: "canister",
    name: "Bote de gritos",
    glbUrl: "/models/gauge_canister_001_meshopt.glb",
    sceneCollection: GAUGE_COLLECTION,
    license: "Disney/Pixar (Monsters, Inc.) — NO verificada, sin licencia de uso",
    source: "biblioteca de assets/GYM/calorias/Bote de gritos (FBX descargado por el dueño)",
    publishable: false,
    available: true,
    licenseNote: "Asset de referencia/prototipo NO comercial. Reemplazar por un modelo propio antes de cualquier lanzamiento comercial.",
  },
  meter: {
    id: "meter",
    name: "Medidor de energía",
    glbUrl: "/models/gauge_meter_001_meshopt.glb",
    sceneCollection: GAUGE_COLLECTION,
    license: "CC-BY-4.0 (según la página de Sketchfab; requiere atribución) — sin verificar más allá de esa lectura",
    source: "Sketchfab «Energy Meter - Open Gauges» (digitalurban), FBX descargado por el dueño",
    publishable: false,
    available: true,
    licenseNote: "Requiere crédito visible al autor (digitalurban, CC-BY 4.0) antes de publicar. Dial con textura propia.",
  },
  battery: {
    id: "battery",
    name: "Batería sci-fi",
    glbUrl: "/models/gauge_battery_001_meshopt.glb",
    sceneCollection: GAUGE_COLLECTION,
    license: "UNVERIFIED",
    source: "BlenderKit «Sci Fi Battery» (por verificar)",
    publishable: false,
    available: false,
  },
};

export const GAUGE_ORDER: GaugeKind[] = ["canister", "meter", "battery"];
