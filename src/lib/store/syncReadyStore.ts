import { create } from "zustand";

/**
 * Avisa cuándo terminó el primer traído de datos desde Supabase (una vez por carga de página). Sirve para no decidir cosas de
 * "primera vez" (formularios de configuración, rutina inicial) con el estado VACÍO del navegador antes de saber si la cuenta ya
 * tiene datos en la nube. No se persiste: arranca en `false` en cada carga.
 */
interface SyncReadyState {
  gym: boolean;
  setGymReady: () => void;
}

export const useSyncReadyStore = create<SyncReadyState>((set) => ({
  gym: false,
  setGymReady: () => set({ gym: true }),
}));
