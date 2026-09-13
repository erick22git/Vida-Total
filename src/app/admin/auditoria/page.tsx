import { AuditLogList } from "@/components/admin/audit-log-list";
import { createClient } from "@/lib/supabase/server";
import type { AdminAuditLog } from "@/lib/types/profile";

const LIMIT = 200;

export default async function AdminAuditoriaPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("Admin auditoría: fallo al cargar admin_audit_log:", error.message);
  }

  const entries = (rows ?? []) as AdminAuditLog[];

  const ids = Array.from(
    new Set(entries.flatMap((e) => [e.admin_id, e.target_user_id]).filter((v): v is string => !!v)),
  );
  const emailMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", ids);
    for (const p of profiles ?? []) {
      if (p.email) emailMap.set(p.id, p.email);
    }
  }

  const enriched = entries.map((e) => ({
    ...e,
    admin_email: e.admin_id ? emailMap.get(e.admin_id) ?? null : null,
    target_email: e.target_user_id ? emailMap.get(e.target_user_id) ?? null : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-white">Auditoría</h1>
        <p className="text-sm text-white/45 mt-1">
          Últimas {entries.length} acciones administrativas{entries.length === LIMIT ? " (límite de la vista)" : ""}.
        </p>
      </div>
      <AuditLogList entries={enriched} showTargetEmail emptyLabel="Todavía no hay acciones administrativas registradas." />
    </div>
  );
}
