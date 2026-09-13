import { UserRoundCheck } from "lucide-react";

/**
 * Banner persistente mientras un admin está "Entrando como este usuario"
 * (ver src/app/api/admin/impersonate/route.ts y
 * src/app/auth/impersonate/route.ts). Se muestra en TODO el dashboard
 * normal — no solo en `/admin` — porque, una vez que la sesión se
 * canjea, el admin navega la app exactamente como la vería el usuario
 * objetivo, fuera de la sección `/admin`.
 *
 * El link "Volver a mi sesión" apunta a un Route Handler server-side
 * (`/auth/impersonate/stop`) que restaura la sesión original del admin
 * desde la cookie `vt_admin_return` — no es un simple "cerrar sesión".
 */
export function ImpersonationBanner({ email }: { email: string }) {
  return (
    <div className="w-full rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/30 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <UserRoundCheck size={16} className="text-fuchsia-200 shrink-0" />
        <p className="text-xs sm:text-sm text-fuchsia-100 truncate">
          Estás viendo la cuenta de <span className="font-semibold">{email}</span> como administrador.
        </p>
      </div>
      <a
        href="/auth/impersonate/stop"
        className="shrink-0 text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-3 py-1.5"
      >
        Volver a mi sesión
      </a>
    </div>
  );
}
