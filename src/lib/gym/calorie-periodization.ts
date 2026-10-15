/**
 * Periodización de fases (volumen / mantenimiento / déficit) — "coach de nutrición de verdad" que
 * sugiere subir o bajar de fase según el objetivo declarado (`gymProfile.objetivoCalorico`) y qué tan
 * rápido está cambiando el peso de TENDENCIA real (no la intención ni un número de un solo día).
 *
 * Esto NO reemplaza a `evaluateAdaptiveCalories` (ese ajusta el número exacto de kcal dentro de la
 * fase actual, comparando TDEE calculado vs observado) — esto decide si conviene cambiar de FASE,
 * usando los rangos de tasa de cambio semanal (% del peso corporal) de la literatura de nutrición
 * deportiva:
 *
 * - Volumen: 0.25-0.5 % del peso corporal por semana. Por encima de ese rango, la evidencia (Garthe
 *   et al. 2013, atletas de elite: ~0.3 kg/semana con buena relación músculo/grasa vs. un grupo de
 *   dieta libre que ganó más grasa por la misma ganancia de músculo) muestra que el excedente extra
 *   se va sobre todo a grasa, no a músculo. Por debajo del rango (o perdiendo peso), no hay superávit
 *   real pese al objetivo declarado.
 * - Déficit: 0.5-1 % del peso corporal por semana es el rango que la misma línea de investigación
 *   (Garthe et al. 2011; Helms et al., ISSN position stand sobre preparación de competencia natural)
 *   asocia con preservar mejor la masa muscular mientras se pierde grasa. Por encima del 1 %/semana
 *   crece el riesgo de perder músculo junto con la grasa; por debajo del 0.5 %/semana no hay déficit
 *   real.
 * - Mantenimiento: no tiene un rango "correcto" citable más allá de ~0 %/semana — se reporta la
 *   desviación si la hay, pero esta función NO decide sola cuándo volver a volumen o déficit después
 *   de un mantenimiento: cuánto dura una pausa de mantenimiento (diet break) es decisión del usuario,
 *   la literatura no fija una duración universal.
 *
 * Documentado en docs/ciencia-entrenamiento.md. Nunca cambia nada solo: es una sugerencia para que la
 * pantalla la muestre con Aceptar/Descartar, mismo patrón que `evaluateAdaptiveCalories`.
 */
import type { ObjetivoCalorico } from "@/lib/store/gymStore";
import type { WeightTrendResult } from "./calorie-adaptive";

export type CaloriePhase = "volumen" | "mantenimiento" | "deficit";

export const VOLUME_RATE_RANGE_PCT = { min: 0.25, max: 0.5 };
export const DEFICIT_RATE_RANGE_PCT = { min: 0.5, max: 1.0 };

export type PhaseAdjustment = "pasar_a_mantenimiento" | "subir_energia" | "bajar_energia" | null;

export interface PhaseReview {
  phase: CaloriePhase;
  sinDatosSuficientes: boolean;
  pctPerWeek: number | null;
  ajuste: PhaseAdjustment;
  mensaje: string;
}

export function phaseFromObjetivo(o: ObjetivoCalorico | undefined): CaloriePhase {
  if (o === "ganar") return "volumen";
  if (o === "perder") return "deficit";
  return "mantenimiento";
}

export function reviewCaloriePhase(objetivoCalorico: ObjetivoCalorico | undefined, trend: WeightTrendResult): PhaseReview {
  const phase = phaseFromObjetivo(objetivoCalorico);

  if (!trend.enoughData || trend.pctPerWeek === null) {
    return {
      phase,
      sinDatosSuficientes: true,
      pctPerWeek: null,
      ajuste: null,
      mensaje: "Todavía no hay suficiente historial de peso (al menos 4 pesadas por semana durante 2 semanas) para evaluar tu fase.",
    };
  }

  const pct = trend.pctPerWeek;

  if (phase === "volumen") {
    if (pct > VOLUME_RATE_RANGE_PCT.max) {
      return {
        phase,
        sinDatosSuficientes: false,
        pctPerWeek: pct,
        ajuste: "pasar_a_mantenimiento",
        mensaje: `Estás subiendo ${pct.toFixed(2)} %/semana, por encima del ${VOLUME_RATE_RANGE_PCT.max} % recomendado para un volumen limpio — la ganancia extra suele ser sobre todo grasa. Conviene una pausa de mantenimiento.`,
      };
    }
    if (pct < VOLUME_RATE_RANGE_PCT.min) {
      return {
        phase,
        sinDatosSuficientes: false,
        pctPerWeek: pct,
        ajuste: "subir_energia",
        mensaje: `Estás subiendo solo ${pct.toFixed(2)} %/semana, por debajo del ${VOLUME_RATE_RANGE_PCT.min} % de un volumen real — probá subir un poco más las calorías.`,
      };
    }
    return { phase, sinDatosSuficientes: false, pctPerWeek: pct, ajuste: null, mensaje: `Tu ritmo de volumen (${pct.toFixed(2)} %/semana) está dentro del rango recomendado (${VOLUME_RATE_RANGE_PCT.min}-${VOLUME_RATE_RANGE_PCT.max} %/semana).` };
  }

  if (phase === "deficit") {
    const lossRate = -pct; // pct es negativo si está bajando; lossRate positivo = ritmo de pérdida
    if (lossRate > DEFICIT_RATE_RANGE_PCT.max) {
      return {
        phase,
        sinDatosSuficientes: false,
        pctPerWeek: pct,
        ajuste: "pasar_a_mantenimiento",
        mensaje: `Estás bajando ${lossRate.toFixed(2)} %/semana, por encima del ${DEFICIT_RATE_RANGE_PCT.max} % recomendado — a este ritmo crece el riesgo de perder músculo junto con la grasa. Conviene una pausa de mantenimiento.`,
      };
    }
    if (lossRate < DEFICIT_RATE_RANGE_PCT.min) {
      return {
        phase,
        sinDatosSuficientes: false,
        pctPerWeek: pct,
        ajuste: "bajar_energia",
        mensaje: `Estás bajando solo ${lossRate.toFixed(2)} %/semana, por debajo del ${DEFICIT_RATE_RANGE_PCT.min} % de un déficit real — probá bajar un poco más las calorías.`,
      };
    }
    return { phase, sinDatosSuficientes: false, pctPerWeek: pct, ajuste: null, mensaje: `Tu ritmo de déficit (${lossRate.toFixed(2)} %/semana) está dentro del rango recomendado (${DEFICIT_RATE_RANGE_PCT.min}-${DEFICIT_RATE_RANGE_PCT.max} %/semana).` };
  }

  // Mantenimiento: informativo, sin ajuste sugerido (ver nota en el comentario del archivo).
  return {
    phase,
    sinDatosSuficientes: false,
    pctPerWeek: pct,
    ajuste: null,
    mensaje: Math.abs(pct) < 0.15 ? "Tu peso está estable, consistente con mantenimiento." : `Tu peso se está moviendo ${pct.toFixed(2)} %/semana en mantenimiento — si es a propósito, listo; si no, revisá tus calorías.`,
  };
}
