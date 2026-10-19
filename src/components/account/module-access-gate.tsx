"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Send } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { DarkCard, Btn } from "@/components/agente/ui";
import { useAccount, useProfile } from "@/components/providers/profile-provider";
import { MODULE_LABELS } from "@/lib/admin/module-labels";
import { moduleForPath } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";

/**
 * Corta el acceso a un módulo que el admin deshabilitó para este usuario. Un admin nunca queda fuera.
 * NOTA DE SEGURIDAD: es un control de la interfaz (la navegación ya oculta el módulo). Los datos del módulo siguen estando
 * protegidos por RLS como siempre; este componente no es una barrera de datos.
 */
export function ModuleAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const profile = useProfile();
  const { modules } = useAccount();
  const key = moduleForPath(pathname);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  if (profile?.role === "admin" || !key || modules[key]) return <>{children}</>;

  const label = MODULE_LABELS[key].label;

  async function pedirAcceso() {
    if (!profile) return;
    setBusy(true);
    // Si la migración 0019 todavía no se aplicó, `module_requests` no existe: falla sola, sin romper nada.
    const { error } = await createClient().from("module_requests").insert({ user_id: profile.id, module: key });
    setBusy(false);
    if (!error) setRequested(true);
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-10 text-center">
      <Mascot mood="off" size={96} still />
      <DarkCard className="w-full max-w-[420px] flex flex-col items-center gap-3">
        <Lock size={22} className="text-white/60" />
        <p className="text-[17px] font-extrabold">{label} no está habilitado</p>
        <p className="text-sm text-white/60">El administrador no activó este módulo para tu cuenta. Si lo necesitas, pídele acceso.</p>
        {requested ? (
          <p className="text-sm text-emerald-300">Listo, le avisamos al administrador.</p>
        ) : (
          <Btn variant="light" disabled={busy} onClick={pedirAcceso} className="flex items-center gap-1.5">
            <Send size={14} /> Pedir acceso
          </Btn>
        )}
        <Link href="/">
          <Btn>Volver al inicio</Btn>
        </Link>
      </DarkCard>
    </div>
  );
}
