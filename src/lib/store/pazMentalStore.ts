import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
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
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertMeditationSession,
  syncReplaceMoodEntryForDate,
  syncInsertJournalEntry,
  syncDeleteJournalEntry,
  syncInsertAngerEpisode,
  syncInsertSkincareProduct,
  syncDeleteSkincareProduct,
  syncUpdateSkincareProduct,
  syncReplaceSkincareLogForDate,
  syncInsertChatMessage,
  hydratePazMentalStoreFromSupabase,
  type PazMentalHydratedState,
} from "@/lib/sync/paz-mental-sync";

/**
 * Id único usado tanto como key local (React, lookups en el store) como
 * primary key de la fila remota en Supabase (columnas `uuid` — ver
 * supabase/migrations/0002_module_data_sync.sql). Antes generaba un string
 * base36 corto que NO era un UUID válido; se cambió a `crypto.randomUUID()`
 * para que el mismo id sirva en ambos lados sin mantener un mapeo
 * id-local <-> id-remoto (mismo cambio que gymStore.ts).
 */
function uid() {
  return crypto.randomUUID();
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
      addMeditationSession: (session) => {
        const created: MeditationSession = { ...session, id: uid(), date: todayISO() };
        set((state) => ({
          meditationSessions: [...state.meditationSessions, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertMeditationSession(created, uidUser);
      },

      // Humor
      moodEntries: [],
      addMoodEntry: (entry) => {
        const today = todayISO();
        let oldId: string | null = null;
        const created: MoodEntry = {
          id: uid(),
          date: today,
          level: entry.level,
          emoji: entry.emoji,
          note: entry.note,
          gratitudeItems: entry.gratitudeItems ?? [],
        };
        set((state) => {
          oldId = state.moodEntries.find((m) => m.date === today)?.id ?? null;
          const withoutToday = state.moodEntries.filter((m) => m.date !== today);
          return { moodEntries: [...withoutToday, created] };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncReplaceMoodEntryForDate(oldId, created, uidUser);
      },

      // Diario
      journalEntries: [],
      addJournalEntry: (entry) => {
        const created: JournalEntry = { ...entry, id: uid(), date: todayISO() };
        set((state) => ({
          journalEntries: [created, ...state.journalEntries],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertJournalEntry(created, uidUser);
      },
      removeJournalEntry: (id) => {
        set((state) => ({
          journalEntries: state.journalEntries.filter((j) => j.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteJournalEntry(id, uidUser);
      },

      // Ira
      angerEpisodes: [],
      addAngerEpisode: (episode) => {
        const created: AngerEpisode = { ...episode, id: uid(), date: todayISO() };
        set((state) => ({
          angerEpisodes: [created, ...state.angerEpisodes],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertAngerEpisode(created, uidUser);
      },

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
      addSkincareProduct: (product) => {
        const created: SkincareProduct = { ...product, id: uid() };
        set((state) => ({
          skincareProducts: [...state.skincareProducts, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertSkincareProduct(created, uidUser);
      },
      removeSkincareProduct: (id) => {
        set((state) => ({
          skincareProducts: state.skincareProducts.filter((p) => p.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteSkincareProduct(id, uidUser);
      },
      toggleProductActive: (id) => {
        let nextIsActive = false;
        set((state) => ({
          skincareProducts: state.skincareProducts.map((p) => {
            if (p.id !== id) return p;
            nextIsActive = !p.isActive;
            return { ...p, isActive: nextIsActive };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateSkincareProduct(id, { isActive: nextIsActive }, uidUser);
      },
      skincareLogs: [],
      addSkincareLog: (log) => {
        const today = todayISO();
        let oldId: string | null = null;
        const created: SkincareLog = { ...log, id: uid(), date: today };
        set((state) => {
          oldId = state.skincareLogs.find((l) => l.date === today)?.id ?? null;
          const withoutToday = state.skincareLogs.filter((l) => l.date !== today);
          return { skincareLogs: [...withoutToday, created] };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncReplaceSkincareLogForDate(oldId, created, uidUser);
      },

      // Asistente IA
      chatMessages: [WELCOME_MESSAGE],
      addChatMessage: (message) => {
        const created: ChatMessage = { ...message, id: uid(), timestamp: Date.now() };
        set((state) => ({
          chatMessages: [...state.chatMessages, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertChatMessage(created, uidUser);
      },
      clearChat: () => set({ chatMessages: [WELCOME_MESSAGE] }),
    }),
    {
      name: "vida-total-paz-mental-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-paz-mental-store")),
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — hidratación
// ============================================================================
//
// Mismo mecanismo que `hydrateGymStore` en gymStore.ts — leer ese archivo
// para el razonamiento completo. En resumen: la primera sincronización de
// un usuario que ya venía usando la app encuentra las 7 tablas de Paz
// Mental vacías en Supabase, así que NUNCA se reemplaza el estado local por
// lo remoto — se mezcla por id (`mergeById`) y lo que era solo local se
// sube (backfill) a Supabase. Esto es más importante acá que en otros
// módulos: un diario/historial de humor perdido es información personal
// sensible, no solo un inconveniente.

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce — nunca
 * borra datos locales. Ver `mergeById` en gymStore.ts (misma función,
 * copiada acá porque no hay un módulo compartido para esto todavía).
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Trae las 7 tablas de Paz Mental de Supabase para `userId`, las MEZCLA
 * (nunca reemplaza) con lo que ya hay en el store, y sube (backfill)
 * cualquier dato que solo existiera localmente. Pensado para llamarse UNA
 * vez por sesión de login, apenas se conoce el userId (ver
 * `UserScopeScript`). Tolerante a fallos: si Supabase no responde, cada
 * tabla cae de vuelta a `[]` y el merge deja todo el estado local intacto.
 */
export async function hydratePazMentalStore(userId: string): Promise<void> {
  const remote: PazMentalHydratedState = await hydratePazMentalStoreFromSupabase(userId);
  const local = usePazMentalStore.getState();

  const meditationSessions = mergeById(remote.meditationSessions, local.meditationSessions);
  const moodEntries = mergeById(remote.moodEntries, local.moodEntries);
  const journalEntries = mergeById(remote.journalEntries, local.journalEntries);
  const angerEpisodes = mergeById(remote.angerEpisodes, local.angerEpisodes);
  const skincareProducts = mergeById(remote.skincareProducts, local.skincareProducts);
  const skincareLogs = mergeById(remote.skincareLogs, local.skincareLogs);
  // El mensaje de bienvenida estático (id "m-welcome") no es un UUID y
  // nunca se sincroniza — se excluye del merge/backfill para no intentar
  // insertarlo en Supabase (columna `id` es `uuid`) ni duplicarlo.
  const localChatMessages = local.chatMessages.filter((m) => m.id !== WELCOME_MESSAGE.id);
  const chatMessages = mergeById(remote.chatMessages, localChatMessages);

  usePazMentalStore.setState({
    meditationSessions: meditationSessions.merged,
    moodEntries: moodEntries.merged,
    journalEntries: journalEntries.merged,
    angerEpisodes: angerEpisodes.merged,
    skincareProducts: skincareProducts.merged,
    skincareLogs: skincareLogs.merged,
    chatMessages: [WELCOME_MESSAGE, ...chatMessages.merged],
  });

  // Backfill: sube a Supabase lo que era solo local.
  for (const session of meditationSessions.localOnly) syncInsertMeditationSession(session, userId);
  for (const entry of moodEntries.localOnly) syncReplaceMoodEntryForDate(null, entry, userId);
  for (const entry of journalEntries.localOnly) syncInsertJournalEntry(entry, userId);
  for (const episode of angerEpisodes.localOnly) syncInsertAngerEpisode(episode, userId);
  for (const product of skincareProducts.localOnly) syncInsertSkincareProduct(product, userId);
  for (const log of skincareLogs.localOnly) syncReplaceSkincareLogForDate(null, log, userId);
  for (const message of chatMessages.localOnly) syncInsertChatMessage(message, userId);
}

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
