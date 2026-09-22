"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";

/**
 * Preferencias de feedback compartidas por TODA la app, no solo Hábitos —
 * cualquier módulo que use el Animation Engine (sonido/haptics/animación)
 * respeta esto. Vive separado de cualquier store de módulo a propósito.
 */
interface PreferencesState {
  soundEnabled: boolean;
  /** "system" = seguir `prefers-reduced-motion` del dispositivo (default).
   * "on"/"off" = el usuario lo fuerza explícitamente desde la app. */
  reduceMotion: "system" | "on" | "off";
  setSoundEnabled: (v: boolean) => void;
  setReduceMotion: (v: "system" | "on" | "off") => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      reduceMotion: "system",
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setReduceMotion: (v) => set({ reduceMotion: v }),
    }),
    {
      name: "vida-total-preferences-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-preferences-store")),
    },
  ),
);

/**
 * Resuelve la preferencia contra `prefers-reduced-motion` real del
 * dispositivo cuando está en "system". Cualquier componente de animación
 * debe leer ESTO, no `reduceMotion` del store directamente.
 */
export function useEffectiveReduceMotion(): boolean {
  const pref = usePreferencesStore((s) => s.reduceMotion);
  const [systemReduced, setSystemReduced] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (pref === "on") return true;
  if (pref === "off") return false;
  return systemReduced;
}
