"use client";

import { create } from "zustand";
import type { TourModule } from "@/lib/tutorial/steps";

/**
 * Estado del tutorial guiado. Solo de la sesión (no se persiste acá): que ya se haya visto vive en localStorage por módulo y en
 * `profiles.tutorial_seen` (ver `GuidedTour`). `intro` = la burbuja de bienvenida que pregunta si quiere el recorrido.
 * Cada módulo tiene SU recorrido: el de Calorías termina en Calorías, el de Entrenamiento en Entrenamiento.
 */
interface TourState {
  active: boolean;
  intro: boolean;
  index: number;
  module: TourModule;
  start: (module: TourModule, withIntro?: boolean) => void;
  begin: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const useTour = create<TourState>()((set) => ({
  active: false,
  intro: false,
  index: 0,
  module: "calorias",
  start: (module, withIntro = false) => set({ active: true, intro: withIntro, index: 0, module }),
  begin: () => set({ intro: false, index: 0 }),
  next: () => set((s) => ({ index: s.index + 1 })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  stop: () => set({ active: false, intro: false, index: 0 }),
}));
