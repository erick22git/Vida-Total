// ---------- Entrenamiento de voz ----------
export type VoiceCategory = "pronunciacion" | "resonancia" | "diccion";

export interface VoiceLesson {
  id: string;
  day: number;
  title: string;
  description: string;
  category: VoiceCategory;
  exerciseText: string;
  tip?: string;
}

export interface Recording {
  id: string;
  lessonId?: string;
  date: string; // ISO date (yyyy-MM-dd)
  durationSec: number;
  note?: string;
}

// ---------- Lenguaje no verbal ----------
export type BodyLanguageCategory =
  | "postura"
  | "gestos"
  | "contacto_visual"
  | "microexpresiones";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface BodyLanguageLesson {
  id: string;
  day: number;
  title: string;
  tip: string;
  illustration: string; // emoji
  category: BodyLanguageCategory;
  explanation: string;
  example: string;
  quiz?: QuizQuestion[];
}

// ---------- Oratoria ----------
export interface SpeechStructure {
  id: string;
  name: string;
  sections: string[];
  tips: string[];
}

export interface PublicSpeakingExercise {
  id: string;
  title: string;
  description: string;
}

export interface PersuasionPrinciple {
  id: string;
  name: string;
  explanation: string;
}

// ---------- Progreso guardado por el usuario ----------
export interface VoiceLessonProgress {
  lessonId: string;
  date: string; // ISO date de cuando se completó
}

export interface BodyLanguageProgress {
  lessonId: string;
  date: string;
  quizScore?: number; // aciertos
  quizTotal?: number;
}
