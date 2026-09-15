/**
 * Capa de sincronización Supabase para el store de Voz & Comunicación
 * (Entrenamiento de voz, Lenguaje no verbal). Ver
 * `supabase/migrations/0002_module_data_sync.sql` (sección VOZ &
 * COMUNICACIÓN) para el esquema y `src/lib/store/voiceStore.ts` para el
 * store que consume esto. Mismo patrón que `src/lib/sync/gym-sync.ts` —
 * leer ese archivo primero si algo acá no queda claro.
 *
 * Diseño (idéntico a gym-sync.ts):
 *  - Todo acá es "fire and forget": estas funciones devuelven promesas que
 *    el store NUNCA espera (`await`) antes de aplicar el cambio local — la
 *    UI sigue siendo instantánea. Si Supabase falla o no hay conexión, se
 *    hace `console.warn` y no se lanza ninguna excepción: el localStorage
 *    (vía `persist`, sin cambios) sigue siendo la fuente de verdad de este
 *    dispositivo hasta el próximo sync exitoso.
 *  - Usa el cliente de navegador (`@/lib/supabase/client`, anon key + RLS).
 *  - No hay tipos `Database` generados en este proyecto, así que cada tabla
 *    tiene su propia interfaz mínima de fila (`XRow`) escrita a mano.
 *  - Nota sobre ids: `voice_recordings.id` es `uuid`, así que el id
 *    generado en el cliente para `Recording` debe ser un UUID válido (ver
 *    `uid()` en voiceStore.ts, cambiado a `crypto.randomUUID()`). Las
 *    tablas `voice_lesson_progress` y `body_language_progress` NO tienen
 *    columna `id` propia — su primary key es compuesta `(user_id,
 *    lesson_id)`, así que se sincronizan por upsert usando `lessonId`, no
 *    por id genérico.
 *  - `practiceDays`/`breathingSessionsCompleted` (Oratoria) no tienen tabla
 *    en la migración — solo quedan en localStorage, igual que hoy.
 */

import { createClient } from "@/lib/supabase/client";
import type { Recording, VoiceLessonProgress, BodyLanguageProgress } from "@/lib/types/voice";

// ============================================================================
// Helpers genéricos (idénticos a gym-sync.ts)
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[voice-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[voice-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[voice-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[voice-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

// ============================================================================
// voice_recordings
// ============================================================================

interface VoiceRecordingRow {
  id: string;
  user_id: string;
  lesson_id: string | null;
  entry_date: string;
  duration_sec: number;
  note: string | null;
}

function recordingToRow(r: Recording, userId: string): VoiceRecordingRow {
  return {
    id: r.id,
    user_id: userId,
    lesson_id: r.lessonId ?? null,
    entry_date: r.date,
    duration_sec: r.durationSec,
    note: r.note ?? null,
  };
}

function rowToRecording(row: VoiceRecordingRow): Recording {
  return {
    id: row.id,
    lessonId: row.lesson_id ?? undefined,
    date: row.entry_date,
    durationSec: row.duration_sec,
    note: row.note ?? undefined,
  };
}

async function fetchRecordings(userId: string): Promise<Recording[]> {
  const rows = await safeFetchList<VoiceRecordingRow>("voice_recordings", () =>
    createClient().from("voice_recordings").select("*").eq("user_id", userId),
  );
  return rows.map(rowToRecording);
}

export function syncInsertRecording(recording: Recording, userId: string): void {
  void safeWrite("insert voice_recordings", () =>
    createClient().from("voice_recordings").insert(recordingToRow(recording, userId)),
  );
}

export function syncDeleteRecording(id: string, userId: string): void {
  void safeWrite("delete voice_recordings", () =>
    createClient().from("voice_recordings").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// voice_lesson_progress (PK compuesta user_id + lesson_id, sin columna id)
// ============================================================================

interface VoiceLessonProgressRow {
  user_id: string;
  lesson_id: string;
  entry_date: string;
}

function lessonProgressToRow(p: VoiceLessonProgress, userId: string): VoiceLessonProgressRow {
  return {
    user_id: userId,
    lesson_id: p.lessonId,
    entry_date: p.date,
  };
}

function rowToLessonProgress(row: VoiceLessonProgressRow): VoiceLessonProgress {
  return {
    lessonId: row.lesson_id,
    date: row.entry_date,
  };
}

async function fetchLessonProgress(userId: string): Promise<VoiceLessonProgress[]> {
  const rows = await safeFetchList<VoiceLessonProgressRow>("voice_lesson_progress", () =>
    createClient().from("voice_lesson_progress").select("*").eq("user_id", userId),
  );
  return rows.map(rowToLessonProgress);
}

export function syncUpsertLessonProgress(progress: VoiceLessonProgress, userId: string): void {
  void safeWrite("upsert voice_lesson_progress", () =>
    createClient()
      .from("voice_lesson_progress")
      .upsert(lessonProgressToRow(progress, userId), { onConflict: "user_id,lesson_id" }),
  );
}

// ============================================================================
// body_language_progress (PK compuesta user_id + lesson_id, sin columna id)
// ============================================================================

interface BodyLanguageProgressRow {
  user_id: string;
  lesson_id: string;
  entry_date: string;
  quiz_score: number | null;
  quiz_total: number | null;
}

function bodyLanguageProgressToRow(p: BodyLanguageProgress, userId: string): BodyLanguageProgressRow {
  return {
    user_id: userId,
    lesson_id: p.lessonId,
    entry_date: p.date,
    quiz_score: p.quizScore ?? null,
    quiz_total: p.quizTotal ?? null,
  };
}

function rowToBodyLanguageProgress(row: BodyLanguageProgressRow): BodyLanguageProgress {
  return {
    lessonId: row.lesson_id,
    date: row.entry_date,
    quizScore: row.quiz_score ?? undefined,
    quizTotal: row.quiz_total ?? undefined,
  };
}

async function fetchBodyLanguageProgress(userId: string): Promise<BodyLanguageProgress[]> {
  const rows = await safeFetchList<BodyLanguageProgressRow>("body_language_progress", () =>
    createClient().from("body_language_progress").select("*").eq("user_id", userId),
  );
  return rows.map(rowToBodyLanguageProgress);
}

export function syncUpsertBodyLanguageProgress(progress: BodyLanguageProgress, userId: string): void {
  void safeWrite("upsert body_language_progress", () =>
    createClient()
      .from("body_language_progress")
      .upsert(bodyLanguageProgressToRow(progress, userId), { onConflict: "user_id,lesson_id" }),
  );
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface VoiceHydratedState {
  recordings: Recording[];
  completedLessons: VoiceLessonProgress[];
  bodyLanguageProgress: BodyLanguageProgress[];
}

/**
 * Trae las 3 tablas de Voz para `userId` y devuelve un objeto listo para
 * mezclar (merge) en el estado del store. No escribe nada — el store decide
 * cómo aplicar el patch (ver `_hydrateFromRemote` en voiceStore.ts).
 *
 * Cada tabla se trae de forma independiente y tolerante a fallos; si TODO
 * falla (sin conexión), devuelve arrays vacíos y el store simplemente no
 * sobreescribe nada relevante más allá de lo que ya trae `persist` de
 * localStorage.
 */
export async function hydrateVoiceStoreFromSupabase(userId: string): Promise<VoiceHydratedState> {
  const [recordings, completedLessons, bodyLanguageProgress] = await Promise.all([
    fetchRecordings(userId),
    fetchLessonProgress(userId),
    fetchBodyLanguageProgress(userId),
  ]);

  return { recordings, completedLessons, bodyLanguageProgress };
}
