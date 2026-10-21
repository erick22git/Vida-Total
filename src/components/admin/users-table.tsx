"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Lock, Unlock, CalendarClock, ChevronRight, Trash2, RotateCcw } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { EditAccessDatesModal } from "@/components/admin/edit-access-dates-modal";
import { UserStatusBadge, userStatus } from "@/components/admin/user-status-badge";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import { purgeAccount, restoreAccount } from "@/lib/admin/accounts";
import type { Profile } from "@/lib/types/profile";

type StatusFilter = "todos" | "activos" | "porcobrar" | "bloqueados" | "eliminados";

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

export function UsersTable({ initialUsers, adminId, pendingUserIds = [] }: { initialUsers: Profile[]; adminId: string; pendingUserIds?: string[] }) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [blockTarget, setBlockTarget] = useState<Profile | null>(null);
  const [datesTarget, setDatesTarget] = useState<Profile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Profile | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = useMemo(() => new Set(pendingUserIds), [pendingUserIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matches = (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      const key = userStatus(u, pending.has(u.id)).key;
      if (statusFilter === "eliminados") return key === "deleted";
      if (key === "deleted") return false; // las eliminadas solo se ven en su pestaña
      if (statusFilter === "activos") return key === "active";
      if (statusFilter === "porcobrar") return key === "new" || key === "pending" || key === "expired";
      if (statusFilter === "bloqueados") return key === "blocked";
      return true;
    });
  }, [users, search, statusFilter, pending]);

  async function restore(profile: Profile) {
    setBusyId(profile.id);
    setActionError(null);
    const res = await restoreAccount(createClient(), { adminId, userId: profile.id, email: profile.email });
    if (res.ok) setUsers((prev) => prev.map((u) => (u.id === profile.id ? { ...u, deleted_at: null, is_blocked: false } : u)));
    else setActionError(res.error);
    setBusyId(null);
  }

  async function purge(profile: Profile) {
    setBusyId(profile.id);
    setActionError(null);
    const res = await purgeAccount(profile.id);
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== profile.id));
    else setActionError(res.error);
    setBusyId(null);
    setPurgeTarget(null);
  }

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
              { key: "porcobrar", label: "Por cobrar" },
              { key: "bloqueados", label: "Bloqueados" },
              { key: "eliminados", label: "Eliminados" },
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

      {actionError && <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{actionError}</div>}

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
                  <UserStatusBadge profile={profile} hasPendingReceipt={pending.has(profile.id)} />
                </div>
                <div className="text-xs text-white/45 truncate mt-0.5">{profile.email ?? "—"}</div>
                <div className="text-[11px] text-white/35 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Registrado: {formatDateTime(profile.created_at)}</span>
                  <span>
                    Acceso: {formatDate(profile.access_from)} →{" "}
                    {profile.access_until ? formatDate(profile.access_until) : "Sin vencimiento"}
                  </span>
                  {profile.login_count !== undefined && (
                    <span>
                      Entró {profile.login_count} {profile.login_count === 1 ? "vez" : "veces"}
                      {profile.last_login_at ? ` · última: ${formatDateTime(profile.last_login_at)}` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {profile.deleted_at ? (
                  <>
                    <GlassButton type="button" size="sm" variant="outline" accentColor="#22c55e" disabled={busyId === profile.id} onClick={() => void restore(profile)}>
                      <RotateCcw size={14} />
                      Restaurar
                    </GlassButton>
                    <GlassButton type="button" size="sm" variant="outline" accentColor="#ff3b3b" disabled={busyId === profile.id} onClick={() => setPurgeTarget(profile)}>
                      <Trash2 size={14} />
                      Borrar definitivamente
                    </GlassButton>
                  </>
                ) : (
                  <>
                    <GlassButton type="button" size="sm" variant="outline" accentColor="var(--habitos)" onClick={() => setDatesTarget(profile)}>
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
                    <GlassButton type="button" size="sm" variant="outline" accentColor="#ff3b3b" disabled={busyId === profile.id} onClick={() => setDeleteTarget(profile)}>
                      <Trash2 size={14} />
                      Eliminar
                    </GlassButton>
                  </>
                )}
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

      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await purge(deleteTarget);
            setDeleteTarget(null);
          }}
          title="Eliminar cuenta"
          message={`¿Eliminar la cuenta de ${deleteTarget.email}? Se borra la cuenta y TODO lo suyo (comidas, entrenamientos, hábitos, comprobantes…) y no se puede deshacer. Si esa persona vuelve a entrar con el mismo correo, empieza como un usuario nuevo: sin datos, sin plan y con el pago pendiente.`}
          confirmLabel="Eliminar para siempre"
          danger
          loading={busyId === deleteTarget.id}
        />
      )}

      {purgeTarget && (
        <ConfirmModal
          open={!!purgeTarget}
          onClose={() => setPurgeTarget(null)}
          onConfirm={() => purge(purgeTarget)}
          title="Borrar definitivamente"
          message={`Esto BORRA PARA SIEMPRE la cuenta de ${purgeTarget.email} y todo lo suyo (comidas, entrenamientos, hábitos, comprobantes…). No se puede deshacer.`}
          confirmLabel="Borrar para siempre"
          danger
          loading={busyId === purgeTarget.id}
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
