/**
 * Capa de sincronización Supabase para el store de Paz Mental (Meditación,
 * Humor, Diario, Ira, Piel, Asistente IA). Ver
 * `supabase/migrations/0002_module_data_sync.sql` (sección "PAZ MENTAL")
 * para el esquema y `src/lib/store/pazMentalStore.ts` para el store que
 * consume esto. Mismo patrón que `src/lib/sync/gym-sync.ts` — leer ese
 * archivo primero si algo acá no queda claro.
 *
 * Diseño (igual que gym-sync.ts):
 *  - Todo acá es "fire and forget": estas funciones devuelven promesas que
 *    el store NUNCA espera (`await`) antes de aplicar el cambio local — la
 *    UI sigue siendo instantánea. Si Supabase falla o no hay conexión, se
 *    hace `console.warn` y no se lanza ninguna excepción: localStorage (vía
 *    `persist`) sigue siendo la fuente de verdad de este dispositivo hasta
 *    el próximo sync exitoso.
 *  - Usa el cliente de navegador (`@/lib/supabase/client`, anon key + RLS).
 *  - Cada tabla tiene su propia interfaz mínima de fila (`XRow`) escrita a
 *    mano, igual que gym-sync.ts (no hay tipos `Database` generados).
 *  - Nota sobre ids: `uid()` en pazMentalStore.ts generaba un string
 *    base36 corto que NO era un UUID válido, pero las columnas `id` de
 *    estas tablas son `uuid`. Se cambió `uid()` para generar
 *    `crypto.randomUUID()` (ver pazMentalStore.ts) — así el mismo id sirve
 *    como key local y como primary key remoto. La única excepción es el
 *    mensaje de bienvenida estático del chat (id fijo `"m-welcome"`, no es
 *    un UUID) — nunca se sincroniza, ver `hydratePazMentalStore` en
 *    pazMentalStore.ts.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  AngerEpisode,
  ChatMessage,
  JournalEntry,
  MeditationSession,
  MoodEntry,
  SkincareLog,
  SkincareProduct,
} from "@/lib/types/paz-mental";

// ============================================================================
// Helpers genéricos (idénticos a gym-sync.ts)
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[paz-mental-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[paz-mental-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[paz-mental-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[paz-mental-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

// ============================================================================
// meditation_sessions
// ============================================================================

interface MeditationSessionRow {
  id: string;
  user_id: string;
  session_type: MeditationSession["type"];
  duration: number;
  session_date: string;
  sounds_used: string[];
}

function meditationSessionToRow(s: MeditationSession, userId: string): MeditationSessionRow {
  return {
    id: s.id,
    user_id: userId,
    session_type: s.type,
    duration: s.duration,
    session_date: s.date,
    sounds_used: s.soundsUsed ?? [],
  };
}

function rowToMeditationSession(row: MeditationSessionRow): MeditationSession {
  return {
    id: row.id,
    type: row.session_type,
    duration: row.duration,
    date: row.session_date,
    soundsUsed: row.sounds_used ?? [],
  };
}

async function fetchMeditationSessions(userId: string): Promise<MeditationSession[]> {
  const rows = await safeFetchList<MeditationSessionRow>("meditation_sessions", () =>
    createClient().from("meditation_sessions").select("*").eq("user_id", userId),
  );
  return rows.map(rowToMeditationSession);
}

export function syncInsertMeditationSession(session: MeditationSession, userId: string): void {
  void safeWrite("insert meditation_sessions", () =>
    createClient().from("meditation_sessions").insert(meditationSessionToRow(session, userId)),
  );
}

// ============================================================================
// mood_entries (una fila "vigente" por día — ver nota en pazMentalStore.ts)
// ============================================================================

interface MoodEntryRow {
  id: string;
  user_id: string;
  entry_date: string;
  level: number;
  emoji: string | null;
  note: string | null;
  gratitude_items: string[];
}

function moodEntryToRow(m: MoodEntry, userId: string): MoodEntryRow {
  return {
    id: m.id,
    user_id: userId,
    entry_date: m.date,
    level: m.level,
    emoji: m.emoji ?? null,
    note: m.note ?? null,
    gratitude_items: m.gratitudeItems ?? [],
  };
}

function rowToMoodEntry(row: MoodEntryRow): MoodEntry {
  return {
    id: row.id,
    date: row.entry_date,
    level: row.level as MoodEntry["level"],
    emoji: row.emoji ?? "",
    note: row.note ?? undefined,
    gratitudeItems: row.gratitude_items ?? [],
  };
}

async function fetchMoodEntries(userId: string): Promise<MoodEntry[]> {
  const rows = await safeFetchList<MoodEntryRow>("mood_entries", () =>
    createClient().from("mood_entries").select("*").eq("user_id", userId),
  );
  return rows.map(rowToMoodEntry);
}

/** El store reemplaza la entrada de humor del día (borra la vieja del
 * estado local y crea una con id nuevo) en vez de actualizarla in-place —
 * ver `addMoodEntry` en pazMentalStore.ts. Para reflejar eso en Supabase
 * sin depender de una constraint UNIQUE(user_id, entry_date) que no existe
 * en la migración, se borra la fila anterior (si había) y se inserta la
 * nueva, en orden (por eso es una función async en vez de dos llamadas
 * `syncXxx` sueltas — evita una carrera donde el insert le gana al delete). */
