"use client";

/**
 * Guarda el resultado de la auto-medición de fps de la cámara en vivo (Fase A del roadmap de
 * entrenador por cámara, docs/roadmap/vision-entrenador.md sección 2.1.9) — para no repetir la
 * calibración cada vez que se abre la función, solo cuando cambia el dispositivo/navegador o el
 * usuario fuerza "volver a calibrar". 100% local: nada de esto sale del dispositivo.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import type { DeviceCalibrationResult } from "@/lib/camara/device-calibration";

interface CameraCalibrationState {
  calibration: DeviceCalibrationResult | null;
  setCalibration: (result: DeviceCalibrationResult) => void;
  clearCalibration: () => void;
}

export const useCameraCalibrationStore = create<CameraCalibrationState>()(
  persist(
    (set) => ({
      calibration: null,
      setCalibration: (result) => set({ calibration: result }),
      clearCalibration: () => set({ calibration: null }),
    }),
    {
      name: "vida-total-camera-calibration",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-camera-calibration")),
    },
  ),
);
