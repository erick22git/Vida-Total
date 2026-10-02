import { useCallback, useSyncExternalStore } from "react";

/** Modo oscuro / claro elegido en Configuración. Se guarda en este dispositivo. Los colores salen de
 * las variables `--t-*` que define globals.css para `.vt-theme-dark` / `.vt-theme-light`; una
 * pantalla adopta el tema envolviéndose en esa clase (hoy: inicio de Entrenamiento y su panel). */
export type ThemeMode = "dark" | "light";

const KEY = "vt-theme";
const listeners = new Set<() => void>();

function read(): ThemeMode {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useThemePref(): [ThemeMode, (m: ThemeMode) => void] {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "dark" as ThemeMode,
  );
  const set = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* sin almacenamiento: vale solo esta sesión */
    }
    listeners.forEach((l) => l());
  }, []);
  return [mode, set];
}
