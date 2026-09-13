"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Lock, Unlock } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { EditAccessDatesModal } from "@/components/admin/edit-access-dates-modal";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, AUDIT_ACTIONS } from "@/lib/admin/audit";
import type { Profile } from "@/lib/types/profile";

function formatDate(iso: string) {
  try {
    return format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

/** Fechas de vigencia + bloqueo/desbloqueo, en la vista de detalle de un usuario. */
export function UserAccessSummary({ profile: initialProfile, adminId }: { profile: Profile; adminId: string }) {
  const [profile, setProfile] = useState(initialProfile);
  const [datesOpen, setDatesOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleBlocked() {
    setBusy(true);
    const supabase = createClient();
    const nextBlocked = !profile.is_blocked;
    const { error } = await supabase.from("profiles").update({ is_blocked: nextBlocked }).eq("id", profile.id);
    if (!error) {
      setProfile((p) => ({ ...p, is_blocked: nextBlocked }));
      await logAdminAction(supabase, {
        adminId,
        targetUserId: profile.id,
        action: nextBlocked ? AUDIT_ACTIONS.BLOCKED_ACCOUNT : AUDIT_ACTIONS.UNBLOCKED_ACCOUNT,
        details: { email: profile.email, before: profile.is_blocked, after: nextBlocked },
      });
    } else {
      console.error("No se pudo actualizar is_blocked:", error.message);
    }
    setBusy(false);
    setBlockConfirmOpen(false);
  }

  async function saveDates(dates: { access_from: string; access_until: string | null }) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ access_from: dates.access_from, access_until: dates.access_until })
      .eq("id", profile.id);
    if (!error) {
      const before = { access_from: profile.access_from, access_until: profile.access_until };
      setProfile((p) => ({ ...p, ...dates }));
      await logAdminAction(supabase, {
        adminId,
        targetUserId: profile.id,
        action: AUDIT_ACTIONS.UPDATED_ACCESS_DATES,
        details: { email: profile.email, before, after: dates },
      });
    } else {
      console.error("No se pudo actualizar las fechas de acceso:", error.message);
    }
  }

  return (
    <GlassCard padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Vigencia de acceso</h2>
        <p className="text-sm text-white/60">
          {formatDate(profile.access_from)} →{" "}
          {profile.access_until ? formatDate(profile.access_until) : "Sin vencimiento"}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <GlassButton type="button" size="sm" variant="outline" accentColor="var(--habitos)" onClick={() => setDatesOpen(true)}>
          <CalendarClock size={14} />
          Editar fechas
        </GlassButton>
        <GlassButton
          type="button"
          size="sm"
          variant="outline"
          accentColor={profile.is_blocked ? "#22c55e" : "var(--gym-2)"}
          disabled={busy}
          onClick={() => (profile.is_blocked ? toggleBlocked() : setBlockConfirmOpen(true))}
        >
          {profile.is_blocked ? <Unlock size={14} /> : <Lock size={14} />}
          {profile.is_blocked ? "Desbloquear" : "Bloquear"}
        </GlassButton>
      </div>

      <EditAccessDatesModal open={datesOpen} onClose={() => setDatesOpen(false)} profile={profile} onSave={saveDates} />

      <ConfirmModal
        open={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        onConfirm={toggleBlocked}
        title="Bloquear cuenta"
        message={`¿Bloquear el acceso de ${profile.email}? Se mostrará un aviso en su cuenta indicando que tiene un pago pendiente. Esto no borra sus datos.`}
        confirmLabel="Bloquear"
        danger
        loading={busy}
      />
    </GlassCard>
  );
}
