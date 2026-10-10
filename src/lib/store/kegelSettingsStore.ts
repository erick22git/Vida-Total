"use client";

/**
 * Preferencias específicas del módulo Kegel.
 * Separadas de preferencesStore (global) y gymStore (datos del entrenamiento).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";

export interface KegelSettings {
  /** Vibración activa (complementa soundEnabled del preferencesStore). */
  vibrationEnabled: boolean;
  /** Cuenta atrás antes de cada fase activa. */
  countdownEnabled: boolean;
  /** Volumen (0–1) de los tonos de contraer/relajar DENTRO de una sesión — además del interruptor
   * general de sonido (preferencesStore) y del volumen físico del dispositivo. */
  kegelVolume: number;

  // acciones
  setVibrationEnabled: (v: boolean) => void;
  setCountdownEnabled: (v: boolean) => void;
  setKegelVolume: (v: number) => void;
}

export const useKegelSettingsStore = create<KegelSettings>()(
  persist(
    (set) => ({
      vibrationEnabled: true,
      countdownEnabled: true,
      kegelVolume: 1,

      setVibrationEnabled: (v) => set({ vibrationEnabled: v }),
      setCountdownEnabled: (v) => set({ countdownEnabled: v }),
      setKegelVolume: (v) => set({ kegelVolume: Math.min(1, Math.max(0, v)) }),
    }),
    {
      name: "vida-total-kegel-settings",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-kegel-settings")),
    },
  ),
);
