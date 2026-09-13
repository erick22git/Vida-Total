import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";
import { UsersTable } from "@/components/admin/users-table";

const IMPERSONATE_ERROR_MESSAGES: Record<string, string> = {
  impersonate_missing_token: "El enlace de impersonación no incluía la información necesaria. Intenta de nuevo.",
  impersonate_failed: "No se pudo verificar el enlace de impersonación (puede haber expirado). Intenta de nuevo.",
};

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorParam } = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: userData }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    console.error("Admin usuarios: fallo al cargar profiles:", error.message);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-white">Usuarios</h1>
        <p className="text-sm text-white/45 mt-1">{(data ?? []).length} cuentas registradas.</p>
      </div>
      {errorParam && IMPERSONATE_ERROR_MESSAGES[errorParam] && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {IMPERSONATE_ERROR_MESSAGES[errorParam]}
        </div>
      )}
      <UsersTable initialUsers={(data ?? []) as Profile[]} adminId={userData.user?.id ?? ""} />
    </div>
  );
}
