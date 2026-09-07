"use client";

import { motion } from "framer-motion";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/outfit-utils";
import type { ClothingCategory, ClothingItem } from "@/lib/types/outfit";

export function MannequinSlot({
  category,
  item,
  className,
}: {
  category: ClothingCategory;
  item?: ClothingItem;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <motion.div
      layout
      className={`flex flex-col items-center gap-1.5 ${className ?? ""}`}
    >
      <div
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex items-center justify-center border"
        style={{
          background: item ? "var(--outfit)1F" : "rgba(255,255,255,0.04)",
          borderColor: item ? "var(--outfit)66" : "rgba(255,255,255,0.12)",
        }}
      >
        {item?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Icon size={26} style={{ color: item ? "var(--outfit)" : "rgba(255,255,255,0.25)" }} />
        )}
      </div>
      <span className="text-[11px] text-white/50 text-center max-w-[6rem] truncate">
        {item?.name ?? CATEGORY_LABELS[category]}
      </span>
    </motion.div>
  );
}
