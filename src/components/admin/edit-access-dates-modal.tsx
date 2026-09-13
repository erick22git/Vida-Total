"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import type { Profile } from "@/lib/types/profile";

export function EditAccessDatesModal({
  open,
  onClose,
  profile,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSave: (dates: { access_from: string; access_until: string | null }) => Promise<void>;
}) {
  const [accessFrom, setAccessFrom] = useState(profile.access_from);
  const [accessUntil, setAccessUntil] = useState(profile.access_until ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ access_from: accessFrom, access_until: accessUntil.trim() === "" ? null : accessUntil });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Editar vigencia de acceso">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-white/45">
          Define el rango de fechas en que <span className="text-white/70">{profile.email}</span> tiene acceso a la
          app. Deja &quot;Hasta&quot; vacío para acceso indefinido (sin vencimiento).
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/55">Acceso desde</label>
          <GlassInput
            type="date"
            value={accessFrom}
            onChange={(e) => setAccessFrom(e.target.value)}
            className="[color-scheme:dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/55">Acceso hasta (opcional)</label>
          <GlassInput
            type="date"
            value={accessUntil}
            onChange={(e) => setAccessUntil(e.target.value)}
            className="[color-scheme:dark]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <GlassButton type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </GlassButton>
          <GlassButton type="button" size="sm" onClick={handleSave} disabled={saving || !accessFrom}>
            {saving ? "Guardando…" : "Guardar"}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
