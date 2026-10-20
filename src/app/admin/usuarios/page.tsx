import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";
import { UsersTable } from "@/components/admin/users-table";
import { PendingModuleRequests, type ModuleRequestRow } from "@/components/admin/pending-module-requests";

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
    // Solo usuarios normales: un admin no se administra a sí mismo desde acá (nunca se bloquea, nunca
    // necesita módulos habilitados a mano) — ver `getSubscription`.
    supabase.from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    console.error("Admin usuarios: fallo al cargar profiles:", error.message);
  }

  // Pedidos de módulo sin resolver (migración 0019). Si la tabla todavía no existe, la consulta
  // devuelve error y se ignora — el resto de la pantalla sigue funcionando igual.
  const adminId = userData.user?.id ?? "";
  const { data: requestRows } = await supabase
    .from("module_requests")
    .select("id, user_id, module, created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: true });
  const requestUserIds = Array.from(new Set((requestRows ?? []).map((r) => r.user_id)));
  const { data: requestUsers } = requestUserIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", requestUserIds)
    : { data: [] };
  const moduleRequests: ModuleRequestRow[] = (requestRows ?? []).map((r) => {
    const u = requestUsers?.find((x) => x.id === r.user_id);
    return { ...r, email: u?.email ?? null, full_name: u?.full_name ?? null };
  });

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
      <PendingModuleRequests initialRequests={moduleRequests} adminId={adminId} />
      <UsersTable initialUsers={(data ?? []) as Profile[]} adminId={adminId} />
    </div>
  );
}
