/**
 * Tabla de referencia de nutrientes por sexo y rango de edad (adultos y adolescentes de 14 años en adelante).
 * Los valores son las Dietary Reference Intakes (DRI) de EE. UU. y Canadá (National Academies), transcritas de las
 * tablas de Health Canada consultadas el 2026-10-08 (ver docs/ciencia-nutricion.md para enlaces y fechas).
 *
 * Rangos de edad, en este orden: 14–18, 19–30, 31–50, 51–70, 71 o más.
 * No incluye embarazo ni lactancia (la app no tiene ese dato en el perfil).
 */
export const AGE_BANDS = [
  { desde: 14, hasta: 18 },
  { desde: 19, hasta: 30 },
  { desde: 31, hasta: 50 },
  { desde: 51, hasta: 70 },
  { desde: 71, hasta: 200 },
] as const;

export type Five = readonly [number, number, number, number, number];
const all = (v: number): Five => [v, v, v, v, v];

export type RefTipo = "RDA" | "AI";

export interface MicroRef {
  id: string;
  nombre: string;
  unidad: string;
  tipo: RefTipo;
  hombre: Five;
  mujer: Five;
  /** UL (nivel máximo tolerable) por rango de edad; `null` = no se estableció. Es de TODO el día y, en varias vitaminas
   * y minerales, solo de suplementos o alimentos fortificados: NO se usa para avisar por un alimento suelto. */
  ul: Five | null;
  /** Aclaración de la tabla (a qué fuente de nutriente aplica el UL, equivalentes, etc.). */
  nota?: string;
}

export const MICRO_REFS: MicroRef[] = [
  { id: "vitaminaA", nombre: "Vitamina A", unidad: "mcg", tipo: "RDA", hombre: all(900), mujer: all(700), ul: [2800, 3000, 3000, 3000, 3000], nota: "mcg RAE; el UL es de vitamina A preformada" },
  { id: "vitaminaB1", nombre: "Vitamina B1", unidad: "mg", tipo: "RDA", hombre: all(1.2), mujer: [1.0, 1.1, 1.1, 1.1, 1.1], ul: null },
  { id: "vitaminaB2", nombre: "Vitamina B2", unidad: "mg", tipo: "RDA", hombre: all(1.3), mujer: [1.0, 1.1, 1.1, 1.1, 1.1], ul: null },
  { id: "vitaminaB3", nombre: "Vitamina B3", unidad: "mg", tipo: "RDA", hombre: all(16), mujer: all(14), ul: [30, 35, 35, 35, 35], nota: "mg NE (equivalentes de niacina); el UL es de suplementos y alimentos fortificados" },
  { id: "vitaminaB5", nombre: "Vitamina B5", unidad: "mg", tipo: "AI", hombre: all(5), mujer: all(5), ul: null },
  { id: "vitaminaB6", nombre: "Vitamina B6", unidad: "mg", tipo: "RDA", hombre: [1.3, 1.3, 1.3, 1.7, 1.7], mujer: [1.2, 1.3, 1.3, 1.5, 1.5], ul: [80, 100, 100, 100, 100] },
  { id: "vitaminaB12", nombre: "Vitamina B12", unidad: "mcg", tipo: "RDA", hombre: all(2.4), mujer: all(2.4), ul: null, nota: "mayores de 50: cubrirla sobre todo con alimentos fortificados o suplementos" },
  { id: "vitaminaC", nombre: "Vitamina C", unidad: "mg", tipo: "RDA", hombre: [75, 90, 90, 90, 90], mujer: [65, 75, 75, 75, 75], ul: [1800, 2000, 2000, 2000, 2000], nota: "fumadores necesitan más" },
  { id: "vitaminaD", nombre: "Vitamina D", unidad: "mcg", tipo: "RDA", hombre: [15, 15, 15, 15, 20], mujer: [15, 15, 15, 15, 20], ul: all(100), nota: "supone poca exposición al sol; 1 mcg = 40 UI" },
  { id: "vitaminaE", nombre: "Vitamina E", unidad: "mg", tipo: "RDA", hombre: all(15), mujer: all(15), ul: [800, 1000, 1000, 1000, 1000], nota: "mg de alfa-tocoferol; el UL es de suplementos" },
  { id: "vitaminaK", nombre: "Vitamina K", unidad: "mcg", tipo: "AI", hombre: [75, 120, 120, 120, 120], mujer: [75, 90, 90, 90, 90], ul: null },
  { id: "folato", nombre: "Folato", unidad: "mcg", tipo: "RDA", hombre: all(400), mujer: all(400), ul: [800, 1000, 1000, 1000, 1000], nota: "mcg DFE; el UL es de ácido fólico (suplementos y fortificados)" },
  { id: "colina", nombre: "Colina", unidad: "mg", tipo: "AI", hombre: all(550), mujer: [400, 425, 425, 425, 425], ul: [3000, 3500, 3500, 3500, 3500] },
  { id: "calcio", nombre: "Calcio", unidad: "mg", tipo: "RDA", hombre: [1300, 1000, 1000, 1000, 1200], mujer: [1300, 1000, 1000, 1200, 1200], ul: [3000, 2500, 2500, 2000, 2000] },
  { id: "cobre", nombre: "Cobre", unidad: "mg", tipo: "RDA", hombre: [0.89, 0.9, 0.9, 0.9, 0.9], mujer: [0.89, 0.9, 0.9, 0.9, 0.9], ul: [8, 10, 10, 10, 10] },
  { id: "hierro", nombre: "Hierro", unidad: "mg", tipo: "RDA", hombre: [11, 8, 8, 8, 8], mujer: [15, 18, 18, 8, 8], ul: all(45), nota: "mujeres de 51 años o más: valor posmenopáusico" },
  { id: "magnesio", nombre: "Magnesio", unidad: "mg", tipo: "RDA", hombre: [410, 400, 420, 420, 420], mujer: [360, 310, 320, 320, 320], ul: all(350), nota: "el UL de magnesio es solo de suplementos" },
  { id: "manganeso", nombre: "Manganeso", unidad: "mg", tipo: "AI", hombre: [2.2, 2.3, 2.3, 2.3, 2.3], mujer: [1.6, 1.8, 1.8, 1.8, 1.8], ul: [9, 11, 11, 11, 11] },
  { id: "fosforo", nombre: "Fósforo", unidad: "mg", tipo: "RDA", hombre: [1250, 700, 700, 700, 700], mujer: [1250, 700, 700, 700, 700], ul: [4000, 4000, 4000, 4000, 3000] },
  { id: "potasio", nombre: "Potasio", unidad: "mg", tipo: "AI", hombre: [3000, 3400, 3400, 3400, 3400], mujer: [2300, 2600, 2600, 2600, 2600], ul: null },
  { id: "selenio", nombre: "Selenio", unidad: "mcg", tipo: "RDA", hombre: all(55), mujer: all(55), ul: all(400) },
  { id: "zinc", nombre: "Zinc", unidad: "mg", tipo: "RDA", hombre: all(11), mujer: [9, 8, 8, 8, 8], ul: [34, 40, 40, 40, 40] },
];

