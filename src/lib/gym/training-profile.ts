/**
 * Opciones del perfil de entrenamiento (Configuración > Perfil de entrenamiento). Un solo lugar para
 * etiquetas y descripciones; los valores se guardan en `gymProfile` (ver `GymProfile` en gymStore).
 * Sexo, edad, peso, altura, nivel de actividad, lesiones y objetivo ya existían y se comparten con
 * Calorías / el onboarding: acá NO se duplican, solo se editan.
 */
import type { Experiencia, EquipoDisponible, IntensidadEntrenamiento } from "@/lib/store/gymStore";

export const EXPERIENCIA_OPTIONS: { value: Experiencia; label: string; description: string }[] = [
  { value: "menos_6m", label: "Menos de 6 meses", description: "Recién empiezo o retomo después de mucho tiempo" },
  { value: "6m_2a", label: "6 meses a 2 años", description: "Ya conozco los ejercicios básicos" },
  { value: "2_5a", label: "2 a 5 años", description: "Entreno con constancia y manejo mi técnica" },
  { value: "mas_5a", label: "Más de 5 años", description: "Mucha experiencia levantando pesas" },
];

/** Mismas claves que usa el onboarding de Entrenamiento (`gymProfile.objetivo`). */
export const OBJETIVO_ENTRENAMIENTO_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "musculo", label: "Ganar músculo", description: "Hipertrofia: más volumen muscular" },
  { value: "fuerza", label: "Ganar fuerza", description: "Levantar cada vez más peso" },
  { value: "grasa", label: "Perder grasa", description: "Bajar grasa conservando el músculo" },
  { value: "funcionalidad", label: "Mejorar funcionalidad", description: "Salud general, resistencia y movilidad" },
];

export const EQUIPO_OPTIONS: { value: EquipoDisponible; label: string; description: string }[] = [
  { value: "gimnasio", label: "Gimnasio completo", description: "Barras, poleas y máquinas" },
  { value: "mancuernas", label: "Mancuernas y banco", description: "Entreno en casa con lo básico" },
  { value: "peso_corporal", label: "Solo peso corporal", description: "Sin equipo" },
];

export const INTENSIDAD_OPTIONS: { value: IntensidadEntrenamiento; label: string; description: string }[] = [
  { value: "ligera", label: "Ligera", description: "Termino las series sobrado, con 4 o más repeticiones en reserva" },
  { value: "moderada", label: "Moderada", description: "Termino con 2–3 repeticiones en reserva" },
  { value: "alta", label: "Alta", description: "Llego al límite o casi, 0–1 repeticiones en reserva" },
];

export const DIAS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DURACION_OPTIONS = [30, 45, 60, 75, 90] as const;
