"use client";

import { useEffect } from "react";
import { hydrateGymStore } from "@/lib/store/gymStore";

/**
 * Script inline (bloqueante, no next/script) que escribe el id del
 * usuario logueado en localStorage ANTES que cualquier otro JS de la
 * app corra. Necesario para que los stores de Zustand (que se hidratan
 * al importarse, muy temprano) puedan namespacear su key de
 * localStorage por usuario desde la primera lectura.
 * Ver src/lib/store/user-scope.ts.
 *
 * También es el lugar donde se dispara la hidratación desde Supabase de
 * los stores que ya tienen su capa de sync (por ahora, Gym — ver
 * src/lib/sync/gym-sync.ts). Es un Client Component (recibe `userId` ya
 * resuelto por el layout, un Server Component) que corre un `useEffect`
 * una vez por sesión de login para traer los datos del usuario desde las
 * 14 tablas de Gym y mezclarlos en el store — así un segundo dispositivo
 * ve los mismos datos. Si Supabase no responde, la hidratación
 * simplemente no aplica cambios y la app sigue funcionando con lo que ya
 * había en localStorage (ver `hydrateGymStore`).
 */
export function UserScopeScript({ userId }: { userId: string }) {
  useEffect(() => {
    hydrateGymStore(userId).catch((err) => {
      console.warn("UserScopeScript: fallo al hidratar el store de Gym desde Supabase:", err);
    });
    // Solo al montar / cuando cambia el usuario logueado (login con otra
    // cuenta en el mismo navegador) — no en cada render.
  }, [userId]);

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{window.localStorage.setItem("vida-total-uid",${JSON.stringify(userId)});}catch(e){}`,
      }}
    />
  );
}
