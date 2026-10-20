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
import { HabitSourceBridge } from "@/components/habitos/habit-source-bridge";
import { AgentFab } from "@/components/agente/agent-fab";
import { AgentInboxApplier } from "@/components/agente/agent-inbox-applier";
import { AgentNotificationBanner } from "@/components/agente/agent-notification-banner";
import { DynamicIsland } from "@/components/shared/dynamic-island";
import { PaymentGate } from "@/components/pago/payment-gate";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ModuleAccessGate } from "@/components/account/module-access-gate";
import { GuidedTour } from "@/components/tutorial/guided-tour";
import { AccountRemoved } from "@/components/account/account-removed";
import { FirstUseForms } from "@/components/account/first-use-forms";
import { loadAccountExtras } from "@/lib/account/load-account";
import { allModulesEnabled, restrictForUsers } from "@/lib/account/modules";
import { getSubscription } from "@/lib/subscription";
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

  // Red de seguridad (migración 0019): si el trigger `handle_new_user` no corrió para esta cuenta por
  // lo que sea, el propio usuario crea su fila de `profiles` acá (RPC `ensure_own_profile`, solo puede
  // tocar SU propio id) y se vuelve a pedir — sin esto, una cuenta sin fila queda invisible para
  // siempre en /admin/usuarios y nadie puede asignarle módulos ni revisar su suscripción. Si la función
  // todavía no existe (migración sin aplicar) o falla, se sigue igual que antes: sin perfil.
  if (!profile) {
    try {
      const { error } = await supabase.rpc("ensure_own_profile");
      if (!error) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        profile = data as Profile | null;
      }
    } catch {
      /* ensure_own_profile no existe todavía (migración 0019 sin aplicar) o falló: se sigue sin perfil */
    }
  }

  const notice = profile ? getAccountNotice(profile) : null;

  // Módulos habilitados, estado de suscripción y datos de pago (cada consulta degrada sola si la migración 0018 no está aplicada).
  const extras = await loadAccountExtras(supabase, user.id);
  // Un admin ve TODOS los módulos siempre, nunca depende de `user_module_access` (ver `buildModuleAccess`:
  // el default para quien no tiene filas ahí es restrictivo — correcto para un usuario normal, no para un admin).
  const subscription = profile ? getSubscription(profile, extras.hasPendingReceipt) : null;
  const account = { modules: profile?.role === "admin" ? allModulesEnabled() : restrictForUsers(extras.modules), subscription, payment: extras.payment };

  // Ver src/app/auth/impersonate/route.ts: se setea al canjear un magic
  // link generado desde /admin/usuarios/[userId] ("Entrar como este
  // usuario"). Solo es un marcador legible (no la sesión en sí, esa vive
  // en la cookie httpOnly vt_admin_return) para poder mostrar el banner.
  const cookieStore = await cookies();
  const impersonatingEmail = cookieStore.get("vt_impersonating_email")?.value ?? null;

  // Cuenta eliminada por el admin (soft-delete): no entra a nada. Un admin nunca queda fuera.
  if (profile?.deleted_at && profile.role !== "admin") return <AccountRemoved />;

  // Usuario nuevo: el formulario inicial va ANTES que cualquier otra cosa (incluida la pantalla de
  // pago) — primero se presenta (nombre de usuario, datos básicos), recién después se le pide pagar.
  // `onboarding_done === undefined` (migración 0018 sin aplicar) se trata como hecho: nunca se fuerza
  // a nadie a un formulario que no podría guardar.
  if (profile && profile.onboarding_done === false) {
    return (
      <ProfileProvider profile={profile} account={account}>
        <OnboardingWizard userId={user.id} name={profile.display_name ?? profile.full_name ?? sessionUser.name} />
      </ProfileProvider>
    );
  }

  // Suscripción vencida (o bloqueada a mano): en lugar de los módulos, la pantalla de pago. El pago lo confirma un admin A MANO.
  if (profile && subscription?.locked) {
    return (
      <ProfileProvider profile={profile} account={account}>
        <PaymentGate userId={user.id} subscription={subscription} payment={extras.payment} />
      </ProfileProvider>
    );
  }

  return (
    <ProfileProvider profile={profile} account={account}>
      <div className="flex items-start min-h-dvh w-full">
        <UserScopeScript userId={user.id} />
        <HabitSourceBridge />
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
            <ModuleAccessGate>{children}</ModuleAccessGate>
          </div>
        </main>
        <BottomNav />
        <AgentFab />
        <AgentInboxApplier userId={user.id} />
        <AgentNotificationBanner userId={user.id} />
        <DynamicIsland />
        <GuidedTour userId={user.id} autoStart={profile?.tutorial_seen === false} />
        <FirstUseForms />
      </div>
    </ProfileProvider>
  );
}
