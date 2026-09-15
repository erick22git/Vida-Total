/**
 * Capa de sincronización Supabase para el store de Outfit (Armario,
 * Outfits, Plan semanal). Ver `supabase/migrations/0002_module_data_sync.sql`
 * (sección OUTFIT) para el esquema y `src/lib/store/outfitStore.ts` para el
 * store que consume esto.
 *
 * Mismo diseño que `gym-sync.ts` (ver ese archivo para el detalle):
 *  - Todo acá es "fire and forget": el store nunca espera (`await`) estas
 *    funciones antes de aplicar el cambio local. Si Supabase falla o no hay
 *    conexión, se hace `console.warn` y no se lanza ninguna excepción.
 *  - Usa el cliente de navegador (`@/lib/supabase/client`, anon key + RLS).
 *  - No hay tipos `Database` generados en este proyecto, así que cada tabla
 *    tiene su propia interfaz mínima de fila (`XRow`) escrita a mano.
 *  - Nota sobre ids: el generador de ids local (`uid()` en outfitStore.ts)
 *    generaba un string base36 corto que NO es un UUID válido, pero las
 *    columnas `id` de `clothing_items`/`outfits`/`weekly_outfit_plans` son
 *    `uuid`. Se cambió `uid()` para generar `crypto.randomUUID()` (igual que
 *    se hizo para Gym) — así el mismo id sirve como key local y como
 *    primary key remoto.
 *  - `weekly_outfit_plans` tiene `unique(user_id, week_start_date)`: a
 *    diferencia de las otras tablas, no se trata como un merge-por-id
 *    genérico sino como un upsert keyed por `week_start_date` (ver
 *    `syncUpsertWeeklyPlanDay` y el merge en `hydrateOutfitStore`).
 */

import { createClient } from "@/lib/supabase/client";
import type { ClothingItem, Outfit, OutfitOccasion, WeeklyPlan } from "@/lib/types/outfit";

// ============================================================================
// Helpers genéricos (copiados de gym-sync.ts — mismo patrón, sin lugar
// compartido todavía)
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[outfit-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[outfit-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[outfit-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[outfit-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

/** "YYYY-MM-DD" a partir de un Date, usando componentes LOCALES (no UTC). */
function localDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverso de `localDateOnly`, reconstruyendo un Date a medianoche LOCAL. */
function fromDateOnly(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Los campos `date`/`dateAdded`/`lastWorn` del store son ISO date strings
 * ("YYYY-MM-DD", ver `todayISO()` en outfitStore.ts) — ya coinciden con el
 * formato `date` de Postgres, así que estas conversiones son casi triviales,
 * pero se mantienen explícitas por si alguna vez dejan de coincidir. */
function isoDateToDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Ya viene como "YYYY-MM-DD"; se re-normaliza vía Date por si trae hora.
  return localDateOnly(new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso));
}

function dateOnlyToIsoDate(dateOnly: string | null): string | undefined {
  if (!dateOnly) return undefined;
  return localDateOnly(fromDateOnly(dateOnly));
}

// ============================================================================
// clothing_items
// ============================================================================

export interface ClothingItemRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  color: string | null;
  season: ClothingItem["season"];
  image_url: string | null;
  times_worn: number;
  last_worn: string | null;
  cost: number | null;
  date_added: string;
}

function clothingItemToRow(item: ClothingItem, userId: string): ClothingItemRow {
  return {
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    color: item.color ?? null,
    season: item.season,
    image_url: item.imageUrl || null,
    times_worn: item.timesWorn,
    last_worn: isoDateToDateOnly(item.lastWorn ?? null),
    cost: item.cost ?? null,
    date_added: isoDateToDateOnly(item.dateAdded) ?? localDateOnly(new Date()),
  };
}

function rowToClothingItem(row: ClothingItemRow): ClothingItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ClothingItem["category"],
    color: row.color ?? "",
    season: row.season,
    imageUrl: row.image_url ?? "",
    timesWorn: row.times_worn,
    lastWorn: dateOnlyToIsoDate(row.last_worn),
    cost: row.cost ?? undefined,
    dateAdded: dateOnlyToIsoDate(row.date_added) ?? localDateOnly(new Date()),
  };
}

async function fetchClothingItems(userId: string): Promise<ClothingItem[]> {
  const rows = await safeFetchList<ClothingItemRow>("clothing_items", () =>
    createClient().from("clothing_items").select("*").eq("user_id", userId),
  );
  return rows.map(rowToClothingItem);
}

export function syncInsertClothingItem(item: ClothingItem, userId: string): void {
  void safeWrite("insert clothing_items", () =>
    createClient().from("clothing_items").insert(clothingItemToRow(item, userId)),
  );
}

