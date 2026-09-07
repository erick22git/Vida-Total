// ---------- Meditación ----------
export type MeditationType = "guiada" | "respiracion" | "libre";

export interface MeditationSession {
  id: string;
  type: MeditationType;
  duration: number; // segundos
  date: string; // ISO date (yyyy-MM-dd)
  soundsUsed: string[];
}

export type BreathingPatternId = "relajacion" | "sueno" | "box";

export interface BreathingPattern {
  id: BreathingPatternId;
  label: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfterExhale?: number;
}

export interface AmbientSound {
  id: string;
  label: string;
  icon: string; // lucide icon name
}

// ---------- Humor / Mood ----------
export interface MoodEntry {
  id: string;
  date: string; // ISO date
  level: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  note?: string;
  gratitudeItems: string[];
}

// ---------- Diario ----------
export interface JournalEntry {
  id: string;
  date: string; // ISO date
  title: string;
  content: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  tags: string[];
}

// ---------- Control de ira ----------
export interface AngerEpisode {
  id: string;
  date: string; // ISO date
  trigger: string;
  intensity: number; // 1-10
  technique: string;
  outcome?: string;
}

// ---------- Yoga corporal ----------
export type YogaCategory =
  | "Flexibilidad"
  | "Fuerza"
  | "Relajación"
  | "Matutino"
  | "Nocturno";

export interface YogaPose {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  difficulty: "Principiante" | "Intermedio" | "Avanzado";
  category: YogaCategory;
  instructions: string[];
}

export interface YogaRoutine {
  id: string;
  name: string;
  category: YogaCategory;
  difficulty: "Principiante" | "Intermedio" | "Avanzado";
  poseIds: string[];
}

// ---------- Yoga facial ----------
export type FacialZone =
  | "frente"
  | "ojos"
  | "mejillas"
  | "nariz"
  | "boca"
  | "mandibula";

export interface FacialExercise {
  id: string;
  zone: FacialZone;
  name: string;
  description: string;
  durationSec: number;
  repetitions: number;
}

// ---------- Control de piel ----------
export type SkinCondition = "Acné" | "Rosácea" | "Manchas" | "General";

export interface SkincareProduct {
  id: string;
  name: string;
  brand: string;
  type: string;
  condition: SkinCondition;
  isActive: boolean;
  effectiveness: 1 | 2 | 3 | 4 | 5;
}

export interface SkincareLog {
  id: string;
  date: string; // ISO date
  productIds: string[];
  skinCondition: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

// ---------- Asistente IA ----------
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestedHref?: string;
  suggestedLabel?: string;
}
