"use client";

import { create } from "zustand";

/**
 * Estado del tutorial guiado. Solo de la sesión (no se persiste acá): que ya se haya visto vive en `profiles.tutorial_seen` y en
 * localStorage (ver `GuidedTour`). `intro` = la burbuja de bienvenida que pregunta si quiere el recorrido.
 */
interface TourState {
  active: boolean;
  intro: boolean;
  index: number;
  start: (withIntro?: boolean) => void;
  begin: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const useTour = create<TourState>()((set) => ({
  active: false,
  intro: false,
  index: 0,
  start: (withIntro = false) => set({ active: true, intro: withIntro, index: 0 }),
  begin: () => set({ intro: false, index: 0 }),
  next: () => set((s) => ({ index: s.index + 1 })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  stop: () => set({ active: false, intro: false, index: 0 }),
}));
