import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "@/lib/store/scoped-storage";
import type { ProgressEventType } from "@/lib/progress/types";

/**
 * "Acciones pendientes" de hábitos: un módulo (Gym) avisó que el objetivo se cumplió y el hábito relacionado espera
 * que el usuario toque el check. NUNCA completa el hábito: solo lo deja marcado como pendiente para guiar al usuario.
 * Es efímero por diseño (vale solo el día en que se creó): el progreso real vive en `habit.completedDates`.
 */
export interface HabitPrompt {
  habitId: string;
  sourceId: string;
  eventType: ProgressEventType;
  /** yyyy-MM-dd del día en que se generó. */
  date: string;
  createdAt: number;
  /** Cuándo la app ya llevó al usuario a este hábito (así no se navega dos veces por el mismo aviso). */
  navigatedAt?: number;
}

interface HabitPromptState {
  prompts: HabitPrompt[];
  /** Agrega (o refresca) el pendiente de un hábito. */
  add: (prompt: HabitPrompt) => void;
  clearHabit: (habitId: string) => void;
  markNavigated: (habitId: string, createdAt: number) => void;
  /** Quita los pendientes de días anteriores. */
  prune: (today: string) => void;
}

export const useHabitPromptStore = create<HabitPromptState>()(
  persist(
    (set) => ({
      prompts: [],
      add: (prompt) =>
        set((s) => ({ prompts: [...s.prompts.filter((p) => p.habitId !== prompt.habitId), prompt] })),
      markNavigated: (habitId, createdAt) =>
        set((s) => ({ prompts: s.prompts.map((p) => (p.habitId === habitId && p.createdAt === createdAt ? { ...p, navigatedAt: Date.now() } : p)) })),
      clearHabit: (habitId) => set((s) => ({ prompts: s.prompts.filter((p) => p.habitId !== habitId) })),
      prune: (today) => set((s) => (s.prompts.some((p) => p.date !== today) ? { prompts: s.prompts.filter((p) => p.date === today) } : s)),
    }),
    {
      name: "vida-total-habit-prompts",
      version: 1,
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-habit-prompts")),
    },
  ),
);

/** Pendiente vigente (de HOY) de un hábito, o `undefined`. */
export function promptForHabit(prompts: HabitPrompt[], habitId: string | undefined, today: string): HabitPrompt | undefined {
  return habitId ? prompts.find((p) => p.habitId === habitId && p.date === today) : undefined;
}
