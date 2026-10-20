"use client";

import { LogOut } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { Btn, DarkCard } from "@/components/agente/ui";
import { createClient } from "@/lib/supabase/client";
import { setCurrentUserId } from "@/lib/store/user-scope";

/** Pantalla de una cuenta que el administrador eliminó (soft-delete): no entra a nada; sus datos siguen guardados. */
export function AccountRemoved() {
  async function signOut() {
    await createClient().auth.signOut();
    setCurrentUserId(null);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga COMPLETA a propósito: descarta de la memoria los stores de la cuenta que sale
    window.location.href = "/login";
  }
  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center justify-center px-4 py-6 gap-5">
      <Mascot mood="off" size={96} still />
      <DarkCard className="w-full max-w-[420px] flex flex-col items-center gap-3 text-center">
        <p className="text-[17px] font-extrabold">Esta cuenta fue eliminada</p>
        <p className="text-sm text-white/60">El administrador desactivó tu acceso. Si fue un error, escribile para que la restaure.</p>
        <Btn variant="light" onClick={signOut} className="flex items-center gap-1.5">
          <LogOut size={14} /> Salir
        </Btn>
      </DarkCard>
    </div>
  );
}
