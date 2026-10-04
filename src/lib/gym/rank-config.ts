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
