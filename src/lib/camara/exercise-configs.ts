/**
 * Fase B del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md, sección 2.1.3).
 * Umbrales de ángulo por ejercicio para el conteo de reps (`rep-counter.ts`) y, donde la fuente lo
 * permite, para la validación de forma (Fase C — todavía no implementada acá).
 */
import type { RepCounterConfig } from "./rep-counter";

export type CameraExerciseId = "sentadilla" | "peso_muerto" | "press_banca" | "curl_biceps";

export interface CameraExerciseConfig extends RepCounterConfig {
  /** articulación que se trackea para contar repeticiones de este ejercicio. */
  joint: "knee" | "elbow";
  /** si hay fuente biomecánica confiable para validar "forma correcta" en este ángulo (sección
   * 2.1.3) — false significa que el ejercicio solo cuenta reps, sin coloreado de forma (Fase C). */
  hasFormValidation: boolean;
}

export const CAMERA_EXERCISE_CONFIGS: Record<CameraExerciseId, CameraExerciseConfig> = {
  sentadilla: {
    joint: "knee",
    // Parado casi recto. Margen sobre 180° real porque nadie se para con la rodilla
    // perfectamente trabada; evita que el "arriba" tiemble entrando y saliendo de la zona.
    extendedThreshold: 160,
    // ≈90° = definición reglamentaria de powerlifting (parte superior del muslo rompe el paralelo
    // con la rodilla), documentada como aproximación práctica, no un número de laboratorio exacto.
    // Fuentes: Frontiers in Sports and Active Living 2024, BMC Sports Science 2018 (roadmap 2.1.3).
    flexedThreshold: 100,
    // La sentadilla arranca parado — se cuenta la repetición al volver a pararse.
    startExtreme: "extended",
    hasFormValidation: true,
  },
  peso_muerto: {
    joint: "knee",
    // Lockout casi recto al final del levantamiento.
    extendedThreshold: 165,
    // Flexión de rodilla ≈103–108° en el setup del peso muerto convencional — Schellenberg et al.
    // 2013 (PMC3878967, roadmap 2.1.3), la fuente más sólida de las cuatro investigadas.
    flexedThreshold: 108,
    // El peso muerto arranca agachado sosteniendo la barra — se cuenta la repetición al volver a
    // esa posición (bajar la barra), convención estándar de conteo en sala de pesas.
    startExtreme: "flexed",
    hasFormValidation: true,
  },
  press_banca: {
    joint: "elbow",
    // Sin fuente confiable en grados para el codo (los únicos datos encontrados son proyectos de
    // laboratorio estudiantiles que se contradicen entre sí — roadmap 2.1.3). Los umbrales de
    // acá solo sirven para CONTAR reps (detectar los extremos relativos del movimiento), no para
    // juzgar si la forma es correcta — por eso `hasFormValidation: false`.
    extendedThreshold: 160,
    flexedThreshold: 80,
    startExtreme: "extended",
    hasFormValidation: false,
  },
  curl_biceps: {
    joint: "elbow",
    // Mismo caso que press de banca: sin fuente confiable en grados (único dato encontrado es de
    // un proyecto estudiantil de alcance limitado — roadmap 2.1.3). Solo cuenta reps.
    extendedThreshold: 160,
    flexedThreshold: 50,
    startExtreme: "extended",
    hasFormValidation: false,
  },
};
