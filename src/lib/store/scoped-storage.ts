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
/** Una sola vez por carga de página: evita spamear el aviso si varias escrituras seguidas fallan
 * (p. ej. varias fotos agregadas una tras otra con la cuota ya llena). */
let warnedQuotaExceeded = false;

export function userScopedLocalStorage(baseName: string): StateStorage {
  return {
    getItem: () => {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(userScopedStoreName(baseName));
      } catch (err) {
        console.warn(`[scoped-storage] getItem(${baseName}) falló`, err);
        return null;
      }
    },
    setItem: (_name, value) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(userScopedStoreName(baseName), value);
      } catch (err) {
        // `localStorage.setItem` sin try/catch acá hacía que, al llenarse la cuota (fotos en base64
        // acumuladas), la escritura fallara EN SILENCIO: el cambio quedaba aplicado en memoria (se
        // veía bien en el momento) pero nunca llegaba al disco, así que al volver a entrar a la
        // página (que relee localStorage desde cero) el cambio más reciente ya no estaba.
        console.error(`[scoped-storage] setItem(${baseName}) falló — el cambio no quedó guardado`, err);
        if (!warnedQuotaExceeded) {
          warnedQuotaExceeded = true;
          void import("@/lib/notify/use-notify").then(({ notify }) =>
            notify({
              type: "error",
              priority: "medium",
              title: "No se pudo guardar un cambio",
              message: "El almacenamiento del dispositivo está lleno (suele pasar con muchas fotos). Liberá espacio o borrá fotos viejas.",
            }),
          );
        }
      }
    },
    removeItem: () => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(userScopedStoreName(baseName));
      } catch (err) {
        console.warn(`[scoped-storage] removeItem(${baseName}) falló`, err);
      }
    },
  };
}
