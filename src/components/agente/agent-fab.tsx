"use client";

import { useEffect } from "react";
import { AutoTotalBadge } from "@/components/agente/auto-total-badge";
import { MascotDock } from "@/components/agente/mascot-dock";
import { hydrateAgentStore, useAgentStore } from "@/lib/store/agentStore";
import { getCurrentUserId } from "@/lib/store/user-scope";

/**
 * Arranque del agente en el layout: panel de la mascota (se abre desde su ícono en el menú), insignia PERMANENTE de
 * "Auto total" (visible en cualquier pantalla mientras esté activo) y la puesta al día de la configuración.
 */
export function AgentFab() {
  // El servidor necesita saber qué día/hora es para ti: la app le deja tu zona horaria en la configuración. Primero se trae
  // la configuración remota (merge), para que un dispositivo nuevo no pise con los valores por defecto la que ya existe.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uid = getCurrentUserId();
      if (uid) await hydrateAgentStore(uid).catch(() => {});
      if (cancelled) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const st = useAgentStore.getState();
      if (tz && tz !== st.config.timezone) st.setConfig((c) => ({ ...c, timezone: tz }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <div className="fixed top-[max(env(safe-area-inset-top),8px)] left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
        <div className="pointer-events-auto">
          <AutoTotalBadge />
        </div>
      </div>
      <MascotDock />
    </>
  );
}
