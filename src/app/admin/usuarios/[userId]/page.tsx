import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { ModuleToggles } from "@/components/admin/module-toggles";
import { ImpersonateButton } from "@/components/admin/impersonate-button";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { UserAccessSummary } from "@/components/admin/user-access-summary";
import { createClient } from "@/lib/supabase/server";
import { MODULE_KEYS, type ModuleKey, type Profile, type AdminAuditLog } from "@/lib/types/profile";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const [{ data: profile, error: profileError }, { data: moduleRows }, { data: auditRows }, { data: sessionData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_module_access").select("module, enabled").eq("user_id", userId),
      supabase.from("admin_audit_log").select("*").eq("target_user_id", userId).order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);

  if (profileError || !profile) {
    notFound();
  }

  const typedProfile = profile as Profile;

  const enabledMap = MODULE_KEYS.reduce(
    (acc, key) => {
      const row = (moduleRows ?? []).find((r) => r.module === key);
      acc[key] = row ? row.enabled : true;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );

  // Resolver los emails de los admins que aparecen en el historial, para
  // no mostrar solo un UUID en "Por ...".
  const adminIds = Array.from(new Set((auditRows ?? []).map((r) => r.admin_id).filter(Boolean))) as string[];
  const adminEmailMap = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: admins } = await supabase.from("profiles").select("id, email").in("id", adminIds);
    for (const a of admins ?? []) {
      if (a.email) adminEmailMap.set(a.id, a.email);
    }
  }

  const auditEntries = (auditRows ?? []).map((r) => ({
    ...(r as AdminAuditLog),
    admin_email: r.admin_id ? adminEmailMap.get(r.admin_id) ?? null : null,
  }));

  const currentAdminId = sessionData.user?.id ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/75 w-fit">
        <ArrowLeft size={14} />
        Volver a usuarios
      </Link>

      <GlassCard padding="lg" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{typedProfile.full_name || "Sin nombre"}</h1>
            <UserStatusBadge profile={typedProfile} />
            {typedProfile.role === "admin" && (
              <span className="text-[11px] uppercase tracking-wide text-white/40 border border-white/15 rounded-full px-2 py-0.5">
                Admin
              </span>
            )}
          </div>
          <p className="text-sm text-white/45 mt-1">{typedProfile.email ?? "—"}</p>
        </div>
        {currentAdminId && currentAdminId !== typedProfile.id && (
          <ImpersonateButton userId={typedProfile.id} userEmail={typedProfile.email ?? ""} />
        )}
      </GlassCard>

      <UserAccessSummary profile={typedProfile} adminId={currentAdminId} />

      <ModuleToggles
        userId={typedProfile.id}
        adminId={currentAdminId}
        userEmail={typedProfile.email}
        initialEnabled={enabledMap}
      />

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Historial de este usuario</h2>
        <AuditLogList entries={auditEntries} emptyLabel="Sin acciones administrativas registradas para esta cuenta." />
      </div>
    </div>
  );
}
