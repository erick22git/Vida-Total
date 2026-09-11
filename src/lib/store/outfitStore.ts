import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import type { ClothingItem, Outfit, OutfitOccasion, WeeklyPlan } from "@/lib/types/outfit";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
}

export const useOutfitStore = create<OutfitState>()(
  persist(
    (set, get) => ({
      // Armario
      clothingItems: [],
      addClothingItem: (item) => {
        const id = uid();
        set((state) => ({
          clothingItems: [
            ...state.clothingItems,
            {
              id,
              name: item.name,
              category: item.category,
              color: item.color,
              season: item.season,
              imageUrl: item.imageUrl ?? "",
              timesWorn: 0,
              cost: item.cost,
              dateAdded: item.dateAdded ?? todayISO(),
            },
          ],
        }));
        return id;
      },
      updateClothingItem: (id, patch) =>
        set((state) => ({
          clothingItems: state.clothingItems.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteClothingItem: (id) =>
        set((state) => ({
          clothingItems: state.clothingItems.filter((c) => c.id !== id),
          outfits: state.outfits.map((o) => ({
            ...o,
            itemIds: o.itemIds.filter((iid) => iid !== id),
          })),
        })),
      registerWorn: (id) =>
        set((state) => ({
          clothingItems: state.clothingItems.map((c) =>
            c.id === id
              ? { ...c, timesWorn: c.timesWorn + 1, lastWorn: todayISO() }
              : c,
          ),
        })),

      // Outfits
      outfits: [],
      addOutfit: (outfit) => {
        const id = uid();
        set((state) => ({
          outfits: [
            ...state.outfits,
            {
              id,
              name: outfit.name,
              itemIds: outfit.itemIds,
              occasion: outfit.occasion,
              createdAt: new Date().toISOString(),
            },
          ],
          clothingItems: state.clothingItems.map((c) =>
            outfit.itemIds.includes(c.id)
              ? { ...c, timesWorn: c.timesWorn + 1, lastWorn: todayISO() }
              : c,
          ),
        }));
        return id;
      },
      updateOutfit: (id, patch) =>
        set((state) => ({
          outfits: state.outfits.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      deleteOutfit: (id) =>
        set((state) => ({
          outfits: state.outfits.filter((o) => o.id !== id),
          weeklyPlans: state.weeklyPlans.map((p) => {
            const dayOutfits = { ...p.dayOutfits };
            for (const day of Object.keys(dayOutfits)) {
              if (dayOutfits[Number(day)] === id) delete dayOutfits[Number(day)];
            }
            return { ...p, dayOutfits };
          }),
        })),

      // Plan semanal
      weeklyPlans: [],
      getWeeklyPlan: (weekStartDate) =>
        get().weeklyPlans.find((p) => p.weekStartDate === weekStartDate),
      setWeeklyPlanDay: (weekStartDate, day, outfitId) =>
        set((state) => {
          const existing = state.weeklyPlans.find((p) => p.weekStartDate === weekStartDate);
          if (existing) {
            return {
              weeklyPlans: state.weeklyPlans.map((p) =>
                p.weekStartDate === weekStartDate
                  ? { ...p, dayOutfits: { ...p.dayOutfits, [day]: outfitId } }
                  : p,
              ),
            };
          }
          return {
            weeklyPlans: [
              ...state.weeklyPlans,
              { id: uid(), weekStartDate, dayOutfits: { [day]: outfitId } },
            ],
          };
        }),
      clearWeeklyPlanDay: (weekStartDate, day) =>
        set((state) => ({
          weeklyPlans: state.weeklyPlans.map((p) => {
            if (p.weekStartDate !== weekStartDate) return p;
            const dayOutfits = { ...p.dayOutfits };
            delete dayOutfits[day];
            return { ...p, dayOutfits };
          }),
        })),
    }),
    {
      name: "vida-total-outfit-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-outfit-store")),
    },
  ),
);

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
