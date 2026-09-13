import Link from "next/link";
import { Users, ShieldAlert, UserCheck, ScrollText } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/server";

async function loadStats() {
  const supabase = await createClient();

  const [{ count: total }, { count: bloqueados }, { count: admins }, { data: ultimaAuditoria }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_blocked", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("admin_audit_log").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  return {
    total: total ?? 0,
    bloqueados: bloqueados ?? 0,
    activos: (total ?? 0) - (bloqueados ?? 0),
    admins: admins ?? 0,
    ultimaAccion: ultimaAuditoria?.[0]?.created_at ?? null,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <GlassCard padding="lg" className="flex items-center gap-4" interactive={false}>
      <div
        className="flex items-center justify-center w-12 h-12 rounded-2xl shrink-0"
        style={{ background: `${color}22` }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-white leading-tight">{value}</div>
        <div className="text-xs text-white/45 truncate">{label}</div>
      </div>
    </GlassCard>
  );
}

export default async function AdminDashboardPage() {
  const stats = await loadStats();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-white">Resumen</h1>
        <p className="text-sm text-white/45 mt-1">Estado general de las cuentas de Vida Total.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Usuarios totales" value={stats.total} color="var(--habitos)" />
        <StatCard icon={UserCheck} label="Cuentas activas" value={stats.activos} color="var(--paz-mental)" />
        <StatCard icon={ShieldAlert} label="Cuentas bloqueadas" value={stats.bloqueados} color="var(--gym-2)" />
        <StatCard icon={ScrollText} label="Administradores" value={stats.admins} color="var(--finanzas)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/usuarios">
          <GlassCard padding="lg" accentColor="var(--habitos)">
            <div className="flex items-center gap-3">
              <Users size={20} style={{ color: "var(--habitos)" }} />
              <div>
                <div className="text-sm font-semibold text-white">Gestión de usuarios</div>
                <div className="text-xs text-white/45 mt-0.5">
                  Buscar cuentas, bloquear/desbloquear, editar vigencia de acceso y módulos habilitados.
                </div>
              </div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/admin/auditoria">
          <GlassCard padding="lg" accentColor="var(--finanzas)">
            <div className="flex items-center gap-3">
              <ScrollText size={20} style={{ color: "var(--finanzas)" }} />
              <div>
                <div className="text-sm font-semibold text-white">Auditoría</div>
                <div className="text-xs text-white/45 mt-0.5">
                  Historial completo de acciones administrativas sobre cuentas de usuario.
                </div>
              </div>
            </div>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
