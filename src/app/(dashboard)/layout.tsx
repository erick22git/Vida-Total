import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileUserMenu } from "@/components/nav/mobile-user-menu";
import type { SessionUser } from "@/components/nav/user-menu";
import { UserScopeScript } from "@/components/nav/user-scope-script";
import { AccountNoticeBanner } from "@/components/nav/account-notice-banner";
import { ImpersonationBanner } from "@/components/nav/impersonation-banner";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { createClient } from "@/lib/supabase/server";
import { getAccountNotice, type Profile } from "@/lib/types/profile";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // Si las credenciales de Supabase son placeholders (o Supabase está
  // inalcanzable), `getUser()` puede lanzar en vez de devolver
  // `{ user: null }` (p.ej. URL inválida). Lo tratamos igual que "sin
  // sesión" y mandamos a /login, en vez de tumbar la app con un 500.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Dashboard layout: fallo al verificar sesión de Supabase:", err);
  }

  if (!user) {
    redirect("/login");
  }

  const metadata = user.user_metadata ?? {};
  const sessionUser: SessionUser = {
    name: metadata.full_name ?? metadata.name ?? user.email ?? "Usuario",
    email: user.email ?? "",
    avatarUrl: metadata.avatar_url ?? metadata.picture ?? null,
  };

  // Perfil de administración (rol, bloqueo, vigencia de acceso — ver
  // supabase/migrations/0001_admin_foundation.sql). Es la base que usará
  // un trabajo POSTERIOR para el panel de administrador; acá solo se usa
  // para el aviso NO bloqueante de cuenta bloqueada/vencida (el usuario
  // pidió explícitamente que esto nunca corte el acceso).
  //
  // Si la tabla `profiles` todavía no existe (la migración SQL no se ha
  // corrido) o la consulta falla por cualquier motivo, degradamos a
  // "sin perfil" en vez de tumbar el dashboard — el resto de la app debe
  // seguir funcionando igual que hoy.
  let profile: Profile | null = null;
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) {
      console.error("Dashboard layout: fallo al cargar profile:", error.message);
    } else {
      profile = data as Profile | null;
    }
  } catch (err) {
    console.error("Dashboard layout: excepción al cargar profile:", err);
  }

  const notice = profile ? getAccountNotice(profile) : null;

  // Ver src/app/auth/impersonate/route.ts: se setea al canjear un magic
  // link generado desde /admin/usuarios/[userId] ("Entrar como este
  // usuario"). Solo es un marcador legible (no la sesión en sí, esa vive
  // en la cookie httpOnly vt_admin_return) para poder mostrar el banner.
  const cookieStore = await cookies();
  const impersonatingEmail = cookieStore.get("vt_impersonating_email")?.value ?? null;

  return (
    <ProfileProvider profile={profile}>
      <div className="flex items-start min-h-dvh w-full">
        <UserScopeScript userId={user.id} />
        <Sidebar user={sessionUser} isAdmin={profile?.role === "admin"} />
        <MobileUserMenu user={sessionUser} isAdmin={profile?.role === "admin"} />
        {/* Sidebar/BottomNav son `position: fixed` (ver esos componentes),
            así que el banner vive DENTRO de <main> (flujo normal de
            documento) en vez de por encima de todo el layout — evita que
            se superponga con la barra lateral fija, y de todas formas
            queda arriba de todo el contenido real de la página, visible
            de inmediato. */}
        <main className="flex-1 min-w-0 md:ml-60 lg:ml-64 px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-28 md:pb-12">
          <div className="mx-auto w-full max-w-[900px]">
            {impersonatingEmail && (
              <div className="mb-6">
                <ImpersonationBanner email={impersonatingEmail} />
              </div>
            )}
            {notice && (
              <div className="mb-6">
                <AccountNoticeBanner notice={notice} />
              </div>
            )}
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </ProfileProvider>
  );
}
