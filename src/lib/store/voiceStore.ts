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
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertRecording,
  syncDeleteRecording,
  syncUpsertLessonProgress,
  syncUpsertBodyLanguageProgress,
  hydrateVoiceStoreFromSupabase,
  type VoiceHydratedState,
} from "@/lib/sync/voice-sync";

/**
 * Id único usado tanto como key local como primary key de la fila remota
 * en Supabase (`voice_recordings.id` es `uuid` — ver
 * supabase/migrations/0002_module_data_sync.sql). Antes generaba un string
 * base36 corto que NO era un UUID válido (mismo problema que tenía
 * gymStore.ts); se cambió a `crypto.randomUUID()` para que el mismo id
 * sirva en ambos lados sin mantener un mapeo id-local <-> id-remoto.
 */
function uid() {
  return crypto.randomUUID();
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

  // ---------- Remote sync (Supabase) — interno, no UI pública ----------
  /** Reemplaza slices del estado con lo traído de Supabase al loguearse.
   * Ver `hydrateVoiceStoreFromSupabase` (src/lib/sync/voice-sync.ts) y su
   * único llamador en `UserScopeScript`. No se persiste (es una función,
   * zustand `persist` solo serializa datos vía JSON.stringify) ni se
   * expone como API pública del store más allá de este uso interno. */
  _hydrateFromRemote: (patch: Partial<VoiceState>) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set, get) => ({
      // Entrenamiento de voz
      completedLessons: [],
      completeLesson: (lessonId) => {
        let created: VoiceLessonProgress | null = null;
        set((state) => {
          if (state.completedLessons.some((l) => l.lessonId === lessonId)) {
            return state;
          }
          created = { lessonId, date: todayISO() };
          return {
            completedLessons: [...state.completedLessons, created],
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && created) syncUpsertLessonProgress(created, uidUser);
      },
      isLessonCompleted: (lessonId) =>
        get().completedLessons.some((l) => l.lessonId === lessonId),

      recordings: [],
      addRecording: (recording) => {
        const created: Recording = { ...recording, id: uid(), date: todayISO() };
        set((state) => ({
          recordings: [created, ...state.recordings],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertRecording(created, uidUser);
      },
      removeRecording: (id) => {
        set((state) => ({
          recordings: state.recordings.filter((r) => r.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteRecording(id, uidUser);
      },

      // Lenguaje no verbal
      bodyLanguageProgress: [],
      completeBodyLanguageLesson: (lessonId, quizScore, quizTotal) => {
        let created: BodyLanguageProgress | null = null;
        set((state) => {
          const withoutLesson = state.bodyLanguageProgress.filter(
            (p) => p.lessonId !== lessonId,
          );
          created = { lessonId, date: todayISO(), quizScore, quizTotal };
          return {
            bodyLanguageProgress: [...withoutLesson, created],
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser && created) syncUpsertBodyLanguageProgress(created, uidUser);
      },
      isBodyLanguageLessonCompleted: (lessonId) =>
        get().bodyLanguageProgress.some((p) => p.lessonId === lessonId),

      // Oratoria (sin tabla remota en la migración — solo localStorage)
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

      // Remote sync (Supabase)
      _hydrateFromRemote: (patch) => set(patch),
    }),
    {
      name: "vida-total-voz-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-voz-store")),
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — hidratación
// ============================================================================
//
// A diferencia de gymStore.ts, acá no hay "settings" sueltos mutados fuera
// de una acción del store, así que no hace falta la suscripción debounced
// de ese archivo — cada acción que escribe ya llama a su `syncXxx`
// correspondiente arriba, fire-and-forget.

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce — nunca
 * borra datos locales. Ver el comentario largo en gymStore.ts (misma
 * función, mismo motivo: sin esto, el primer login de un usuario con
 * historial previo borraría ese historial al traer un remoto vacío).
 * Devuelve también las filas que eran solo locales, para backfill.
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/** Igual que `mergeById` pero para filas sin `id` propio, cuya identidad es
 * `lessonId` (PK compuesta `(user_id, lesson_id)` en Supabase — ver
 * voice_lesson_progress / body_language_progress). Si una lección está en
 * ambos lados, gana la fila remota (ya sincronizada, autoridad para ese
 * lessonId); las que solo existen local se agregan y se devuelven para
 * backfill. */
function mergeByLessonId<T extends { lessonId: string }>(
  remote: T[],
  local: T[],
): { merged: T[]; localOnly: T[] } {
  const remoteLessonIds = new Set(remote.map((r) => r.lessonId));
  const localOnly = local.filter((l) => !remoteLessonIds.has(l.lessonId));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Trae las 3 tablas de Voz de Supabase para `userId`, las MEZCLA (nunca
 * reemplaza) con lo que ya hay en el store, y sube (backfill) cualquier
 * dato que solo existiera localmente — así un usuario que ya tenía
 * historial en este dispositivo antes de esta capa de sync termina con
 * esos datos también en la nube en su primer login post-sync, en vez de
 * perderlos. Pensado para llamarse UNA vez por sesión de login, apenas se
 * conoce el userId (ver `UserScopeScript`). Tolerante a fallos: si
 * Supabase no responde, cada tabla cae de vuelta a `[]` y el merge deja
 * todo el estado local intacto (mezclar con vacío no quita nada).
 */
export async function hydrateVoiceStore(userId: string): Promise<void> {
  const remote: VoiceHydratedState = await hydrateVoiceStoreFromSupabase(userId);
  const local = useVoiceStore.getState();

  const recordings = mergeById(remote.recordings, local.recordings);
  const completedLessons = mergeByLessonId(remote.completedLessons, local.completedLessons);
  const bodyLanguageProgress = mergeByLessonId(remote.bodyLanguageProgress, local.bodyLanguageProgress);

  const patch: Partial<VoiceState> = {
    recordings: recordings.merged,
    completedLessons: completedLessons.merged,
    bodyLanguageProgress: bodyLanguageProgress.merged,
  };
  useVoiceStore.getState()._hydrateFromRemote(patch);

  // Backfill: sube a Supabase lo que era solo local.
  for (const recording of recordings.localOnly) syncInsertRecording(recording, userId);
  for (const progress of completedLessons.localOnly) syncUpsertLessonProgress(progress, userId);
  for (const progress of bodyLanguageProgress.localOnly) syncUpsertBodyLanguageProgress(progress, userId);
}

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
