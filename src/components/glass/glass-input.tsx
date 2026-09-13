"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            // text-base (16px) en todos los viewports — por debajo de 16px,
            // Safari/Chrome móvil hacen auto-zoom al enfocar el input.
            "w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-base text-white placeholder:text-white/35 outline-none transition-all focus:bg-white/[0.09] focus:shadow-[var(--glass-specular-strong)]",
            icon ? "pl-10" : "",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
GlassInput.displayName = "GlassInput";
