import type { StateStorage } from "zustand/middleware";
import { userScopedStoreName } from "./user-scope";

/**
 * Storage de localStorage para usar con `persist(..., { storage:
 * createJSONStorage(() => userScopedLocalStorage(baseName)) })`.
 *
 * A diferencia de pasar `localStorage` directo, esto resuelve la key
 * real (namespaced por usuario, ver `userScopedStoreName`) en CADA
 * llamada a getItem/setItem/removeItem, no solo una vez al crear el
 * store — así, si el store se hidrata antes de conocer al usuario, las
 * lecturas/escrituras posteriores igual terminan en la key correcta.
 */
export function userScopedLocalStorage(baseName: string): StateStorage {
  return {
    getItem: () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(userScopedStoreName(baseName));
    },
    setItem: (_name, value) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(userScopedStoreName(baseName), value);
    },
    removeItem: () => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(userScopedStoreName(baseName));
    },
  };
}
