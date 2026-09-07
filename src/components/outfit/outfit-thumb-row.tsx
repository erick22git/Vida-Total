"use client";

import { Shirt } from "lucide-react";
import { useOutfitStore } from "@/lib/store/outfitStore";

export function OutfitThumbRow({ outfitId, size = 32 }: { outfitId: string; size?: number }) {
  const clothingItems = useOutfitStore((s) => s.clothingItems);
  const outfit = useOutfitStore((s) => s.outfits.find((o) => o.id === outfitId));

  if (!outfit) return null;
  const items = outfit.itemIds
    .map((id) => clothingItems.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="flex items-center -space-x-2">
      {items.slice(0, 4).map((item) => (
        <div
          key={item.id}
          className="rounded-full overflow-hidden border-2 border-[var(--background-2)] flex items-center justify-center shrink-0"
          style={{ width: size, height: size, background: "var(--outfit)22" }}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Shirt size={size * 0.5} style={{ color: "var(--outfit)" }} />
          )}
        </div>
      ))}
    </div>
  );
}
