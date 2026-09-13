"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { OutfitThumbRow } from "@/components/outfit/outfit-thumb-row";
import { OCCASION_LABELS } from "@/lib/outfit-utils";
import { useOutfitStore } from "@/lib/store/outfitStore";

export function DayOutfitModal({
  open,
  onClose,
  dayLabel,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  dayLabel: string;
  onSelect: (outfitId: string) => void;
}) {
  const outfits = useOutfitStore((s) => s.outfits);

  return (
    <GlassModal open={open} onClose={onClose} title={`Outfit para ${dayLabel}`}>
      <div className="flex flex-col gap-3">
        {outfits.length === 0 ? (
          <p className="text-sm text-white/45 text-center py-6">
            Aún no tienes outfits guardados.
          </p>
        ) : (
          outfits.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                onSelect(o.id);
                onClose();
              }}
              className="flex items-center gap-3 rounded-2xl glass-specular-ring bg-white/[0.04] px-3 py-2.5 cursor-pointer hover:bg-white/[0.08] transition-colors text-left"
            >
              <OutfitThumbRow outfitId={o.id} size={30} />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{o.name}</span>
                <span className="text-xs text-white/45">{OCCASION_LABELS[o.occasion]}</span>
              </div>
            </button>
          ))
        )}

        <Link
          href="/outfit/crear"
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-3 text-sm font-medium cursor-pointer transition-colors"
          style={{ color: "var(--outfit)" }}
        >
          <PlusCircle size={16} /> Crear un outfit nuevo
        </Link>
      </div>
    </GlassModal>
  );
}