export function syncReplaceMoodEntryForDate(
  oldId: string | null,
  entry: MoodEntry,
  userId: string,
): void {
  void (async () => {
    if (oldId) {
      await safeWrite("delete mood_entries", () =>
        createClient().from("mood_entries").delete().eq("id", oldId).eq("user_id", userId),
      );
    }
    await safeWrite("insert mood_entries", () =>
      createClient().from("mood_entries").insert(moodEntryToRow(entry, userId)),
    );
  })();
}

// ============================================================================
// journal_entries
// ============================================================================

interface JournalEntryRow {
  id: string;
  user_id: string;
  entry_date: string;
  title: string;
  content: string;
  mood: number | null;
  tags: string[];
}

function journalEntryToRow(j: JournalEntry, userId: string): JournalEntryRow {
  return {
    id: j.id,
    user_id: userId,
    entry_date: j.date,
    title: j.title,
    content: j.content,
    mood: j.mood ?? null,
    tags: j.tags ?? [],
  };
}

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    date: row.entry_date,
    title: row.title,
    content: row.content,
    mood: (row.mood as JournalEntry["mood"]) ?? undefined,
    tags: row.tags ?? [],
  };
}

async function fetchJournalEntries(userId: string): Promise<JournalEntry[]> {
  const rows = await safeFetchList<JournalEntryRow>("journal_entries", () =>
    createClient().from("journal_entries").select("*").eq("user_id", userId),
  );
  return rows.map(rowToJournalEntry);
}

export function syncInsertJournalEntry(entry: JournalEntry, userId: string): void {
  void safeWrite("insert journal_entries", () =>
    createClient().from("journal_entries").insert(journalEntryToRow(entry, userId)),
  );
}

