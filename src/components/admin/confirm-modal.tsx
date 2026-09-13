"use client";

import { AlertTriangle } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <GlassModal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />}
          <p className="text-sm text-white/70">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <GlassButton type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </GlassButton>
          <GlassButton
            type="button"
            size="sm"
            accentColor={danger ? "var(--gym-2)" : "var(--gym)"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando…" : confirmLabel}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
