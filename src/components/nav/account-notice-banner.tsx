import { AlertTriangle } from "lucide-react";
import type { AccountNotice } from "@/lib/types/profile";

/**
 * Aviso NO bloqueante para cuentas con `is_blocked=true` o
 * `access_until` vencido (ver getAccountNotice en
 * src/lib/types/profile.ts). El usuario pidió explícitamente que esto
 * NO corte el acceso — solo se muestra arriba de todo y el resto de la
 * app sigue funcionando debajo.
 */
export function AccountNoticeBanner({ notice }: { notice: AccountNotice }) {
  return (
    <div className="w-full rounded-2xl bg-amber-500/15 border border-amber-400/30 px-4 py-3 flex items-center gap-2.5">
      <AlertTriangle size={16} className="text-amber-300 shrink-0" />
      <p className="text-xs sm:text-sm text-amber-100">{notice.message}</p>
    </div>
  );
}
