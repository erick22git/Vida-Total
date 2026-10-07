/**
 * Configuración de rangos — UN solo archivo para nombres, orden, colores, ícono y grupos musculares.
 * Para agregar o reordenar un rango basta cambiar una línea de `RANK_TIER_DEFS` (el orden del arreglo ES
 * el orden de menor a mayor). Todo lo demás (motor, pantallas, ícono) lee de acá.
 *
 * - `topPct`: "estás en el top X %" de quienes entrenan. Define el percentil donde EMPIEZA el rango
 *   (percentil = 100 − topPct; el primero empieza en 0). Los valores son los de la pirámide original.
 * - `levels`: true = el rango tiene niveles I, II y III (el tercio inferior, medio y superior de su tramo
 *   de percentil). Simétrico no tiene niveles.
 * - `iconName`: prefijo del archivo en `img vida toal/RANGOS` ("COBRE" → "COBRE II.png").
 * - Colores: tomados del color dominante de los íconos existentes (Cobre, Plata, Oro); Hierro y los
 *   rangos sin ícono todavía conservan su color de siempre.
 */
export interface RankTierDef {
  key: string;
  name: string;
  color: string;
  topPct: number | null;
  levels: boolean;
  iconName: string;
}

export const RANK_TIER_DEFS: RankTierDef[] = [
  { key: "hierro", name: "Hierro", color: "#8a8a95", topPct: null, levels: true, iconName: "HIERRO" },
  { key: "cobre", name: "Cobre", color: "#a26244", topPct: 79, levels: true, iconName: "COBRE" },
  { key: "plata", name: "Plata", color: "#92a0b1", topPct: 60, levels: true, iconName: "PLATA" },
  { key: "oro", name: "Oro", color: "#c09148", topPct: 44, levels: true, iconName: "ORO" },
  { key: "platino", name: "Platino", color: "#8fe3d9", topPct: 31, levels: true, iconName: "PLATINO" },
  { key: "esmeralda", name: "Esmeralda", color: "#2ecc71", topPct: 20, levels: true, iconName: "ESMERALDA" },
  { key: "diamante", name: "Diamante", color: "#7dd3fc", topPct: 11, levels: true, iconName: "DIAMANTE" },
  { key: "campeon", name: "Campeón", color: "#a855f7", topPct: 5, levels: true, iconName: "CAMPEON" },
  { key: "simetrico", name: "Simétrico", color: "#facc15", topPct: 1, levels: false, iconName: "SIMETRICO" },
];

export const LEVEL_ROMAN = ["I", "II", "III"] as const;
export const LEVELS_PER_TIER = 3;

/** Color de "sin rango" (gris neutro). */
export const NO_RANK_COLOR = "#6b7280";

/** Músculo del dataset (`Exercise.categoria`) -> grupo de la pantalla de rango. Cardio queda fuera. */
export interface RankGroupDef {
  key: string;
  label: string;
  /** Categorías del dataset que componen el grupo. Vacío en "cuerpo" (es el general). */
  categories: string[];
}

export const RANK_GROUPS: RankGroupDef[] = [
  { key: "cuerpo", label: "Cuerpo completo", categories: [] },
  { key: "brazos", label: "Brazos", categories: ["Biceps", "Triceps", "Antebrazo"] },
  { key: "piernas", label: "Piernas", categories: ["Cuadriceps", "Femoral", "Aductores", "Abductores", "Pantorrilla"] },
  { key: "espalda", label: "Espalda", categories: ["Espalda"] },
  { key: "pecho", label: "Pecho", categories: ["Pecho"] },
  { key: "gluteos", label: "Glúteos", categories: ["Gluteos"] },
  { key: "abdomen", label: "Abdomen", categories: ["Abdomen"] },
  { key: "hombros", label: "Hombros y cuello", categories: ["Hombros"] },
];

/** Nombre para mostrar de cada músculo (categoría del dataset / región del cuerpo 3D). */
export const MUSCLE_LABEL: Record<string, string> = {
  Pecho: "Pecho",
  Espalda: "Espalda",
  Hombros: "Hombros y cuello",
  Biceps: "Bíceps",
  Triceps: "Tríceps",
  Antebrazo: "Antebrazo",
  Abdomen: "Abdomen",
  Gluteos: "Glúteos",
  Cuadriceps: "Cuádriceps",
  Femoral: "Femoral",
  Aductores: "Aductores",
  Abductores: "Abductores",
  Pantorrilla: "Pantorrilla",
  Cuello: "Cuello",
};

/**
 * Material de cada rango en el cuerpo 3D (src/lib/3d/rank-body.ts). En vez de un color plano, cada rango define un pequeño
 * conjunto que el shader mezcla con un falso reflejo de entorno (gradiente por reflejo + una "softbox" de estudio) y fresnel:
 * sin texturas, sin draw calls extra y barato en móvil. Todo se ajusta acá (los colores son sRGB "#rrggbb").
 *
 *  - base:   color medio del material.
 *  - light:  color de las luces (zonas que miran hacia arriba y el centro de cada músculo).
 *  - shade:  color de las sombras (zonas que miran hacia abajo y hacia el borde del músculo).
 *  - shine:  intensidad del brillo/reflejo, 0 (mate) a 1 (muy brillante).
 *  - rough:  0 (reflejo chico y nítido) a 1 (reflejo ancho y difuso).
 *  - tint:   color del reflejo (fríos para plata/diamante, cálido para oro/cobre).
 *  - irid:   iridiscencia sutil (cambio de tono con el ángulo), 0 a 1.
 *  - inner:  luz interior (el color se ve "encendido" por dentro), 0 a 1.
 */
export interface RankMaterial {
  base: string;
  light: string;
  shade: string;
  shine: number;
  rough: number;
  tint: string;
  irid?: number;
  inner?: number;
}

export const RANK_MATERIALS: Record<string, RankMaterial> = {
  hierro: { base: "#414853", light: "#7f8a9c", shade: "#151a21", shine: 0.38, rough: 0.7, tint: "#b4c0d2" },
  cobre: { base: "#b4623f", light: "#eda274", shade: "#5c2a1b", shine: 0.55, rough: 0.5, tint: "#ffc7a0" },
  plata: { base: "#8e9db2", light: "#dbe5f2", shade: "#3d495c", shine: 0.7, rough: 0.38, tint: "#e8f1ff" },
  oro: { base: "#cf9230", light: "#fbe08a", shade: "#7e3f12", shine: 0.55, rough: 0.48, tint: "#fff0b4" },
  platino: { base: "#79cfc6", light: "#cffff7", shade: "#2c7a80", shine: 0.5, rough: 0.45, tint: "#e2fffb" },
  esmeralda: { base: "#12804a", light: "#55e096", shade: "#053a22", shine: 0.5, rough: 0.4, tint: "#bfffdc", inner: 0.45 },
  diamante: { base: "#bfe6f8", light: "#f7fdff", shade: "#4f9fd4", shine: 0.8, rough: 0.28, tint: "#ffffff", irid: 0.3 },
  campeon: { base: "#8a3fd6", light: "#c995ff", shade: "#36116b", shine: 0.55, rough: 0.45, tint: "#e8cdff", inner: 0.18 },
  simetrico: { base: "#e9b90f", light: "#fff27e", shade: "#966305", shine: 0.62, rough: 0.42, tint: "#fffbd2" },
};

/** Músculo sin rango: gris casi plano (sin brillo) para que se distinga siempre de cualquier rango. */
export const NO_RANK_MATERIAL: RankMaterial = { base: "#6b7280", light: "#747b88", shade: "#5a606b", shine: 0, rough: 1, tint: "#6b7280" };
