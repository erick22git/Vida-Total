"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends HTMLMotionProps<"div"> {
  accentColor?: string; // css var, e.g. "var(--gym)"
  glow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const paddingMap: Record<NonNullable<GlassCardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      accentColor,
      glow = false,
      padding = "md",
      interactive = true,
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        whileHover={interactive ? { scale: 1.012, filter: "brightness(1.06)" } : undefined}
        whileTap={interactive ? { scale: 0.995 } : undefined}
        className={cn(
          "glass-surface rounded-3xl relative",
          paddingMap[padding],
          className,
        )}
        style={{
          boxShadow:
            glow && accentColor
              ? `0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 var(--glass-highlight), 0 0 40px ${accentColor}33`
              : undefined,
          borderColor: accentColor ? `${accentColor}40` : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
GlassCard.displayName = "GlassCard";
