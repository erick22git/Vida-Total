import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * Layout raíz de `/admin` — deliberadamente FUERA del grupo
 * `(dashboard)` (sin Sidebar/BottomNav de módulos): es una sección
 * administrativa separada, con su propia navegación simple (ver
 * AdminHeader).
 *
 * Este es el único punto de entrada de acceso a toda la sección: si
 * `profile.role !== 'admin'`, redirige a `/` SIN ningún mensaje que
 * insinúe que existe un panel de admin — para un usuario normal, `/admin`
 * simplemente "no existe" (se comporta como si hubiera pedido una ruta
 * cualquiera y lo mandaran a home). Las políticas de RLS de Supabase
 * (supabase/migrations/0001_admin_foundation.sql) son la segunda capa
 * real de defensa — este chequeo de layout es solo para la UX de
 * navegación, nunca la única barrera de seguridad de los datos.
 *
 * IMPORTANTE: este layout NO protege las API routes bajo
 * `src/app/api/admin/*` — esas repiten su propio chequeo de admin
 * (`requireAdmin()`) porque se puede pegarles un POST directo sin pasar
 * por ningún layout de página.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const result = await requireAdmin();

  if (!result.ok) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <AdminHeader adminName={result.profile.full_name ?? result.profile.email ?? "Admin"} />
      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="mx-auto w-full max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
