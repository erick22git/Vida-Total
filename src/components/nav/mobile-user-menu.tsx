"use client";

import { usePathname } from "next/navigation";
import { UserMenu, type SessionUser } from "@/components/nav/user-menu";

/** Avatar flotante para móvil: el Sidebar (que trae el UserMenu) está oculto
 * en < md, así que lo mostramos por separado aquí — pero SOLO en la página
 * principal del dashboard. Si se mostrara en todas las páginas (como
 * `fixed top-0 right-0` global) choca con los botones/headers propios de
 * cada pantalla (p.ej. el Escáner, el detalle de rutina, etc.). */
export function MobileUserMenu({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  if (pathname !== "/") return null;

  return (
    <div className="md:hidden fixed top-0 right-0 z-40 p-3">
      <div className="glass-surface rounded-2xl">
        <UserMenu user={user} compact />
      </div>
    </div>
  );
}
