"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface GlassButtonProps extends HTMLMotionProps<"button"> {
  accentColor?: string;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const sizeMap: Record<NonNullable<GlassButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm rounded-xl min-h-[38px]",
  md: "px-5 py-2.5 text-sm md:text-base rounded-2xl min-h-[44px]",
  lg: "px-7 py-3.5 text-base md:text-lg rounded-2xl min-h-[48px]",
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      className,
      accentColor = "var(--gym)",
      variant = "solid",
      size = "md",
      style,
      ...props
    },
    ref,
  ) => {
    const baseStyle: Record<string, string | number | undefined> = {
      ...(style as Record<string, string | number | undefined> | undefined),
    };
    if (variant === "solid") {
      baseStyle.background = `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`;
      baseStyle.boxShadow = `0 4px 20px ${accentColor}55, inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -1px 1px rgba(0,0,0,0.2)`;
    } else if (variant === "outline") {
      baseStyle.color = accentColor;
      baseStyle.background = "rgba(255,255,255,0.04)";
      baseStyle.boxShadow = `var(--glass-specular), inset 0 0 0 1px ${accentColor}55`;
    } else {
      baseStyle.background = "rgba(255,255,255,0.06)";
      baseStyle.boxShadow = "var(--glass-specular)";
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.03, filter: "brightness(1.08)" }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={cn(
          "font-medium text-white backdrop-blur-md inline-flex items-center justify-center gap-2 transition-shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
          sizeMap[size],
          className,
        )}
        style={baseStyle as React.CSSProperties}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);
GlassButton.displayName = "GlassButton";