export function syncDeleteJournalEntry(id: string, userId: string): void {
  void safeWrite("delete journal_entries", () =>
    createClient().from("journal_entries").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// anger_episodes
// ============================================================================

interface AngerEpisodeRow {
  id: string;
  user_id: string;
  entry_date: string;
  trigger: string | null;
  intensity: number | null;
  technique: string | null;
  outcome: string | null;
}

function angerEpisodeToRow(a: AngerEpisode, userId: string): AngerEpisodeRow {
  return {
    id: a.id,
    user_id: userId,
    entry_date: a.date,
    trigger: a.trigger ?? null,
    intensity: a.intensity ?? null,
    technique: a.technique ?? null,
    outcome: a.outcome ?? null,
  };
}

function rowToAngerEpisode(row: AngerEpisodeRow): AngerEpisode {
  return {
    id: row.id,
    date: row.entry_date,
    trigger: row.trigger ?? "",
    intensity: row.intensity ?? 0,
    technique: row.technique ?? "",
    outcome: row.outcome ?? undefined,
  };
}

async function fetchAngerEpisodes(userId: string): Promise<AngerEpisode[]> {
  const rows = await safeFetchList<AngerEpisodeRow>("anger_episodes", () =>
    createClient().from("anger_episodes").select("*").eq("user_id", userId),
  );
  return rows.map(rowToAngerEpisode);
}

export function syncInsertAngerEpisode(episode: AngerEpisode, userId: string): void {
  void safeWrite("insert anger_episodes", () =>
    createClient().from("anger_episodes").insert(angerEpisodeToRow(episode, userId)),
  );
}

// ============================================================================
// skincare_products
// ============================================================================

interface SkincareProductRow {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  condition: SkincareProduct["condition"];
  is_active: boolean;
  effectiveness: number | null;
}

function skincareProductToRow(p: SkincareProduct, userId: string): SkincareProductRow {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    brand: p.brand ?? null,
    product_type: p.type ?? null,
    condition: p.condition,
    is_active: p.isActive,
    effectiveness: p.effectiveness ?? null,
  };
}

function rowToSkincareProduct(row: SkincareProductRow): SkincareProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    type: row.product_type ?? "",
    condition: row.condition,
    isActive: row.is_active,
    effectiveness: (row.effectiveness as SkincareProduct["effectiveness"]) ?? 3,
  };
}

async function fetchSkincareProducts(userId: string): Promise<SkincareProduct[]> {
  const rows = await safeFetchList<SkincareProductRow>("skincare_products", () =>
    createClient().from("skincare_products").select("*").eq("user_id", userId),
  );
  return rows.map(rowToSkincareProduct);
}

export function syncInsertSkincareProduct(product: SkincareProduct, userId: string): void {
  void safeWrite("insert skincare_products", () =>
    createClient().from("skincare_products").insert(skincareProductToRow(product, userId)),
  );
}

export function syncDeleteSkincareProduct(id: string, userId: string): void {
  void safeWrite("delete skincare_products", () =>
    createClient().from("skincare_products").delete().eq("id", id).eq("user_id", userId),
  );
}

export function syncUpdateSkincareProduct(
  id: string,
  patch: Partial<SkincareProduct>,
  userId: string,
): void {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.type !== undefined) row.product_type = patch.type;
  if (patch.condition !== undefined) row.condition = patch.condition;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.effectiveness !== undefined) row.effectiveness = patch.effectiveness;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update skincare_products", () =>
    createClient().from("skincare_products").update(row).eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// skincare_logs (una fila "vigente" por día, igual que mood_entries)
// ============================================================================

interface SkincareLogRow {
  id: string;
  user_id: string;
  entry_date: string;
  product_ids: string[];
  skin_condition: number | null;
  notes: string | null;
}

function skincareLogToRow(l: SkincareLog, userId: string): SkincareLogRow {
  return {
    id: l.id,
    user_id: userId,
    entry_date: l.date,
    product_ids: l.productIds ?? [],
    skin_condition: l.skinCondition ?? null,
    notes: l.notes ?? null,
  };
}

function rowToSkincareLog(row: SkincareLogRow): SkincareLog {
  return {
    id: row.id,
    date: row.entry_date,
    productIds: row.product_ids ?? [],
    skinCondition: (row.skin_condition as SkincareLog["skinCondition"]) ?? 3,
    notes: row.notes ?? undefined,
  };
}

async function fetchSkincareLogs(userId: string): Promise<SkincareLog[]> {
  const rows = await safeFetchList<SkincareLogRow>("skincare_logs", () =>
    createClient().from("skincare_logs").select("*").eq("user_id", userId),
  );
  return rows.map(rowToSkincareLog);
}