export function syncUpdateClothingItem(id: string, patch: Partial<ClothingItem>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.season !== undefined) row.season = patch.season;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl || null;
  if (patch.timesWorn !== undefined) row.times_worn = patch.timesWorn;
  if (patch.lastWorn !== undefined) row.last_worn = isoDateToDateOnly(patch.lastWorn);
  if (patch.cost !== undefined) row.cost = patch.cost;
  if (patch.dateAdded !== undefined) row.date_added = isoDateToDateOnly(patch.dateAdded);
  if (Object.keys(row).length === 0) return;
  void safeWrite("update clothing_items", () =>
    createClient().from("clothing_items").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteClothingItem(id: string, userId: string): void {
  void safeWrite("delete clothing_items", () =>
    createClient().from("clothing_items").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// outfits
// ============================================================================

export interface OutfitRow {
  id: string;
  user_id: string;
  name: string;
  item_ids: string[];
  occasion: OutfitOccasion;
  created_at: string;
}

function outfitToRow(o: Outfit, userId: string): OutfitRow {
  return {
    id: o.id,
    user_id: userId,
    name: o.name,
    item_ids: o.itemIds,
    occasion: o.occasion,
    created_at: o.createdAt || new Date().toISOString(),
  };
}

function rowToOutfit(row: OutfitRow): Outfit {
  return {
    id: row.id,
    name: row.name,
    itemIds: row.item_ids ?? [],
    occasion: row.occasion,
    createdAt: row.created_at,
  };
}

async function fetchOutfits(userId: string): Promise<Outfit[]> {
  const rows = await safeFetchList<OutfitRow>("outfits", () =>
    createClient().from("outfits").select("*").eq("user_id", userId),
  );
  return rows.map(rowToOutfit);
}

export function syncInsertOutfit(outfit: Outfit, userId: string): void {
  void safeWrite("insert outfits", () => createClient().from("outfits").insert(outfitToRow(outfit, userId)));
}

export function syncUpdateOutfit(id: string, patch: Partial<Outfit>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.itemIds !== undefined) row.item_ids = patch.itemIds;
  if (patch.occasion !== undefined) row.occasion = patch.occasion;
  if (patch.createdAt !== undefined) row.created_at = patch.createdAt;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update outfits", () =>
    createClient().from("outfits").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteOutfit(id: string, userId: string): void {
  void safeWrite("delete outfits", () =>
    createClient().from("outfits").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// weekly_outfit_plans (unique(user_id, week_start_date) — upsert por
// week_start_date, NO por id; el `id` de la fila remota es propio de
// Supabase y puede no coincidir con el `id` local generado por el store)
// ============================================================================

export interface WeeklyOutfitPlanRow {
  id: string;
  user_id: string;
  week_start_date: string;
  day_outfits: Record<number, string>;
}

async function fetchWeeklyPlans(userId: string): Promise<WeeklyPlan[]> {
  const rows = await safeFetchList<WeeklyOutfitPlanRow>("weekly_outfit_plans", () =>
    createClient().from("weekly_outfit_plans").select("*").eq("user_id", userId),
  );
  return rows.map((row) => ({
    id: row.id,
    weekStartDate: row.week_start_date,
    dayOutfits: row.day_outfits ?? {},
  }));
}

/** Sube (upsert) el estado completo de `dayOutfits` para una semana dada.
 * Se llama con el objeto ya actualizado (el store calcula el nuevo
 * `dayOutfits` y lo pasa completo) para no depender de un merge remoto de
 * jsonb parcial. Conflict target: `user_id,week_start_date` — coincide con
 * el `unique` de la tabla. */
export function syncUpsertWeeklyPlan(
  weekStartDate: string,
  dayOutfits: Record<number, string>,
  userId: string,
): void {
  void safeWrite("upsert weekly_outfit_plans", () =>
    createClient()
      .from("weekly_outfit_plans")
      .upsert(
        { user_id: userId, week_start_date: weekStartDate, day_outfits: dayOutfits },
        { onConflict: "user_id,week_start_date" },
      ),
  );
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface OutfitHydratedState {
  clothingItems: ClothingItem[];
  outfits: Outfit[];
  weeklyPlans: WeeklyPlan[];
}

/**
 * Trae las 3 tablas de Outfit para `userId` y devuelve un objeto listo para
 * mezclar (merge) en el estado del store. No escribe nada — el store decide
 * cómo aplicar el patch (ver `hydrateOutfitStore` en outfitStore.ts).
 *
 * Cada tabla se trae de forma independiente y tolerante a fallos; si TODO
 * falla (sin conexión), devuelve arrays vacíos y el store no sobreescribe
 * nada relevante más allá de lo que ya trae `persist` de localStorage.
 */
export async function hydrateOutfitStoreFromSupabase(userId: string): Promise<OutfitHydratedState> {
  const [clothingItems, outfits, weeklyPlans] = await Promise.all([
    fetchClothingItems(userId),
    fetchOutfits(userId),
    fetchWeeklyPlans(userId),
  ]);
  return { clothingItems, outfits, weeklyPlans };
}
