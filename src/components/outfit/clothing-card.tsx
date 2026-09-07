"use client";

import { GlassCard } from "@/components/glass/glass-card";
import { CATEGORY_ICONS } from "@/lib/outfit-utils";
import type { ClothingItem } from "@/lib/types/outfit";

export function ClothingCard({
  item,
  onClick,
}: {
  item: ClothingItem;
  onClick?: () => void;
}) {
  const Icon = CATEGORY_ICONS[item.category];
  return (
    <GlassCard
      padding="sm"
      accentColor="var(--outfit)"
      onClick={onClick}
      className="flex flex-col gap-2 cursor-pointer"
    >
      <div
        className="w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ background: "var(--outfit)14" }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Icon size={28} style={{ color: "var(--outfit)" }} />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-white truncate">{item.name}</p>
        <p className="text-xs text-white/45">usada {item.timesWorn} veces</p>
      </div>
    </GlassCard>
  );
}
