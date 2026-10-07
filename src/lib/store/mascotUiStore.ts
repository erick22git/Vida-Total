"use client";

import { create } from "zustand";

export type DockTab = "home" | "chat" | "settings";

interface MascotUi {
  open: boolean;
  /** false = barra compacta (solo la mascota, como al asomarse); true = panel completo. */
  expanded: boolean;
  tab: DockTab;
  /** Texto que se deja escrito en el chat al abrirlo desde una opción rápida. */
  prefill: string;
  openDock: (tab?: DockTab, prefill?: string) => void;
  expand: () => void;
  collapse: () => void;
  closeDock: () => void;
  toggleDock: () => void;
  setTab: (tab: DockTab) => void;
  clearPrefill: () => void;
}

/** Estado del panel de la mascota (se despliega desde arriba). Solo de la sesión, no se guarda. */
export const useMascotUi = create<MascotUi>()((set) => ({
  open: false,
  expanded: false,
  tab: "home",
  prefill: "",
  // Desde el menú ("home") baja primero la barra compacta; cualquier otra entrada abre el panel completo.
  openDock: (tab = "home", prefill = "") => set({ open: true, tab, prefill, expanded: tab !== "home" || !!prefill }),
  expand: () => set({ expanded: true }),
  collapse: () => set({ expanded: false, tab: "home" }),
  closeDock: () => set({ open: false }),
  toggleDock: () => set((s) => ({ open: !s.open, tab: "home", expanded: false })),
  setTab: (tab) => set({ tab, expanded: true }),
  clearPrefill: () => set({ prefill: "" }),
}));
