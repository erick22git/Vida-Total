"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Lock, Unlock, CalendarClock, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { EditAccessDatesModal } from "@/components/admin/edit-access-dates-modal";
import { UserStatusBadge, userStatus } from "@/components/admin/user-status-badge";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import type { Profile } from "@/lib/types/profile";

type StatusFilter = "todos" | "activos" | "bloqueados";

function formatDate(iso: string) {
  try {
    return format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export function UsersTable({ initialUsers, adminId }: { initialUsers: Profile[]; adminId: string }) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [blockTarget, setBlockTarget] = useState<Profile | null>(null);
  const [datesTarget, setDatesTarget] = useState<Profile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matches = (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter === "activos" && userStatus(u).key !== "active") return false;
      if (statusFilter === "bloqueados" && userStatus(u).key === "active") return false;
      return true;
    });
  }, [users, search, statusFilter]);

  async function toggleBlocked(profile: Profile) {
    setBusyId(profile.id);
    const supabase = createClient();
    const nextBlocked = !profile.is_blocked;
    const { error } = await supabase.from("profiles").update({ is_blocked: nextBlocked }).eq("id", profile.id);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === profile.id ? { ...u, is_blocked: nextBlocked } : u)));
      await logAdminAction(supabase, {
        adminId,
        targetUserId: profile.id,
        action: nextBlocked ? AUDIT_ACTIONS.BLOCKED_ACCOUNT : AUDIT_ACTIONS.UNBLOCKED_ACCOUNT,
        details: { email: profile.email, before: profile.is_blocked, after: nextBlocked },
      });
    } else {
      console.error("No se pudo actualizar is_blocked:", error.message);
    }
    setBusyId(null);
    setBlockTarget(null);
  }

  async function saveAccessDates(profile: Profile, dates: { access_from: string; access_until: string | null }) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ access_from: dates.access_from, access_until: dates.access_until })
      .eq("id", profile.id);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === profile.id ? { ...u, ...dates } : u)));
      await logAdminAction(supabase, {
        adminId,
        targetUserId: profile.id,
        action: AUDIT_ACTIONS.UPDATED_ACCESS_DATES,
        details: {
          email: profile.email,
          before: { access_from: profile.access_from, access_until: profile.access_until },
          after: dates,
        },
      });
    } else {
      console.error("No se pudo actualizar las fechas de acceso:", error.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <GlassInput
            icon={<Search size={16} />}
            placeholder="Buscar por email o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "activos", label: "Activos" },
              { key: "bloqueados", label: "Bloqueados" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === opt.key
                  ? "bg-white/[0.1] text-white"
                  : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <GlassCard padding="lg" interactive={false} className="text-center text-white/45 text-sm">
          No se encontraron usuarios con ese criterio.
        </GlassCard>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((profile) => (
          <GlassCard key={profile.id} padding="md" interactive={false} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">
                    {profile.full_name || "Sin nombre"}
                  </span>
                  <UserStatusBadge profile={profile} />
                </div>
                <div className="text-xs text-white/45 truncate mt-0.5">{profile.email ?? "—"}</div>
                <div className="text-[11px] text-white/35 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Registrado: {formatDateTime(profile.created_at)}</span>
                  <span>
                    Acceso: {formatDate(profile.access_from)} →{" "}
                    {profile.access_until ? formatDate(profile.access_until) : "Sin vencimiento"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <GlassButton
                  type="button"
                  size="sm"
                  variant="outline"
                  accentColor="var(--habitos)"
                  onClick={() => setDatesTarget(profile)}
                >
                  <CalendarClock size={14} />
                  Fechas
                </GlassButton>
                <GlassButton
                  type="button"
                  size="sm"
                  variant="outline"
                  accentColor={profile.is_blocked ? "#22c55e" : "var(--gym-2)"}
                  disabled={busyId === profile.id}
                  onClick={() => {
                    if (profile.is_blocked) {
                      // Desbloquear no necesita confirmación extra.
                      void toggleBlocked(profile);
                    } else {
                      setBlockTarget(profile);
                    }
                  }}
                >
                  {profile.is_blocked ? <Unlock size={14} /> : <Lock size={14} />}
                  {profile.is_blocked ? "Desbloquear" : "Bloquear"}
                </GlassButton>
                <Link href={`/admin/usuarios/${profile.id}`}>
                  <GlassButton type="button" size="sm">
                    Ver detalle
                    <ChevronRight size={14} />
                  </GlassButton>
                </Link>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {blockTarget && (
        <ConfirmModal
          open={!!blockTarget}
          onClose={() => setBlockTarget(null)}
          onConfirm={() => toggleBlocked(blockTarget)}
          title="Bloquear cuenta"
          message={`¿Bloquear el acceso de ${blockTarget.email}? Se mostrará un aviso en su cuenta indicando que tiene un pago pendiente. Esto no borra sus datos.`}
          confirmLabel="Bloquear"
          danger
          loading={busyId === blockTarget.id}
        />
      )}

      {datesTarget && (
        <EditAccessDatesModal
          open={!!datesTarget}
          onClose={() => setDatesTarget(null)}
          profile={datesTarget}
          onSave={(dates) => saveAccessDates(datesTarget, dates)}
        />
      )}
    </div>
  );
}
