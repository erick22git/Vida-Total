"use client";

import { Pencil, Trash2 } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassBadge } from "@/components/glass/glass-badge";
import { CATEGORY_ICONS, CATEGORY_LABELS, SEASON_LABELS } from "@/lib/outfit-utils";
import type { ClothingItem } from "@/lib/types/outfit";

export function ClothingDetailModal({
  open,
  onClose,
  item,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  item: ClothingItem | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!item) return null;
  const Icon = CATEGORY_ICONS[item.category];
  const costPerUse =
    item.cost != null && item.timesWorn > 0 ? item.cost / item.timesWorn : undefined;

  return (
    <GlassModal open={open} onClose={onClose} title={item.name}>
      <div className="flex flex-col gap-4">
        <div
          className="w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: "var(--outfit)14" }}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Icon size={40} style={{ color: "var(--outfit)" }} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GlassBadge color="var(--outfit)">{CATEGORY_LABELS[item.category]}</GlassBadge>
          <GlassBadge color="var(--outfit)">{SEASON_LABELS[item.season]}</GlassBadge>
          <span
            className="w-5 h-5 rounded-full border border-white/25"
            style={{ background: item.color }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-white/45 text-xs">Usada</span>
            <span className="text-white font-medium">{item.timesWorn} veces</span>
          </div>
          {item.lastWorn && (
            <div className="flex flex-col gap-0.5">
              <span className="text-white/45 text-xs">Última vez</span>
              <span className="text-white font-medium">{item.lastWorn}</span>
            </div>
          )}
          {item.cost != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-white/45 text-xs">Costo</span>
              <span className="text-white font-medium">${item.cost.toFixed(2)}</span>
            </div>
          )}
          {costPerUse != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-white/45 text-xs">Costo por uso</span>
              <span className="text-white font-medium">${costPerUse.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <GlassButton accentColor="var(--outfit)" variant="outline" onClick={onEdit} className="flex-1">
            <Pencil size={15} /> Editar
          </GlassButton>
          <GlassButton accentColor="#ef4444" variant="outline" onClick={onDelete} className="flex-1">
            <Trash2 size={15} /> Eliminar
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
