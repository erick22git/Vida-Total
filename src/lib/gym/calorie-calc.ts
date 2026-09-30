/**
 * Cálculo de meta calórica — Modo Básico (Configuración > Calorías).
 * Funciones puras, sin dependencias de React/store, para poder verificarlas
 * a mano contra casos de manual. Fórmula: Mifflin-St Jeor (estándar, la más
 * usada por apps de nutrición actuales) + multiplicador de actividad (TDEE)
 * + ajuste de %/objetivo. Katch-McArdle (Modo PRO, con %grasa corporal) se
 * agrega en una fase aparte — no vive en este archivo todavía.
 */
import type { NivelActividad, ObjetivoCalorico } from "@/lib/store/gymStore";

export type Sexo = "hombre" | "mujer";

export const ACTIVITY_LEVELS: {
  value: NivelActividad;
  label: string;
  description: string;
  multiplier: number;
}[] = [
  { value: "sedentario", label: "Sedentario", description: "Poco o nada de ejercicio, trabajo de escritorio", multiplier: 1.2 },
  { value: "ligero", label: "Ligero", description: "Ejercicio ligero 1–3 días por semana", multiplier: 1.375 },
  { value: "moderado", label: "Moderado", description: "Ejercicio moderado 3–5 días por semana", multiplier: 1.55 },
  { value: "intenso", label: "Intenso", description: "Ejercicio intenso 6–7 días por semana", multiplier: 1.725 },
  { value: "muy_intenso", label: "Muy intenso", description: "Ejercicio muy intenso, trabajo físico o 2 sesiones por día", multiplier: 1.9 },
];

export interface IntensidadPreset {
  value: string;
  label: string;
  description: string;
  /** Fracción respecto al TDEE: negativo = déficit, positivo = superávit. */
  pct: number;
}

export const GOAL_INTENSITY_PRESETS: Record<ObjetivoCalorico, IntensidadPreset[]> = {
  perder: [
    { value: "lento", label: "Lento", description: "Ritmo sostenible, menos hambre y menos pérdida de músculo (−10% del gasto calórico)", pct: -0.1 },
    { value: "moderado", label: "Moderado", description: "El más usado — buen balance entre velocidad y sostenibilidad (−20% del gasto calórico)", pct: -0.2 },
    { value: "agresivo", label: "Agresivo", description: "Más rápido, más difícil de sostener y con más riesgo de perder músculo (−25% del gasto calórico)", pct: -0.25 },
  ],
  mantener: [
    { value: "estandar", label: "Estándar", description: "Comer exactamente lo que se gasta (0%)", pct: 0 },
    { value: "recomposicion", label: "Recomposición", description: "Un déficit muy leve para perder algo de grasa mientras se entrena fuerza (−5% del gasto calórico)", pct: -0.05 },
  ],
  ganar: [
    { value: "lento", label: "Lento (ganar músculo)", description: "El más recomendado para ganar músculo con la mínima grasa posible (+10% del gasto calórico)", pct: 0.1 },
    { value: "moderado", label: "Moderado", description: "Superávit balanceado (+15% del gasto calórico)", pct: 0.15 },
    { value: "agresivo", label: "Agresivo", description: "Más rápido pero con más grasa ganada de más (+20% del gasto calórico)", pct: 0.2 },
  ],
};

export const OBJETIVO_LABELS: Record<ObjetivoCalorico, string> = {
  perder: "Perder peso",
  mantener: "Mantener",
  ganar: "Ganar peso",
};

/** BMR (gasto basal) por Mifflin-St Jeor. La fórmula estándar es binaria por
 * sexo — no existe una tercera variante oficial de la ecuación. */
export function calcBMRMifflin(sexo: Sexo, pesoKg: number, alturaCm: number, edad: number): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  return sexo === "hombre" ? base + 5 : base - 161;
}

export function activityMultiplier(nivel: NivelActividad): number {
  return ACTIVITY_LEVELS.find((a) => a.value === nivel)?.multiplier ?? 1.2;
}

export function calcTDEE(bmr: number, nivel: NivelActividad): number {
  return bmr * activityMultiplier(nivel);
}

export function findIntensidadPreset(objetivo: ObjetivoCalorico, intensidad: string): IntensidadPreset | undefined {
  return GOAL_INTENSITY_PRESETS[objetivo].find((p) => p.value === intensidad);
}

export interface CalorieCalcInput {
  sexo: Sexo;
  pesoKg: number;
  alturaCm: number;
  edad: number;
  nivelActividad: NivelActividad;
  objetivoCalorico: ObjetivoCalorico;
  intensidadObjetivo: string;
}

export interface CalorieCalcResult {
  bmr: number;
  tdee: number;
  pct: number;
  calorieGoal: number;
  explicacion: string;
}

/** Desglose completo BMR -> TDEE -> ajuste -> meta, para mostrar transparencia
 * en la pantalla de resultado (nunca solo "el número mágico"). */
export function calcCalorieGoal(input: CalorieCalcInput): CalorieCalcResult {
  const bmr = calcBMRMifflin(input.sexo, input.pesoKg, input.alturaCm, input.edad);
  const tdee = calcTDEE(bmr, input.nivelActividad);
  const preset = findIntensidadPreset(input.objetivoCalorico, input.intensidadObjetivo);
  const pct = preset?.pct ?? 0;
  const calorieGoal = Math.round(tdee * (1 + pct));
  const signo = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const pctTxt = pct === 0 ? "sin ajuste" : `${signo}${Math.round(Math.abs(pct) * 100)}%`;
  const explicacion = `BMR ${Math.round(bmr)} kcal × actividad = TDEE ${Math.round(tdee)} kcal, ${pctTxt} (${OBJETIVO_LABELS[input.objetivoCalorico]}) = ${calorieGoal} kcal/día.`;
  return { bmr, tdee, pct, calorieGoal, explicacion };
}
