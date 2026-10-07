"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { AgentChat } from "@/components/agente/agent-chat";
import { AutoTotalBadge } from "@/components/agente/auto-total-badge";

/**
 * Botón del agente (hasta que exista la mascota) + insignia PERMANENTE de "Auto total": la insignia vive aquí, en el
 * layout, así se ve en cualquier pantalla mientras el modo esté activo. Va a la izquierda para no chocar con los
 * botones "+" de cada módulo (que van a la derecha).
 */
export function AgentFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed top-[max(env(safe-area-inset-top),8px)] left-1/2 -translate-x-1/2 z-[70]">
        <AutoTotalBadge />
      </div>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir el agente"
        className="fixed left-4 bottom-24 md:bottom-6 md:left-auto md:right-6 z-40 w-12 h-12 rounded-full bg-emerald-500 text-black shadow-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        <Bot size={22} />
      </button>
      {open && <AgentChat onClose={() => setOpen(false)} />}
    </>
  );
}
