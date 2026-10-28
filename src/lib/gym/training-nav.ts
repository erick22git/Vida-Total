/**
 * Navegación de Entrenamiento: cuando entras a Planes/Rutinas/Formulario desde el panel de configuración, al
 * salir (guardar, volver, borrar) debes caer de nuevo EN ese panel y no directo en la pantalla de Entrenamiento.
 * El panel marca el origen en sessionStorage (con vencimiento, para que no reaparezca días después) y la pantalla
 * de Entrenamiento lo lee al montar para reabrir el panel.
 */
const KEY = "vt-train-from-config";
const TTL_MS = 20 * 60 * 1000;

export function markFromConfig(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin sessionStorage: se vuelve a Entrenamiento a secas */
  }
}

export function clearFromConfig(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
}

export function isFromConfig(): boolean {
  try {
    const t = Number(sessionStorage.getItem(KEY));
    return t > 0 && Date.now() - t < TTL_MS;
  } catch {
    return false;
  }
}

/** Destino al "salir" hacia Entrenamiento: el panel de configuración si venías de ahí, o la pantalla principal. */
export function trainingHome(): string {
  return isFromConfig() ? "/gym/entrenamiento?config=1" : "/gym/entrenamiento";
}
