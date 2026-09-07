"use client";

import { Check } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import type { SetType } from "@/lib/types";
import { SET_TYPE_META, SET_TYPES } from "@/components/gym/set-type";

export function SetTypeModal({
  open,
  onClose,
  value,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: SetType;
  onSelect: (type: SetType) => void;
}) {
  return (
    <GlassModal open={open} onClose={onClose} title="Seleccionar Tipo de Serie">
      <div className="flex flex-col gap-2">
        {SET_TYPES.map((type) => {
          const meta = SET_TYPE_META[type];
          const active = value === type;
          return (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer"
              style={{
                background: active ? `${meta.color}1f` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? meta.color : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0"
                style={{ background: `${meta.color}33`, color: meta.color, border: `1px solid ${meta.color}66` }}
              >
                {meta.short}
              </span>
              <span className="flex-1 text-sm font-medium text-white">{meta.label}</span>
              {active && <Check size={16} style={{ color: meta.color }} />}
            </button>
          );
        })}
      </div>
    </GlassModal>
  );
}
