import { useCallback, useSyncExternalStore } from "react";

/**
 * "Modo admin": no es un sistema de roles real (la app es de un solo usuario) — es una bandera local,
 * guardada en este dispositivo, que muestra acciones que no tienen sentido para el uso normal (por ahora,
 * "Verificación" en el detalle de un alimento). Ver auditoría del rediseño de Calorías, etapa 3.
 */
const KEY = "vt-admin-mode";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useAdminMode(): [boolean, (v: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* sin almacenamiento: vale solo esta sesión */
    }
    listeners.forEach((l) => l());
  }, []);
  return [on, set];
}
