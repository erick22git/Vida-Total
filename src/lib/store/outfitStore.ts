import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import type { ClothingItem, Outfit, OutfitOccasion, WeeklyPlan } from "@/lib/types/outfit";
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertClothingItem,
  syncUpdateClothingItem,
  syncDeleteClothingItem,
  syncInsertOutfit,
  syncUpdateOutfit,
  syncDeleteOutfit,
  syncUpsertWeeklyPlan,
  hydrateOutfitStoreFromSupabase,
  type OutfitHydratedState,
} from "@/lib/sync/outfit-sync";

/**
 * Id único usado tanto como key local (React, lookups en el store) como
 * primary key de la fila remota en Supabase (columnas `uuid` — ver
 * supabase/migrations/0002_module_data_sync.sql). Antes generaba un string
 * base36 corto que NO era un UUID válido; se cambió a `crypto.randomUUID()`
 * (mismo cambio hecho para Gym, ver gymStore.ts) para que el mismo id sirva
 * en ambos lados sin mantener un mapeo id-local <-> id-remoto.
 */
function uid() {
  return crypto.randomUUID();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Lunes (día 1) de la semana que contiene `date`, como ISO date string. */
export function startOfWeekISO(date: Date = new Date()): string {
  const d = new Date(date);
  const jsDay = d.getDay(); // 0 = domingo
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** Día ISO de la semana actual (1 = lunes ... 7 = domingo). */
export function todayWeekdayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

interface OutfitState {
  // ---------- Armario ----------
  clothingItems: ClothingItem[];
  addClothingItem: (
    item: Omit<ClothingItem, "id" | "timesWorn" | "dateAdded"> & { dateAdded?: string },
  ) => string;
  updateClothingItem: (id: string, patch: Partial<ClothingItem>) => void;
  deleteClothingItem: (id: string) => void;
  registerWorn: (id: string) => void;

  // ---------- Outfits ----------
  outfits: Outfit[];
  addOutfit: (outfit: { name: string; itemIds: string[]; occasion: OutfitOccasion }) => string;
  updateOutfit: (id: string, patch: Partial<Outfit>) => void;
  deleteOutfit: (id: string) => void;

  // ---------- Plan semanal ----------
  weeklyPlans: WeeklyPlan[];
  getWeeklyPlan: (weekStartDate: string) => WeeklyPlan | undefined;
  setWeeklyPlanDay: (weekStartDate: string, day: number, outfitId: string) => void;
  clearWeeklyPlanDay: (weekStartDate: string, day: number) => void;

  // ---------- Remote sync (Supabase) — interno, no UI pública ----------
  /** Reemplaza slices del estado con lo traído de Supabase al loguearse.
   * Ver `hydrateOutfitStoreFromSupabase` (src/lib/sync/outfit-sync.ts) y su
   * único llamador en `UserScopeScript`. No se persiste (es una función,
   * zustand `persist` solo serializa datos vía JSON.stringify) ni se
   * expone como API pública del store más allá de este uso interno. */
  _hydrateFromRemote: (patch: Partial<OutfitState>) => void;
}

export const useOutfitStore = create<OutfitState>()(
  persist(
    (set, get) => ({
      // Armario
      clothingItems: [],
      addClothingItem: (item) => {
        const id = uid();
        const created: ClothingItem = {
          id,
          name: item.name,
          category: item.category,
          color: item.color,
          season: item.season,
          imageUrl: item.imageUrl ?? "",
          timesWorn: 0,
          cost: item.cost,
          dateAdded: item.dateAdded ?? todayISO(),
        };
        set((state) => ({
          clothingItems: [...state.clothingItems, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertClothingItem(created, uidUser);
        return id;
      },
      updateClothingItem: (id, patch) => {
        set((state) => ({
          clothingItems: state.clothingItems.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateClothingItem(id, patch, uidUser);
      },
      deleteClothingItem: (id) => {
        set((state) => ({
          clothingItems: state.clothingItems.filter((c) => c.id !== id),
          outfits: state.outfits.map((o) => ({
            ...o,
            itemIds: o.itemIds.filter((iid) => iid !== id),
          })),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteClothingItem(id, uidUser);
      },
      registerWorn: (id) => {
        let patch: Partial<ClothingItem> | null = null;
        set((state) => ({
          clothingItems: state.clothingItems.map((c) => {
            if (c.id !== id) return c;
            patch = { timesWorn: c.timesWorn + 1, lastWorn: todayISO() };
            return { ...c, ...patch };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && patch) syncUpdateClothingItem(id, patch, uidUser);
      },

      // Outfits
      outfits: [],
      addOutfit: (outfit) => {
        const id = uid();
        const created: Outfit = {
          id,
          name: outfit.name,
          itemIds: outfit.itemIds,
          occasion: outfit.occasion,
          createdAt: new Date().toISOString(),
        };
        const wornPatches: { id: string; patch: Partial<ClothingItem> }[] = [];
        set((state) => ({
          outfits: [...state.outfits, created],
          clothingItems: state.clothingItems.map((c) => {
            if (!outfit.itemIds.includes(c.id)) return c;
            const patch: Partial<ClothingItem> = { timesWorn: c.timesWorn + 1, lastWorn: todayISO() };
            wornPatches.push({ id: c.id, patch });
            return { ...c, ...patch };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncInsertOutfit(created, uidUser);
          for (const { id: itemId, patch } of wornPatches) syncUpdateClothingItem(itemId, patch, uidUser);
        }
        return id;
      },
      updateOutfit: (id, patch) => {
        set((state) => ({
          outfits: state.outfits.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateOutfit(id, patch, uidUser);
      },
      deleteOutfit: (id) => {
        const affectedWeeks: { weekStartDate: string; dayOutfits: Record<number, string> }[] = [];
        set((state) => ({
          outfits: state.outfits.filter((o) => o.id !== id),
          weeklyPlans: state.weeklyPlans.map((p) => {
            const dayOutfits = { ...p.dayOutfits };
            let changed = false;
            for (const day of Object.keys(dayOutfits)) {
              if (dayOutfits[Number(day)] === id) {
                delete dayOutfits[Number(day)];
                changed = true;
              }
            }
            if (changed) affectedWeeks.push({ weekStartDate: p.weekStartDate, dayOutfits });
            return { ...p, dayOutfits };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) {
          syncDeleteOutfit(id, uidUser);
          for (const week of affectedWeeks) syncUpsertWeeklyPlan(week.weekStartDate, week.dayOutfits, uidUser);
        }
      },

      // Plan semanal
      weeklyPlans: [],
      getWeeklyPlan: (weekStartDate) =>
        get().weeklyPlans.find((p) => p.weekStartDate === weekStartDate),
      setWeeklyPlanDay: (weekStartDate, day, outfitId) => {
        let nextDayOutfits: Record<number, string> = {};
        set((state) => {
          const existing = state.weeklyPlans.find((p) => p.weekStartDate === weekStartDate);
          if (existing) {
            nextDayOutfits = { ...existing.dayOutfits, [day]: outfitId };
            return {
              weeklyPlans: state.weeklyPlans.map((p) =>
                p.weekStartDate === weekStartDate ? { ...p, dayOutfits: nextDayOutfits } : p,
              ),
            };
          }
          nextDayOutfits = { [day]: outfitId };
          return {
            weeklyPlans: [
              ...state.weeklyPlans,
              { id: uid(), weekStartDate, dayOutfits: nextDayOutfits },
            ],
          };
        });
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpsertWeeklyPlan(weekStartDate, nextDayOutfits, uidUser);
      },
      clearWeeklyPlanDay: (weekStartDate, day) => {
        let nextDayOutfits: Record<number, string> | null = null;
        set((state) => ({
          weeklyPlans: state.weeklyPlans.map((p) => {
            if (p.weekStartDate !== weekStartDate) return p;
            const dayOutfits = { ...p.dayOutfits };
            delete dayOutfits[day];
            nextDayOutfits = dayOutfits;
            return { ...p, dayOutfits };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextDayOutfits) syncUpsertWeeklyPlan(weekStartDate, nextDayOutfits, uidUser);
      },

      // Remote sync (Supabase)
      _hydrateFromRemote: (patch) => set(patch),
    }),
    {
      name: "vida-total-outfit-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-outfit-store")),
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — hidratación
// ============================================================================

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce — nunca
 * borra datos locales. Fundamental para la primera sincronización de un
 * usuario que ya venía usando Outfit antes de que existiera esta capa: en
 * ese caso las tablas de Supabase están vacías y un merge ingenuo tipo "el
 * remoto manda" reemplazaría el armario completo por un array vacío en el
 * primer login. Devuelve también las filas que eran solo locales, para que
 * el llamador las suba a Supabase (backfill). Copiado de `mergeById` en
 * gymStore.ts — mismo patrón, sin lugar compartido todavía.
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Igual que `mergeById` pero para `weeklyPlans`, que en Supabase se
 * identifican por `(user_id, week_start_date)` y no por `id` (la fila
 * remota tiene su propio `id` generado por Supabase, que puede no coincidir
 * con el `id` local generado por el store). Un plan local que ya tiene
 * homólogo remoto se descarta a favor del remoto (evita pisarlo con un
 * upsert keyed por semana en el backfill); uno que no tiene homólogo se
 * conserva y se sube.
 */
function mergeWeeklyPlansByWeek(
  remote: WeeklyPlan[],
  local: WeeklyPlan[],
): { merged: WeeklyPlan[]; localOnly: WeeklyPlan[] } {
  const remoteWeeks = new Set(remote.map((p) => p.weekStartDate));
  const localOnly = local.filter((p) => !remoteWeeks.has(p.weekStartDate));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Trae las 3 tablas de Outfit de Supabase para `userId`, las MEZCLA (nunca
 * reemplaza) con lo que ya hay en el store, y sube (backfill) cualquier
 * dato que solo existiera localmente — así un usuario que ya tenía armario
 * previo a esta capa de sync termina con esos datos también en la nube en
 * su primer login post-sync, en vez de perderlos. Pensado para llamarse UNA
 * vez por sesión de login, apenas se conoce el userId (ver
 * `UserScopeScript`). Tolerante a fallos: si Supabase no responde, cada
 * tabla cae de vuelta a `[]` y el merge deja todo el estado local intacto.
 */
export async function hydrateOutfitStore(userId: string): Promise<void> {
  const remote: OutfitHydratedState = await hydrateOutfitStoreFromSupabase(userId);
  const local = useOutfitStore.getState();

  const clothingItems = mergeById(remote.clothingItems, local.clothingItems);
  const outfits = mergeById(remote.outfits, local.outfits);
  const weeklyPlans = mergeWeeklyPlansByWeek(remote.weeklyPlans, local.weeklyPlans);

  const patch: Partial<OutfitState> = {
    clothingItems: clothingItems.merged,
    outfits: outfits.merged,
    weeklyPlans: weeklyPlans.merged,
  };
  useOutfitStore.getState()._hydrateFromRemote(patch);

  // Backfill: sube a Supabase lo que era solo local.
  for (const item of clothingItems.localOnly) syncInsertClothingItem(item, userId);
  for (const outfit of outfits.localOnly) syncInsertOutfit(outfit, userId);
  for (const plan of weeklyPlans.localOnly) syncUpsertWeeklyPlan(plan.weekStartDate, plan.dayOutfits, userId);
}

// ---------- Selectors / helpers ----------

export function useClothingByCategory(category: ClothingItem["category"] | "todas") {
  const items = useOutfitStore((s) => s.clothingItems);
  if (category === "todas") return items;
  return items.filter((i) => i.category === category);
}

export function useTodayOutfit() {
  const weeklyPlans = useOutfitStore((s) => s.weeklyPlans);
  const outfits = useOutfitStore((s) => s.outfits);
  const weekStart = startOfWeekISO();
  const day = todayWeekdayIndex();
  const plan = weeklyPlans.find((p) => p.weekStartDate === weekStart);
  const outfitId = plan?.dayOutfits[day];
  const outfit = outfitId ? outfits.find((o) => o.id === outfitId) : undefined;
  return outfit ?? null;
}
