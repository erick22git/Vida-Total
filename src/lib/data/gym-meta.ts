import type { MuscleGroup } from "@/lib/types";

export const MUSCLE_GROUPS: { value: MuscleGroup; label: string; icon: string }[] = [
  { value: "Pecho", label: "Pecho", icon: "Heart" },
  { value: "Espalda", label: "Espalda", icon: "ArrowLeftRight" },
  { value: "Hombros", label: "Hombros", icon: "Triangle" },
  { value: "Biceps", label: "Bíceps", icon: "BicepsFlexed" },
  { value: "Triceps", label: "Tríceps", icon: "Dumbbell" },
  { value: "Cuadriceps", label: "Cuádriceps", icon: "Footprints" },
  { value: "Femoral", label: "Femoral", icon: "Footprints" },
  { value: "Pantorrilla", label: "Pantorrilla", icon: "Footprints" },
  { value: "Gluteos", label: "Glúteos", icon: "CircleDot" },
  { value: "Abdomen", label: "Abdomen", icon: "Hexagon" },
  { value: "Abductores", label: "Abductores", icon: "MoveHorizontal" },
  { value: "Aductores", label: "Aductores", icon: "Move" },
  { value: "Cardio", label: "Cardio", icon: "HeartPulse" },
];

export const EQUIPMENT_LIST: string[] = [
  "Barra",
  "Mancuernas",
  "Mancuerna",
  "Máquina",
  "Máquina Smith",
  "Máquina de remo",
  "Polea",
  "Paralelas",
  "Peso corporal",
  "Barra de dominadas",
  "Banco romano",
  "Banco",
  "Barra T",
  "Barra Z",
  "Balón medicinal",
  "Rueda abdominal",
  "Cinta",
  "Bicicleta",
  "Cuerda",
  "Kettlebell",
  "Banda elástica",
];

export const MUSCLE_COLOR: Record<string, string> = {
  Pecho: "#f97362",
  Espalda: "#5b8def",
  Hombros: "#f6c744",
  Biceps: "#a970ff",
  Triceps: "#ff8fc7",
  Cuadriceps: "#4ade80",
  Femoral: "#84cc16",
  Pantorrilla: "#34d399",
  Gluteos: "#fb923c",
  Abdomen: "#22d3ee",
  Abductores: "#c084fc",
  Aductores: "#2dd4bf",
  Cardio: "#f43f5e",
};

/** Fun, random-flavored names used for AI-generated routines/plans. */
export const FUNNY_ROUTINE_NAMES = [
  "Operación Rellenar la Camisa",
  "Proyecto Espalda de Cobra",
  "Misión Piernas de Avestruz Nunca Más",
  "Plan Bíceps de Emergencia",
  "Modo Bestia Activado",
  "El Despertar del Trapecio",
  "Guerra Contra el Sofá",
  "Código: Hombros de Titán",
  "Los Vengadores del Six Pack",
  "Operación No Saltarme Pierna",
  "El Renacer del Press Banca",
  "Plan Maestro Anti Flacidez",
  "La Última Serie (Nunca lo Es)",
  "Fábrica de Gains 3000",
  "El Trono de Hierro (Fundido)",
];

export const PLAN_CATEGORIES = ["En el Gym", "Calistenia", "En casa", "Funcional"];

export const MUSCLE_SUBGROUPS: Record<string, string[]> = {
  Brazos: ["Bíceps", "Antebrazos", "Tríceps"],
  Piernas: ["Cuádriceps", "Isquiotibiales", "Gemelos"],
  Espalda: ["Dorsal", "Trapecio", "Lumbar"],
  Pecho: ["Pectoral superior", "Pectoral medio", "Pectoral inferior"],
  Hombros: ["Deltoide anterior", "Deltoide lateral", "Deltoide posterior"],
  Abdominales: ["Recto abdominal", "Oblicuos"],
  Cuello: ["Cuello"],
};

export const BODY_GROUPS = Object.keys(MUSCLE_SUBGROUPS);
