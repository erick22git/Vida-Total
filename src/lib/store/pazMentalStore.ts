import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { differenceInCalendarDays, format } from "date-fns";
import type {
  AngerEpisode,
  ChatMessage,
  JournalEntry,
  MeditationSession,
  MeditationType,
  MoodEntry,
  SkincareLog,
  SkincareProduct,
} from "@/lib/types/paz-mental";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "m-welcome",
  role: "assistant",
  content:
    "Hola, soy tu compañero de Paz Mental. Estoy aquí para escucharte. ¿Cómo te sientes hoy?",
  timestamp: Date.now(),
};

interface PazMentalState {
  // ---------- Meditación ----------
  meditationSessions: MeditationSession[];
  addMeditationSession: (
    session: Omit<MeditationSession, "id" | "date">,
  ) => void;

  // ---------- Humor ----------
  moodEntries: MoodEntry[];
  addMoodEntry: (entry: Partial<MoodEntry> & { level: 1 | 2 | 3 | 4 | 5; emoji: string }) => void;

  // ---------- Diario ----------
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: Omit<JournalEntry, "id" | "date">) => void;
  removeJournalEntry: (id: string) => void;

  // ---------- Ira ----------
  angerEpisodes: AngerEpisode[];
  addAngerEpisode: (episode: Omit<AngerEpisode, "id" | "date">) => void;

  // ---------- Yoga facial ----------
  facialYogaLog: string[]; // ISO dates on which at least one exercise was done
  logFacialYogaToday: () => void;

  // ---------- Yoga corporal ----------
  yogaSessionsCompleted: number;
  logYogaSession: () => void;

  // ---------- Piel ----------
  skincareProducts: SkincareProduct[];
  addSkincareProduct: (product: Omit<SkincareProduct, "id">) => void;
  removeSkincareProduct: (id: string) => void;
  toggleProductActive: (id: string) => void;
  skincareLogs: SkincareLog[];
  addSkincareLog: (log: Omit<SkincareLog, "id" | "date">) => void;

  // ---------- Asistente IA ----------
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearChat: () => void;
}

export const usePazMentalStore = create<PazMentalState>()(
  persist(
    (set) => ({
      // Meditación
      meditationSessions: [],
      addMeditationSession: (session) =>
        set((state) => ({
          meditationSessions: [
            ...state.meditationSessions,
            { ...session, id: uid(), date: todayISO() },
          ],
        })),

      // Humor
      moodEntries: [],
      addMoodEntry: (entry) =>
        set((state) => {
          const today = todayISO();
          const withoutToday = state.moodEntries.filter((m) => m.date !== today);
          return {
            moodEntries: [
              ...withoutToday,
              {
                id: uid(),
                date: today,
                level: entry.level,
                emoji: entry.emoji,
                note: entry.note,
                gratitudeItems: entry.gratitudeItems ?? [],
              },
            ],
          };
        }),

      // Diario
      journalEntries: [],
      addJournalEntry: (entry) =>
        set((state) => ({
          journalEntries: [
            { ...entry, id: uid(), date: todayISO() },
            ...state.journalEntries,
          ],
        })),
      removeJournalEntry: (id) =>
        set((state) => ({
          journalEntries: state.journalEntries.filter((j) => j.id !== id),
        })),

      // Ira
      angerEpisodes: [],
      addAngerEpisode: (episode) =>
        set((state) => ({
          angerEpisodes: [
            { ...episode, id: uid(), date: todayISO() },
            ...state.angerEpisodes,
          ],
        })),

      // Yoga facial
      facialYogaLog: [],
      logFacialYogaToday: () =>
        set((state) => {
          const today = todayISO();
          if (state.facialYogaLog.includes(today)) return state;
          return { facialYogaLog: [...state.facialYogaLog, today] };
        }),

      // Yoga corporal
      yogaSessionsCompleted: 0,
      logYogaSession: () =>
        set((state) => ({ yogaSessionsCompleted: state.yogaSessionsCompleted + 1 })),

      // Piel
      skincareProducts: [],
      addSkincareProduct: (product) =>
        set((state) => ({
          skincareProducts: [...state.skincareProducts, { ...product, id: uid() }],
        })),
      removeSkincareProduct: (id) =>
        set((state) => ({
          skincareProducts: state.skincareProducts.filter((p) => p.id !== id),
        })),
      toggleProductActive: (id) =>
        set((state) => ({
          skincareProducts: state.skincareProducts.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p,
          ),
        })),
      skincareLogs: [],
      addSkincareLog: (log) =>
        set((state) => {
          const today = todayISO();
          const withoutToday = state.skincareLogs.filter((l) => l.date !== today);
          return {
            skincareLogs: [...withoutToday, { ...log, id: uid(), date: today }],
          };
        }),

      // Asistente IA
      chatMessages: [WELCOME_MESSAGE],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [
            ...state.chatMessages,
            { ...message, id: uid(), timestamp: Date.now() },
          ],
        })),
      clearChat: () => set({ chatMessages: [WELCOME_MESSAGE] }),
    }),
    {
      name: "vida-total-paz-mental-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------- Selectors / helpers ----------

export function useTodayMood() {
  const moodEntries = usePazMentalStore((s) => s.moodEntries);
  const today = todayISO();
  return moodEntries.find((m) => m.date === today) ?? null;
}

export function useMeditationStreak() {
  const sessions = usePazMentalStore((s) => s.meditationSessions);
  const dates = Array.from(new Set(sessions.map((s) => s.date))).sort();
  if (dates.length === 0) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const diff = differenceInCalendarDays(new Date(dates[i]), new Date(dates[i - 1]));
    if (diff === 1) streak++;
    else break;
  }
  const lastDate = dates[dates.length - 1];
  const diffToToday = differenceInCalendarDays(new Date(todayISO()), new Date(lastDate));
  if (diffToToday > 1) return 0;
  return streak;
}

export function useFacialYogaStreak() {
  const log = usePazMentalStore((s) => s.facialYogaLog);
  const dates = Array.from(new Set(log)).sort();
  if (dates.length === 0) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const diff = differenceInCalendarDays(new Date(dates[i]), new Date(dates[i - 1]));
    if (diff === 1) streak++;
    else break;
  }
  const lastDate = dates[dates.length - 1];
  const diffToToday = differenceInCalendarDays(new Date(todayISO()), new Date(lastDate));
  if (diffToToday > 1) return 0;
  return streak;
}

export const MEDITATION_TYPE_LABEL: Record<MeditationType, string> = {
  guiada: "Guiada",
  respiracion: "Respiración",
  libre: "Libre",
};