/** Macronutrientes con valor fijo por sexo y edad (AI): fibra (si no se conoce la meta calórica), omega-6, ALA, agua total. */
export const MACRO_REFS = {
  fibraAI: { hombre: [38, 38, 38, 30, 30], mujer: [26, 25, 25, 21, 21] },
  omega6AI: { hombre: [16, 17, 17, 14, 14], mujer: [11, 12, 12, 11, 11] },
  alaAI: { hombre: all(1.6), mujer: all(1.1) },
  /** Agua total (bebidas + alimentos), litros por día. */
  aguaTotalLitros: { hombre: [3.3, 3.7, 3.7, 3.7, 3.7], mujer: [2.3, 2.7, 2.7, 2.7, 2.7] },
  /** Proteína RDA en g por kg de peso corporal: 0,85 a los 14–18 y 0,80 en adultos (ambos sexos). */
  proteinaGporKg: [0.85, 0.8, 0.8, 0.8, 0.8],
} as const;

/** Rangos de distribución aceptable de macronutrientes (AMDR), % de la energía, adultos. */
export const AMDR = {
  carbohidratos: { min: 45, max: 65 },
  proteina: { min: 10, max: 35 },
  grasa: { min: 20, max: 35 },
  omega6: { min: 5, max: 10 },
  omega3: { min: 0.6, max: 1.2 },
} as const;

/** Fibra: 14 g por cada 1000 kcal (base de la AI del Institute of Medicine). */
export const FIBRA_G_POR_1000_KCAL = 14;

/** Tope de la OMS, % de la energía total (adultos). */
export const OMS = {
  grasaSaturadaMaxPct: 10,
  grasaTransMaxPct: 1,
  azucaresLibresMaxPct: 10,
  sodioMaxMg: 2000,
  potasioMinMg: 3510,
} as const;

/** ISSN: personas que entrenan, g de proteína por kg de peso y día. */
export const ISSN_PROTEINA = { minGporKg: 1.4, maxGporKg: 2.0 } as const;

/** EFSA: EPA + DHA, ingesta adecuada para adultos, mg por día. */
export const EPA_DHA_AI_MG = 250;

/** Piso orientativo de calorías para bajar de peso sin supervisión profesional (Harvard Health; no es una DRI). */
export const PISO_KCAL = { mujer: 1200, hombre: 1500 } as const;
