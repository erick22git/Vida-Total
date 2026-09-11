const UID_STORAGE_KEY = "vida-total-uid";

/**
 * Id del usuario de Supabase actualmente logueado, cacheado en un item de
 * localStorage aparte (`vida-total-uid`). Se lee de forma síncrona para
 * poder namespacear las keys de los stores de Zustand (`persist`) por
 * usuario, sin tener que hacer los stores async.
 *
 * Quién lo escribe:
 * - `src/components/nav/user-scope-script.tsx`: un <script> inline
 *   renderizado por `src/app/(dashboard)/layout.tsx` (Server Component
 *   que ya conoce al usuario vía `supabase.auth.getUser()`). Al ser un
 *   script inline (no un bundle de Next, que siempre es defer/module),
 *   se ejecuta ANTES que cualquier módulo de la app — incluyendo los
 *   stores de Zustand, que se hidratan al importarse — así que para
 *   cuando un store lee localStorage, el uid ya está disponible.
 * - `src/components/nav/user-menu.tsx`: lo limpia al cerrar sesión.
 */
export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(UID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentUserId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(UID_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(UID_STORAGE_KEY);
    }
  } catch {
    // localStorage no disponible (modo privado estricto, etc.) — no
    // bloqueamos la app por esto, simplemente los stores quedan
    // sin namespacear para esta sesión.
  }
}

/** Nombre de key de localStorage para un store, incluyendo el id del
 * usuario actual si lo conocemos — así dos cuentas de Google distintas
 * en el mismo navegador no mezclan sus datos. Sin usuario conocido
 * (p.ej. muy al inicio, antes del primer login) cae de vuelta al nombre
 * base, sin namespacear. */
export function userScopedStoreName(baseName: string): string {
  const uid = getCurrentUserId();
  return uid ? `${baseName}::${uid}` : baseName;
}
