"use client";

import { create } from "zustand";

export type DockTab = "home" | "chat" | "settings";

interface MascotUi {
  open: boolean;
  tab: DockTab;
  /** Texto que se deja escrito en el chat al abrirlo desde una opción rápida. */
  prefill: string;
  openDock: (tab?: DockTab, prefill?: string) => void;
  closeDock: () => void;
  toggleDock: () => void;
  setTab: (tab: DockTab) => void;
  clearPrefill: () => void;
}

/** Estado del panel de la mascota (se despliega desde arriba). Solo de la sesión, no se guarda. */
export const useMascotUi = create<MascotUi>()((set) => ({
  open: false,
  tab: "home",
  prefill: "",
  openDock: (tab = "home", prefill = "") => set({ open: true, tab, prefill }),
  closeDock: () => set({ open: false }),
  toggleDock: () => set((s) => ({ open: !s.open, tab: s.open ? s.tab : "home" })),
  setTab: (tab) => set({ tab }),
  clearPrefill: () => set({ prefill: "" }),
}));
