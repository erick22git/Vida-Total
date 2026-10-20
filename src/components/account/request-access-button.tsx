"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";
import { Btn } from "@/components/agente/ui";
import { useProfile } from "@/components/providers/profile-provider";
import { createClient } from "@/lib/supabase/client";
import { moduleLabel } from "@/lib/account/module-catalog";
import type { ModuleKey } from "@/lib/types/profile";

/**
 * "Pedir acceso" a un módulo que el admin todavía no habilitó. Inserta en `module_requests` (migración 0019): el admin lo ve
 * en /admin/usuarios con el NOMBRE REAL del módulo ("Pedido de acceso a Calorías"), nunca una clave interna. Si ya había un
 * pedido sin resolver para ese módulo (índice único de la 0021) se avisa en vez de duplicarlo.
 */
export function RequestAccessButton({ moduleKey, className }: { moduleKey: ModuleKey; className?: string }) {
  const profile = useProfile();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "already" | "error">("idle");
  const label = moduleLabel(moduleKey);

  async function request() {
    if (!profile) return;
    setState("busy");
    // Si la migración 0019 todavía no se aplicó, `module_requests` no existe: falla sola, sin romper nada.
    const { error } = await createClient().from("module_requests").insert({ user_id: profile.id, module: moduleKey });
    if (!error) setState("sent");
    else if (error.code === "23505") setState("already");
    else setState("error");
  }

  if (state === "sent" || state === "already") {
    return (
      <p className="text-sm text-emerald-300 flex items-center gap-1.5">
        <Check size={14} />
        {state === "sent" ? `Pedido de acceso a ${label} enviado.` : `Ya pediste acceso a ${label}: el administrador lo va a ver.`}
      </p>
    );
  }

  return (
    <div className={className}>
      <Btn variant="light" disabled={state === "busy"} onClick={request} className="flex items-center gap-1.5">
        <Send size={14} /> Pedir acceso a {label}
      </Btn>
      {state === "error" && <p className="text-xs text-[#ff9a9d] mt-1.5">No se pudo enviar el pedido. Probá de nuevo en un rato.</p>}
    </div>
  );
}
