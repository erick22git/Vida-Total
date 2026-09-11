import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { differenceInCalendarDays, format } from "date-fns";
import type {
  Recording,
  VoiceLessonProgress,
  BodyLanguageProgress,
} from "@/lib/types/voice";
import voiceLessonsData from "@/lib/data/voice-lessons.json";
import bodyLanguageLessonsData from "@/lib/data/body-language-lessons.json";
import type { VoiceLesson, BodyLanguageLesson } from "@/lib/types/voice";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export const VOICE_LESSONS = voiceLessonsData as VoiceLesson[];
export const BODY_LANGUAGE_LESSONS = bodyLanguageLessonsData as BodyLanguageLesson[];

interface VoiceState {
  // ---------- Entrenamiento de voz ----------
  completedLessons: VoiceLessonProgress[];
  completeLesson: (lessonId: string) => void;
  isLessonCompleted: (lessonId: string) => boolean;

  recordings: Recording[];
  addRecording: (recording: Omit<Recording, "id" | "date">) => void;
  removeRecording: (id: string) => void;

  // ---------- Lenguaje no verbal ----------
  bodyLanguageProgress: BodyLanguageProgress[];
  completeBodyLanguageLesson: (
    lessonId: string,
    quizScore?: number,
    quizTotal?: number,
  ) => void;
  isBodyLanguageLessonCompleted: (lessonId: string) => boolean;

  // ---------- Oratoria ----------
  breathingSessionsCompleted: number;
  practiceDays: string[]; // ISO dates cuando se hizo cualquier práctica de oratoria
  logOratoriaPractice: () => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set, get) => ({
      // Entrenamiento de voz
      completedLessons: [],
      completeLesson: (lessonId) =>
        set((state) => {
          if (state.completedLessons.some((l) => l.lessonId === lessonId)) {
            return state;
          }
          return {
            completedLessons: [
              ...state.completedLessons,
              { lessonId, date: todayISO() },
            ],
          };
        }),
      isLessonCompleted: (lessonId) =>
        get().completedLessons.some((l) => l.lessonId === lessonId),

      recordings: [],
      addRecording: (recording) =>
        set((state) => ({
          recordings: [
            { ...recording, id: uid(), date: todayISO() },
            ...state.recordings,
          ],
        })),
      removeRecording: (id) =>
        set((state) => ({
          recordings: state.recordings.filter((r) => r.id !== id),
        })),

      // Lenguaje no verbal
      bodyLanguageProgress: [],
      completeBodyLanguageLesson: (lessonId, quizScore, quizTotal) =>
        set((state) => {
          const withoutLesson = state.bodyLanguageProgress.filter(
            (p) => p.lessonId !== lessonId,
          );
          return {
            bodyLanguageProgress: [
              ...withoutLesson,
              { lessonId, date: todayISO(), quizScore, quizTotal },
            ],
          };
        }),
      isBodyLanguageLessonCompleted: (lessonId) =>
        get().bodyLanguageProgress.some((p) => p.lessonId === lessonId),

      // Oratoria
      breathingSessionsCompleted: 0,
      practiceDays: [],
      logOratoriaPractice: () =>
        set((state) => {
          const today = todayISO();
          const practiceDays = state.practiceDays.includes(today)
            ? state.practiceDays
            : [...state.practiceDays, today];
          return {
            breathingSessionsCompleted: state.breathingSessionsCompleted + 1,
            practiceDays,
          };
        }),
    }),
    {
      name: "vida-total-voz-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-voz-store")),
    },
  ),
);

// ---------- Selectors / helpers ----------

function computeStreak(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return 0;
  let streak = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const diff = differenceInCalendarDays(
      new Date(unique[i]),
      new Date(unique[i - 1]),
    );
    if (diff === 1) streak++;
    else break;
  }
  const lastDate = unique[unique.length - 1];
  const diffToToday = differenceInCalendarDays(
    new Date(todayISO()),
    new Date(lastDate),
  );
  if (diffToToday > 1) return 0;
  return streak;
}

/** Racha de días con al menos una actividad de voz: lección completada,
 * grabación hecha, lección de lenguaje no verbal completada, o práctica de oratoria. */
export function useVoiceStreak() {
  const completedLessons = useVoiceStore((s) => s.completedLessons);
  const recordings = useVoiceStore((s) => s.recordings);
  const bodyLanguageProgress = useVoiceStore((s) => s.bodyLanguageProgress);
  const practiceDays = useVoiceStore((s) => s.practiceDays);

  const dates = [
    ...completedLessons.map((l) => l.date),
    ...recordings.map((r) => r.date),
    ...bodyLanguageProgress.map((p) => p.date),
    ...practiceDays,
  ];
  return computeStreak(dates);
}

/** Devuelve la lección de entrenamiento de voz correspondiente al día actual,
 * ciclando si ya se completaron todas. */
export function useTodayVoiceLesson(): VoiceLesson {
  const completedLessons = useVoiceStore((s) => s.completedLessons);
  const completedCount = completedLessons.length;
  const idx = completedCount % VOICE_LESSONS.length;
  return VOICE_LESSONS[idx];
}

export function useNextUnlockedDay(): number {
  const completedLessons = useVoiceStore((s) => s.completedLessons);
  return Math.min(completedLessons.length + 1, VOICE_LESSONS.length);
}

export const VOICE_CATEGORY_LABEL: Record<string, string> = {
  pronunciacion: "Pronunciación",
  resonancia: "Resonancia",
  diccion: "Dicción",
};

export const BODY_LANGUAGE_CATEGORY_LABEL: Record<string, string> = {
  postura: "Postura",
  gestos: "Gestos",
  contacto_visual: "Contacto visual",
  microexpresiones: "Microexpresiones",
};
