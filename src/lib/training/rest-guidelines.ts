/**
 * Descanso sugerido entre series según el tipo de ejercicio y el tipo de serie. Módulo puro (sin store ni React),
 * mismo patrón que `hypertrophy-engine.ts`. Fuentes y decisiones de convención en
 * `docs/ciencia-entrenamiento.md` (sección «Descanso entre series»): las cifras base salen de ahí, no de acá.
 * Cuando un plan trae un descanso de su propia fuente, ese manda y este módulo no se usa.
 */
import type { Exercise, SetType } from "@/lib/types";

export type RestTier = "compuesto-pesado" | "compuesto" | "aislamiento";

/** Segundos base por tipo de ejercicio (ver la tabla del doc: ACSM 2009 y revisiones de descanso/hipertrofia). */
export const REST_BASE_SECONDS: Record<RestTier, number> = {
  "compuesto-pesado": 180,
  compuesto: 120,
  aislamiento: 75,
};

/** Segundos extra después de una serie al fallo / descendente / pesada (convención propia, ver el doc). */
export const REST_EXTRA_FAILURE = 30;
export const REST_EXTRA_DROPSET = 60;
export const REST_MAX_SECONDS = 240;

/** Levantamientos grandes de barra: los de mayor fatiga sistémica. */
const HEAVY_COMPOUND = new Set([
  "sentadilla-barra", "sentadilla-frontal", "sentadilla-hack-barra", "sentadilla-al-cajon",
  "peso-muerto", "peso-muerto-sumo", "peso-muerto-rumano", "peso-muerto-piernas-rigidas", "jalones-desde-rack",
  "press-banca-barra", "press-banca-agarre-ancho", "press-inclinado-barra", "press-declinado-barra",
  "press-militar-barra", "press-empuje", "remo-barra", "remo-posterior-barra", "remo-yates", "hip-thrust",
]);

/** Otros ejercicios multiarticulares (mancuernas, máquinas, peso corporal, poleas con varias articulaciones). */
const COMPOUND = new Set([
  "press-banca-mancuernas", "press-inclinado-mancuernas", "press-declinado-mancuernas", "press-banca-multipower",
  "press-inclinado-multipower", "press-banca-maquina", "press-inclinado-maquina", "press-declinado-maquina",
  "press-pecho-cable-sentado", "press-militar-mancuernas", "press-militar-maquina", "press-arnold",
  "fondos-paralelas", "fondos-pecho", "fondos-asistidos-maquina", "fondos-maquina", "press-cerrado", "flexiones",
  "dominadas", "dominadas-supinas", "jalon-polea", "jalon-agarre-ancho", "jalon-agarre-cerrado", "jalon-agarre-v",
  "jalon-agarre-supino", "remo-mancuerna", "remo-sentado-polea", "remo-en-t", "remo-unilateral-polea-sentado",
  "prensa-piernas", "sentadilla-hack", "sentadilla-bulgara", "sentadilla-goblet", "sentadilla-multipower",
  "zancadas", "zancadas-caminando-barra", "zancada-estatica-mancuernas", "step-up", "buenos-dias",
]);

export function restTierFor(exercise: Pick<Exercise, "id" | "musculosSecundarios"> | undefined, exerciseId: string): RestTier {
  if (HEAVY_COMPOUND.has(exerciseId)) return "compuesto-pesado";
  if (COMPOUND.has(exerciseId)) return "compuesto";
  // Ejercicios que no están en las listas (p. ej. personalizados): con 2+ músculos secundarios se tratan como compuestos.
  if (exercise && exercise.musculosSecundarios.length >= 2) return "compuesto";
  return "aislamiento";
}

export const REST_TIER_LABEL: Record<RestTier, string> = {
  "compuesto-pesado": "compuesto pesado",
  compuesto: "compuesto",
  aislamiento: "aislamiento",
};

export interface RestSuggestionInput {
  exerciseId: string;
  exercise?: Pick<Exercise, "id" | "musculosSecundarios">;
  /** Tipos de las series del ejercicio (`normal`, `fallo`, `descendente`...); se usa el más exigente. */
  setTypes: SetType[];
  /** Serie pesada (cerca del tope de la carga): cuenta como una serie cerca del fallo. */
  seriePesada?: boolean;
}

export interface RestSuggestion {
  seconds: number;
  tier: RestTier;
  /** Texto corto para mostrar al usuario: de dónde sale el número. */
  reason: string;
}

export function suggestRest({ exerciseId, exercise, setTypes, seriePesada }: RestSuggestionInput): RestSuggestion {
  const tier = restTierFor(exercise, exerciseId);
  let seconds = REST_BASE_SECONDS[tier];
  const motivos = [REST_TIER_LABEL[tier]];
  if (setTypes.includes("descendente")) {
    seconds += REST_EXTRA_DROPSET;
    motivos.push("con serie descendente");
  } else if (setTypes.includes("fallo")) {
    seconds += REST_EXTRA_FAILURE;
    motivos.push("con series al fallo");
  } else if (seriePesada) {
    seconds += REST_EXTRA_FAILURE;
    motivos.push("con serie pesada");
  }
  return { seconds: Math.min(seconds, REST_MAX_SECONDS), tier, reason: motivos.join(", ") };
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
