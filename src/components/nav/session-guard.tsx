"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getStoredUserId } from "@/lib/store/user-scope";

/**
 * Corta de raíz el cruce de cuentas entre pestañas del mismo navegador. La sesión (cookie) y `localStorage` son
 * COMPARTIDOS por todas las pestañas: si en otra pestaña entra otra persona (o se cierra sesión), ésta seguiría mostrando
 * y guardando los datos de la cuenta anterior bajo la sesión nueva. Apenas detecta que la sesión ya no es la de esta
 * página, recarga completo: el servidor vuelve a decidir quién es y se reconstruye todo (stores en memoria incluidos).
 */
export function SessionGuard({ userId }: { userId: string }) {
  useEffect(() => {
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    // 1) Otra pestaña cambió el id guardado.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "vida-total-uid") return;
      if (e.newValue !== userId) reload();
    };
    // 2) Al volver a esta pestaña, el id guardado ya no es el mío (por si el evento 'storage' se perdió).
    const check = () => {
      if (document.visibilityState === "hidden") return;
      const stored = getStoredUserId();
      if (stored !== userId) reload();
    };
    // 3) La propia sesión de Supabase cambió (otra cuenta entró o se cerró sesión).
    const { data: sub } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") reload();
      else if (event === "SIGNED_IN" && session?.user.id && session.user.id !== userId) reload();
    });

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      sub.subscription.unsubscribe();
    };
  }, [userId]);

  return null;
}
