"use client";

/**
 * Preferencias específicas del módulo Kegel.
 * Separadas de preferencesStore (global) y gymStore (datos del entrenamiento).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { KEGEL_LIMITS } from "@/lib/gym/kegel-plan";

export interface KegelSettings {
  /** Vibración activa (complementa soundEnabled del preferencesStore). */
  vibrationEnabled: boolean;
  /** Cuenta atrás antes de cada fase activa. */
  countdownEnabled: boolean;
  /** Override de reps por serie para el plan (null = usa el valor por defecto del plan). */
  repsOverride: number | null;
  /** Override de squeeze en segundos (null = usa el valor por defecto). */
  squeezeOverride: number | null;
  /** Override de relax en segundos (null = usa el valor por defecto). */
  relaxOverride: number | null;

  // acciones
  setVibrationEnabled: (v: boolean) => void;
  setCountdownEnabled: (v: boolean) => void;
  setRepsOverride: (v: number | null) => void;
  setSqueezeOverride: (v: number | null) => void;
  setRelaxOverride: (v: number | null) => void;
}

export const useKegelSettingsStore = create<KegelSettings>()(
  persist(
    (set) => ({
      vibrationEnabled: true,
      countdownEnabled: true,
      repsOverride: null,
      squeezeOverride: null,
      relaxOverride: null,

      setVibrationEnabled: (v) => set({ vibrationEnabled: v }),
      setCountdownEnabled: (v) => set({ countdownEnabled: v }),
      setRepsOverride: (v) => {
        const clamped = v === null ? null : Math.min(KEGEL_LIMITS.maxRepsPerSet, Math.max(KEGEL_LIMITS.minRepsPerSet, v));
        set({ repsOverride: clamped });
      },
      setSqueezeOverride: (v) => {
        const clamped = v === null ? null : Math.min(KEGEL_LIMITS.maxHoldSec, Math.max(KEGEL_LIMITS.minHoldSec, v));
        set({ squeezeOverride: clamped });
      },
      setRelaxOverride: (v) => {
        const clamped = v === null ? null : Math.min(KEGEL_LIMITS.maxHoldSec * 2, Math.max(KEGEL_LIMITS.minRelaxSec, v));
        set({ relaxOverride: clamped });
      },
    }),
    {
      name: "vida-total-kegel-settings",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-kegel-settings")),
    },
  ),
);
