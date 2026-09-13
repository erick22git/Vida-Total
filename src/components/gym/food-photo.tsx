"use client";

import { Apple } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Displays a food's real Pexels photo when available, falling back to a
 * neutral glass tile with an emoji/icon so the UI works identically with
 * zero downloaded photos or a full set.
 */
export function FoodPhoto({
  photoUrl,
  alt,
  size = 44,
  rounded = "rounded-2xl",
  emoji,
  className,
}: {
  photoUrl?: string | null;
  alt: string;
  size?: number;
  rounded?: string;
  emoji?: string;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local/remote food photos of varying, unregistered hosts
      <img
        src={photoUrl}
        alt={alt}
        width={size}
        height={size}
        className={cn(rounded, "object-cover shrink-0 bg-white/5", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        rounded,
        "flex items-center justify-center shrink-0 bg-white/[0.06] glass-specular-ring text-white/40",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {emoji ?? <Apple size={size * 0.5} />}
    </div>
  );
}
