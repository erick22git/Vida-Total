/**
 * Meta diaria de agua sugerida con base científica (pedido: "que sepa cuánta agua debería tomar al
 * día respaldado con base científica... relacionado a cuántas calorías y el ejercicio que hago").
 * Combina dos piezas, cada una con su propia fuente — no inventa ningún número:
 *
 * 1. Base por sexo/edad: la AI (Adequate Intake) de agua total del Institute of Medicine, de la que
 *    ~81% viene de bebidas — exactamente la misma cuenta que ya usa `nutrient-targets.ts` (reusada
 *    acá, no duplicada) para la sugerencia de "Revisar sugerencia" de Ajustes de Calorías.
 * 2. Extra por el entrenamiento de HOY: Mayo Clinic Care Network (atribuido a la ACSM) recomienda
 *    120-230 ml cada 15-20 minutos de ejercicio. Es un estimado GENERAL, no individualizado — el
 *    propio position stand de la ACSM (2007, "Exercise and Fluid Replacement") evita dar un número
 *    fijo porque la tasa de sudor real varía mucho entre personas, y lo preciso es pesarse antes y
 *    después del ejercicio, algo que esta app no mide. Se usa el punto medio de ese rango (~10 ml por
 *    minuto de entrenamiento), redondeado a los 50 ml más cercanos.
 *
 * Nunca cambia la meta guardada por su cuenta — es una sugerencia con Aceptar/Descartar, mismo patrón
 * que el resto de los ajustes adaptativos de la app.
 */
import { getNutrientTargets, type Sexo } from "@/lib/nutrition/nutrient-targets";

/** Punto medio de 120-230 ml cada 15-20 min (Mayo Clinic Care Network / ACSM) — ver comentario de arriba. */
export const EXERCISE_WATER_ML_PER_MIN = 10;

export interface WaterGoalSuggestion {
  baseMl: number;
  genericoBase: boolean;
  exerciseMinutesToday: number;
  exercicioMl: number;
  totalMl: number;
  mensaje: string;
}

export function suggestWaterGoal(sexo: Sexo | undefined, edad: number | undefined, exerciseMinutesToday: number): WaterGoalSuggestion {
  const targets = getNutrientTargets({ sexo, edad });
  const aguaBebidas = targets.targets.aguaBebidas;
  const baseMl = aguaBebidas.objetivo;
  const minutos = Math.max(0, Math.round(exerciseMinutesToday));
  const exercicioMl = Math.round((minutos * EXERCISE_WATER_ML_PER_MIN) / 50) * 50;
  const totalMl = baseMl + exercicioMl;
  const mensaje =
    exercicioMl > 0
      ? `${baseMl} ml base (según sexo/edad) + ${exercicioMl} ml extra por ${minutos} min de entrenamiento hoy (estimado general, Mayo Clinic/ACSM) = ${totalMl} ml.`
      : `${baseMl} ml base (según sexo/edad). Sin entrenamiento registrado hoy, sin ajuste extra.`;
  return { baseMl, genericoBase: aguaBebidas.generico, exerciseMinutesToday: minutos, exercicioMl, totalMl, mensaje };
}

// ─────────────────────────────────────────────────────────
// Ajuste según tu progreso y cómo responde tu cuerpo
// ─────────────────────────────────────────────────────────
//
// Piezas (todas SUGERENCIAS, nunca cambian la meta solas):
//  - Calor: ambientes calurosos suben la pérdida por sudor; el IOM (2005) y la ACSM (2007) lo reconocen
//    sin dar una cifra única. Se usa un extra fijo de 500 ml (estimado general).
//  - Color de la orina: marcador de hidratación validado (Armstrong et al., 1994/2012, escala 1-8; un
//    color igual o más oscuro que "ámbar" indica deshidratación leve). Orina oscura = +250 ml.
//    Orina clara no baja la meta sola (puede ser exceso de agua o una mañana atípica).
//  - Progreso: si la meta ideal queda lejos de la actual y NO la estás cumpliendo (menos de 4 de los
//    últimos 7 días al 80 % o más), se sube de a +250 ml por paso en vez de saltar de golpe.
//  - Tope: 1500-4500 ml. Tomar mucho más aumenta el riesgo de hiponatremia, y con enfermedad renal o
//    cardíaca, o con indicación médica de limitar líquidos, el valor lo define un profesional.

export type OrinaColor = "clara" | "amarilla" | "oscura";

export const WATER_GOAL_MIN_ML = 1500;
export const WATER_GOAL_MAX_ML = 4500;
export const HEAT_WATER_ML = 500;
export const DARK_URINE_WATER_ML = 250;
export const GRADUAL_STEP_ML = 250;

export interface AdaptiveWaterInput {
  sexo: Sexo | undefined;
  edad: number | undefined;
  exerciseMinutesToday: number;
  calor: boolean;
  orina?: OrinaColor;
  currentGoalMl: number;
  /** ml totales de cada uno de los 7 días anteriores a hoy. */
  last7DaysMl: number[];
}

export interface AdaptiveWaterSuggestion extends WaterGoalSuggestion {
  /** Meta ideal hoy, sin la rampa gradual (con tope). */
  idealMl: number;
  /** Días de los últimos 7 con al menos 80 % de la meta actual. */
  diasCumplidos: number;
  /** true si `totalMl` es un paso hacia `idealMl`, no el valor completo. */
  gradual: boolean;
  extras: { label: string; ml: number }[];
}

const round50 = (n: number) => Math.round(n / 50) * 50;

export function suggestAdaptiveWaterGoal(i: AdaptiveWaterInput): AdaptiveWaterSuggestion {
  const base = suggestWaterGoal(i.sexo, i.edad, i.exerciseMinutesToday);
  const extras: { label: string; ml: number }[] = [{ label: "Base por sexo/edad", ml: base.baseMl }];
  if (base.exercicioMl > 0) extras.push({ label: `Entrenamiento hoy (${base.exerciseMinutesToday} min)`, ml: base.exercicioMl });
  if (i.calor) extras.push({ label: "Clima caluroso", ml: HEAT_WATER_ML });
  if (i.orina === "oscura") extras.push({ label: "Orina oscura", ml: DARK_URINE_WATER_ML });

  const sum = extras.reduce((a, e) => a + e.ml, 0);
  const idealMl = Math.min(WATER_GOAL_MAX_ML, Math.max(WATER_GOAL_MIN_ML, round50(sum)));

  const goal = i.currentGoalMl > 0 ? i.currentGoalMl : idealMl;
  const diasCumplidos = i.last7DaysMl.filter((ml) => ml >= goal * 0.8).length;
  const needsRamp = idealMl > goal + GRADUAL_STEP_ML && diasCumplidos < 4;
  const totalMl = needsRamp ? Math.min(idealMl, goal + GRADUAL_STEP_ML) : idealMl;

  const partes = extras.map((e) => `${e.label}: ${e.ml} ml`).join(" · ");
  const rampa = needsRamp
    ? ` Cumpliste ${diasCumplidos}/7 días la meta actual, así que subo de a ${GRADUAL_STEP_ML} ml hasta llegar a ${idealMl} ml.`
    : "";
  const topeNota = sum > WATER_GOAL_MAX_ML ? ` (limitado al tope de ${WATER_GOAL_MAX_ML} ml por seguridad)` : "";
  return { ...base, totalMl, idealMl, diasCumplidos, gradual: needsRamp, extras, mensaje: `${partes} = ${idealMl} ml${topeNota}.${rampa}` };
}
