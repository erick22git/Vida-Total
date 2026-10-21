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
 *
 * IMPORTANTE (aislamiento entre cuentas): localStorage es COMPARTIDO entre todas las pestañas del navegador. Si otra pestaña
 * inicia sesión con otra cuenta, `vida-total-uid` cambia bajo los pies de ésta. Por eso el id se FIJA al primer uso en esta
 * carga de página (`pageUserId`): ésta pestaña sigue escribiendo SOLO en los datos de la cuenta con la que se cargó, y
 * `SessionGuard` la recarga en cuanto detecta que la sesión cambió. Sin esto, una pestaña podía guardar los datos de una
 * cuenta bajo las claves (y la fila de Supabase) de otra.
 */
let pageUserId: string | null = null;

function readStoredUserId(): string | null {
  try {
    return window.localStorage.getItem(UID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  if (pageUserId) return pageUserId;
  const stored = readStoredUserId();
  if (stored) pageUserId = stored;
  return stored;
}

/** Id guardado AHORA en localStorage (lo puede haber cambiado otra pestaña); distinto del fijado en esta carga. */
export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return readStoredUserId();
}

export function setCurrentUserId(id: string | null) {
  if (typeof window === "undefined") return;
  pageUserId = id;
  try {
    if (id) {
      window.localStorage.setItem(UID_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(UID_STORAGE_KEY);
    }
  } catch {
    // localStorage no disponible (modo privado estricto, etc.) — no
    // bloqueamos la app por esto: los stores quedan sin persistir en esta sesión.
  }
}

/** Nombre de key de localStorage para un store, siempre con el id del usuario.
 * Sin usuario conocido NO se cae al nombre base viejo (sin sufijo): esa clave
 * pudo quedar con datos de la persona que usaba antes este navegador, y una
 * cuenta nueva los habría leído como propios. `::anon` queda vacía siempre. */
export function userScopedStoreName(baseName: string): string {
  const uid = getCurrentUserId();
  return `${baseName}::${uid ?? "anon"}`;
}
