/**
 * Metas de nutrientes personalizadas (sexo, edad, peso y calorías del perfil) a partir de las DRI. Módulo PURO.
 * Sin perfil (o con una edad fuera de las tablas, menor de 14) se usan valores genéricos de adulto, marcados con
 * `generico: true`. Son valores de referencia generales, no consejo médico. Fuentes: docs/ciencia-nutricion.md.
 */
import {
  AGE_BANDS,
  AMDR,
  EPA_DHA_AI_MG,
  FIBRA_G_POR_1000_KCAL,
  ISSN_PROTEINA,
  MACRO_REFS,
  MICRO_REFS,
  OMS,
  PISO_KCAL,
  type Five,
} from "./nutrient-reference-data";

export type Sexo = "hombre" | "mujer";

export interface TargetProfile {
  sexo?: Sexo;
  edad?: number;
  pesoKg?: number;
  /** Meta calórica diaria (kcal). Sin ella se usa 2000 como referencia genérica. */
  kcal?: number;
  /** Entrena fuerza o resistencia con regularidad: la proteína sube al rango de la ISSN. */
  entrena?: boolean;
}

export type TargetTipo = "RDA" | "AI" | "CDRR" | "AMDR" | "OMS" | "ISSN" | "EFSA";

export interface NutrientTarget {
  id: string;
  nombre: string;
  unidad: string;
  /** `meta` = mínimo que conviene alcanzar · `limite` = tope diario (el contador lo muestra como «límite»). */
  sentido: "meta" | "limite";
  tipo: TargetTipo;
  /** Valor con el que se compara el avance del día. */
  objetivo: number;
  minimo?: number;
  maximo?: number;
  /** UL (tolerable) de todo el día: solo informativo; nunca se usa para avisar por un alimento suelto. */
  ul?: number;
  /** true = valor genérico de adulto (no hay perfil completo). */
  generico: boolean;
  nota?: string;
  /** El esquema de alimentos de la app no tiene este nutriente: no se puede seguir todavía. */
  sinDatoEnAlimentos?: boolean;
}

export interface TargetsResult {
  targets: Record<string, NutrientTarget>;
  /** Hay sexo y edad (14+): las metas son personalizadas. */
  personalizado: boolean;
  /** Qué faltó para personalizar, en lenguaje llano. */
  faltan: string[];
  kcal: number;
  kcalGenerico: boolean;
}

