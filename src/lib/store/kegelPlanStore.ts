import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { KEGEL_SESSIONS } from "@/lib/gym/kegel-plan";
import { localDayKey } from "@/lib/gym/kegel-dates";

/** Sesiones de Kegel cumplidas por día (dayKey "yyyy-MM-dd" → ids). Solo local; el resumen (racha/nivel) sigue en `gymStore`. */
interface KegelPlanState {
  completed: Record<string, string[]>;
  /** @param dayKey clave local "yyyy-MM-dd" — usar `localDayKey()` del módulo kegel-dates, nunca toISOString(). */
  markCompleted: (dayKey: string, sessionId: string) => void;
  /** Borra todos los días completados (reset del plan). */
  resetCompleted: () => void;
}

export const useKegelPlanStore = create<KegelPlanState>()(
  persist(
    (set) => ({
      completed: {},
      markCompleted: (dateISO, sessionId) =>
        set((s) => {
          const prev = s.completed[dateISO] ?? [];
          if (prev.includes(sessionId)) return s;
          return { completed: { ...s.completed, [dateISO]: [...prev, sessionId] } };
        }),
      resetCompleted: () => set({ completed: {} }),
    }),
    {
      name: "vida-total-kegel-plan",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-kegel-plan")),
    },
  ),
);

/** Días con las cinco sesiones cumplidas. */
export function fullyDoneDays(completed: Record<string, string[]>): Set<string> {
  const out = new Set<string>();
  for (const [day, ids] of Object.entries(completed)) {
    if (KEGEL_SESSIONS.every((s) => ids.includes(s.id))) out.add(day);
  }
  return out;
}