/** Igual patrón que `syncReplaceMoodEntryForDate` — un log de piel por día,
 * el store reemplaza el del día actual con uno de id nuevo. */
export function syncReplaceSkincareLogForDate(
  oldId: string | null,
  log: SkincareLog,
  userId: string,
): void {
  void (async () => {
    if (oldId) {
      await safeWrite("delete skincare_logs", () =>
        createClient().from("skincare_logs").delete().eq("id", oldId).eq("user_id", userId),
      );
    }
    await safeWrite("insert skincare_logs", () =>
      createClient().from("skincare_logs").insert(skincareLogToRow(log, userId)),
    );
  })();
}

// ============================================================================
// assistant_chat_messages
// ============================================================================

interface AssistantChatMessageRow {
  id: string;
  user_id: string;
  role: ChatMessage["role"];
  content: string;
  sent_at: string;
  suggested_href: string | null;
  suggested_label: string | null;
}

function chatMessageToRow(m: ChatMessage, userId: string): AssistantChatMessageRow {
  return {
    id: m.id,
    user_id: userId,
    role: m.role,
    content: m.content,
    sent_at: new Date(m.timestamp).toISOString(),
    suggested_href: m.suggestedHref ?? null,
    suggested_label: m.suggestedLabel ?? null,
  };
}

function rowToChatMessage(row: AssistantChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.sent_at).getTime(),
    suggestedHref: row.suggested_href ?? undefined,
    suggestedLabel: row.suggested_label ?? undefined,
  };
}

async function fetchChatMessages(userId: string): Promise<ChatMessage[]> {
  const rows = await safeFetchList<AssistantChatMessageRow>("assistant_chat_messages", () =>
    createClient()
      .from("assistant_chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("sent_at", { ascending: true }),
  );
  return rows.map(rowToChatMessage);
}

/** Fire-and-forget, un insert por mensaje. El historial de chat puede
 * crecer con el tiempo — paginación/poda de esta tabla queda fuera de
 * alcance de este cambio, ver comentario en pazMentalStore.ts. */
export function syncInsertChatMessage(message: ChatMessage, userId: string): void {
  void safeWrite("insert assistant_chat_messages", () =>
    createClient().from("assistant_chat_messages").insert(chatMessageToRow(message, userId)),
  );
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface PazMentalHydratedState {
  meditationSessions: MeditationSession[];
  moodEntries: MoodEntry[];
  journalEntries: JournalEntry[];
  angerEpisodes: AngerEpisode[];
  skincareProducts: SkincareProduct[];
  skincareLogs: SkincareLog[];
  chatMessages: ChatMessage[];
}

/**
 * Trae las 7 tablas de Paz Mental para `userId` y devuelve un objeto listo
 * para mezclar (merge) en el estado del store. No escribe nada — el store
 * decide cómo aplicar el patch (ver `hydratePazMentalStore` en
 * pazMentalStore.ts). Cada tabla se trae de forma independiente y tolerante
 * a fallos, igual que `hydrateGymStoreFromSupabase`.
 */
export async function hydratePazMentalStoreFromSupabase(
  userId: string,
): Promise<PazMentalHydratedState> {
  const [
    meditationSessions,
    moodEntries,
    journalEntries,
    angerEpisodes,
    skincareProducts,
    skincareLogs,
    chatMessages,
  ] = await Promise.all([
    fetchMeditationSessions(userId),
    fetchMoodEntries(userId),
    fetchJournalEntries(userId),
    fetchAngerEpisodes(userId),
    fetchSkincareProducts(userId),
    fetchSkincareLogs(userId),
    fetchChatMessages(userId),
  ]);

  return {
    meditationSessions,
    moodEntries,
    journalEntries,
    angerEpisodes,
    skincareProducts,
    skincareLogs,
    chatMessages,
  };
}