export function bandIndex(edad: number | undefined): number | null {
  if (edad === undefined || !Number.isFinite(edad) || edad < AGE_BANDS[0].desde) return null;
  const i = AGE_BANDS.findIndex((b) => edad >= b.desde && edad <= b.hasta);
  return i < 0 ? null : i;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valor para este perfil; sin perfil, el mayor de hombre/mujer entre 19 y 50 años (genérico de adulto). */
function pick(hombre: Five, mujer: Five, sexo: Sexo | undefined, band: number | null): { v: number; generico: boolean } {
  if (sexo && band !== null) return { v: (sexo === "hombre" ? hombre : mujer)[band], generico: false };
  return { v: Math.max(hombre[1], hombre[2], mujer[1], mujer[2]), generico: true };
}

export function getNutrientTargets(p: TargetProfile): TargetsResult {
  const band = bandIndex(p.edad);
  const sexo = p.sexo;
  const personalizado = !!sexo && band !== null;
  const faltan: string[] = [];
  if (!sexo) faltan.push("sexo");
  if (p.edad === undefined) faltan.push("edad");
  else if (band === null) faltan.push("edad de 14 años o más (las tablas empiezan a los 14)");
  const kcalGenerico = !p.kcal || p.kcal <= 0;
  const kcal = kcalGenerico ? 2000 : p.kcal!;
  if (kcalGenerico) faltan.push("meta calórica");
  if (!p.pesoKg) faltan.push("peso");

  const targets: Record<string, NutrientTarget> = {};

  for (const m of MICRO_REFS) {
    const { v, generico } = pick(m.hombre, m.mujer, sexo, band);
    let ul: number | undefined;
    if (m.ul) ul = band !== null ? m.ul[band] : Math.max(m.ul[1], m.ul[2]);
    targets[m.id] = { id: m.id, nombre: m.nombre, unidad: m.unidad, sentido: "meta", tipo: m.tipo, objetivo: v, ul, generico, nota: m.nota };
  }

  // Fibra: 14 g por cada 1000 kcal (la AI del IOM se calcula así). Sin meta calórica, la AI por sexo y edad.
  if (!kcalGenerico) {
    targets.fibra = { id: "fibra", nombre: "Fibra", unidad: "g", sentido: "meta", tipo: "AI", objetivo: r1((FIBRA_G_POR_1000_KCAL * kcal) / 1000), generico: false, nota: "14 g por cada 1000 kcal" };
  } else {
    const f = pick(MACRO_REFS.fibraAI.hombre, MACRO_REFS.fibraAI.mujer, sexo, band);
    targets.fibra = { id: "fibra", nombre: "Fibra", unidad: "g", sentido: "meta", tipo: "AI", objetivo: f.v, generico: f.generico };
  }

  // Sodio: la AI (1500) es el mínimo y el CDRR (2300) es el tope para reducir el riesgo de enfermedad crónica.
  targets.sodio = { id: "sodio", nombre: "Sodio", unidad: "mg", sentido: "limite", tipo: "CDRR", objetivo: 2300, minimo: 1500, generico: false, nota: `la OMS recomienda menos de ${OMS.sodioMaxMg} mg al día` };

  // Límites como % de la energía (OMS), con la meta calórica del usuario.
  targets.grasasSaturadas = { id: "grasasSaturadas", nombre: "Grasas saturadas", unidad: "g", sentido: "limite", tipo: "OMS", objetivo: r1((OMS.grasaSaturadaMaxPct / 100) * kcal / 9), generico: kcalGenerico, nota: "menos del 10 % de la energía" };
  targets.grasasTrans = { id: "grasasTrans", nombre: "Grasas trans", unidad: "g", sentido: "limite", tipo: "OMS", objetivo: r1((OMS.grasaTransMaxPct / 100) * kcal / 9), generico: kcalGenerico, nota: "menos del 1 % de la energía" };
  targets.azucaresAnadidos = { id: "azucaresAnadidos", nombre: "Azúcares añadidos", unidad: "g", sentido: "limite", tipo: "OMS", objetivo: r1((OMS.azucaresLibresMaxPct / 100) * kcal / 4), generico: kcalGenerico, nota: "azúcares libres: menos del 10 % de la energía" };

  // Grasas esenciales.
  const ala = pick(MACRO_REFS.alaAI.hombre, MACRO_REFS.alaAI.mujer, sexo, band);
  targets.omega3Ala = { id: "omega3Ala", nombre: "Omega-3 (ALA)", unidad: "g", sentido: "meta", tipo: "AI", objetivo: ala.v, generico: ala.generico };
  const o6 = pick(MACRO_REFS.omega6AI.hombre, MACRO_REFS.omega6AI.mujer, sexo, band);
  targets.omega6Linoleico = { id: "omega6Linoleico", nombre: "Omega-6 (linoleico)", unidad: "g", sentido: "meta", tipo: "AI", objetivo: o6.v, generico: o6.generico };
  targets.epaDha = { id: "epaDha", nombre: "EPA + DHA", unidad: "mg", sentido: "meta", tipo: "EFSA", objetivo: EPA_DHA_AI_MG, generico: false, nota: "no hay DRI de EE. UU. para EPA+DHA; valor de EFSA (adultos)" };

  const agua = pick(MACRO_REFS.aguaTotalLitros.hombre, MACRO_REFS.aguaTotalLitros.mujer, sexo, band);
  targets.aguaTotal = { id: "aguaTotal", nombre: "Agua total (bebidas y alimentos)", unidad: "L", sentido: "meta", tipo: "AI", objetivo: agua.v, generico: agua.generico, nota: "aprox. 80 % viene de bebidas" };

  // Macros en gramos a partir de la meta calórica.
  const macros = suggestMacros({ ...p, kcal });
  targets.proteina = { id: "proteina", nombre: "Proteína", unidad: "g", sentido: "meta", tipo: p.entrena ? "ISSN" : "RDA", objetivo: macros.proteinaG, minimo: macros.proteinaMinG, maximo: macros.proteinaMaxG, generico: !p.pesoKg };
  targets.grasas = { id: "grasas", nombre: "Grasas", unidad: "g", sentido: "meta", tipo: "AMDR", objetivo: macros.grasasG, minimo: r1((AMDR.grasa.min / 100) * kcal / 9), maximo: r1((AMDR.grasa.max / 100) * kcal / 9), generico: kcalGenerico };
  targets.carbos = { id: "carbos", nombre: "Carbohidratos", unidad: "g", sentido: "meta", tipo: "AMDR", objetivo: macros.carbosG, minimo: r1((AMDR.carbohidratos.min / 100) * kcal / 4), maximo: r1((AMDR.carbohidratos.max / 100) * kcal / 4), generico: kcalGenerico };

  return { targets, personalizado, faltan, kcal, kcalGenerico };
}

export interface MacroSuggestion {
  kcal: number;
  proteinaG: number;
  proteinaMinG: number;
  proteinaMaxG: number;
  grasasG: number;
  carbosG: number;
  /** Suma 4/4/9 de la sugerencia (debe estar muy cerca de `kcal`). */
  kcalMacros: number;
  /** Avisos neutros (p. ej. no cabe dentro del AMDR). */
  avisos: string[];
}

/**
 * Reparto de macros que SUMA la meta calórica (4 kcal/g proteína y carbos, 9 kcal/g grasa). La proteína sale de g/kg
 * (RDA 0,8 g/kg; si entrena, el punto medio del rango ISSN de 1,4–2,0 g/kg) y no de un porcentaje; la grasa parte del
 * punto medio del AMDR (27,5 %) y los carbos son el resto, ajustando la grasa si los carbos se salen de 45–65 %.
 */
export function suggestMacros(p: TargetProfile & { kcal: number }): MacroSuggestion {
  const kcal = p.kcal;
  const avisos: string[] = [];
  const band = bandIndex(p.edad);
  const rdaGkg = MACRO_REFS.proteinaGporKg[band ?? 1];
  const peso = p.pesoKg && p.pesoKg > 0 ? p.pesoKg : undefined;

  const capProt = ((AMDR.proteina.max / 100) * kcal) / 4;
  let proteinaMin = peso ? rdaGkg * peso : (AMDR.proteina.min / 100) * kcal / 4;
  let proteinaMax = capProt;
  let proteina: number;
  if (p.entrena && peso) {
    proteinaMin = ISSN_PROTEINA.minGporKg * peso;
    proteinaMax = Math.min(capProt, ISSN_PROTEINA.maxGporKg * peso);
    proteina = Math.min(capProt, ((ISSN_PROTEINA.minGporKg + ISSN_PROTEINA.maxGporKg) / 2) * peso);
  } else if (peso) {
    proteina = Math.min(capProt, rdaGkg * peso);
  } else {
    proteina = ((AMDR.proteina.min + 15) / 100) * kcal / 4; // sin peso: 25 % de la energía, dentro de 10–35 %
    avisos.push("Sin tu peso la proteína se estima como porcentaje; agrégalo en el perfil para calcularla por kg.");
  }
  proteina = Math.round(proteina);

  const kcalProt = proteina * 4;
  let grasaPct = (AMDR.grasa.min + AMDR.grasa.max) / 2;
  let grasasG = Math.round(((grasaPct / 100) * kcal) / 9);
  let carbosG = Math.round((kcal - kcalProt - grasasG * 9) / 4);
  const carbPct = () => ((carbosG * 4) / kcal) * 100;
  if (carbPct() > AMDR.carbohidratos.max) {
    grasaPct = AMDR.grasa.max;
    grasasG = Math.round(((grasaPct / 100) * kcal) / 9);
    carbosG = Math.round((kcal - kcalProt - grasasG * 9) / 4);
  } else if (carbPct() < AMDR.carbohidratos.min) {
    grasaPct = AMDR.grasa.min;
    grasasG = Math.round(((grasaPct / 100) * kcal) / 9);
    carbosG = Math.round((kcal - kcalProt - grasasG * 9) / 4);
  }
  if (carbPct() < AMDR.carbohidratos.min || carbPct() > AMDR.carbohidratos.max) {
    avisos.push("Con esta proteína, los carbohidratos no caben dentro del rango de referencia (45–65 % de la energía).");
  }
  return {
    kcal,
    proteinaG: proteina,
    proteinaMinG: Math.round(proteinaMin),
    proteinaMaxG: Math.round(proteinaMax),
    grasasG,
    carbosG,
    kcalMacros: proteina * 4 + carbosG * 4 + grasasG * 9,
    avisos,
  };
}

export interface CalorieReview {
  /** Piso orientativo para bajar de peso sin supervisión (no es una DRI). */
  piso: number;
  /** La meta actual queda por debajo del piso. */
  bajoPiso: boolean;
  genericoPiso: boolean;
  mensaje?: string;
}

/** Revisión neutra de una meta calórica: no la cambia, solo informa si queda por debajo del piso orientativo. */
export function reviewCalorieGoal(sexo: Sexo | undefined, kcal: number): CalorieReview {
  const piso = sexo ? PISO_KCAL[sexo] : PISO_KCAL.mujer;
  const bajoPiso = kcal > 0 && kcal < piso;
  return {
    piso,
    bajoPiso,
    genericoPiso: !sexo,
    mensaje: bajoPiso
      ? `Tu meta (${Math.round(kcal)} kcal) está por debajo de ${piso} kcal, el piso que suele usarse sin supervisión de un profesional de la salud. Conviene revisarla con uno.`
      : undefined,
  };
}

/** ¿Las sumas 4/4/9 de los macros guardados difieren de la meta calórica más de `tolPct` %? Para ofrecer «revisar sugerencia». */
export function macrosVsMeta(kcal: number, proteinaG: number, carbosG: number, grasasG: number, tolPct = 5): { kcalMacros: number; difierePct: number; difiere: boolean } {
  const kcalMacros = proteinaG * 4 + carbosG * 4 + grasasG * 9;
  const difierePct = kcal > 0 ? Math.abs(kcalMacros - kcal) / kcal * 100 : 0;
  return { kcalMacros, difierePct: r2(difierePct), difiere: difierePct > tolPct };
}
