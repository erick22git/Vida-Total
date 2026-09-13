import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileUserMenu } from "@/components/nav/mobile-user-menu";
import type { SessionUser } from "@/components/nav/user-menu";
import { UserScopeScript } from "@/components/nav/user-scope-script";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="flex items-start min-h-dvh w-full">
      <UserScopeScript userId={user.id} />
      <Sidebar user={sessionUser} />
      <MobileUserMenu user={sessionUser} />
      <main className="flex-1 min-w-0 md:ml-60 lg:ml-64 px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-28 md:pb-12">
        <div className="mx-auto w-full max-w-[900px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
