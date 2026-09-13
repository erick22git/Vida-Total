"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, List, Search, ScanLine, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const METHODS = [
  { key: "recetas", label: "Recetas", href: "/gym/calorias/recetas", icon: BookOpen },
  { key: "lista", label: "Lista", href: "/gym/calorias/lista", icon: List },
  { key: "buscar", label: "Buscar", href: "/gym/calorias/buscar", icon: Search },
  { key: "escaner", label: "Escáner", href: "/gym/calorias/escaner", icon: ScanLine },
  { key: "voz", label: "Voz", href: "/gym/calorias/voz", icon: Mic },
] as const;

/** Floating pill nav shared by the 5 food-logging methods, so users can switch
 * between them without returning to the dashboard first.
 *
 * `variant="fixed"` renders it pinned to the bottom of the viewport (as a
 * toolbar, above the global BottomNav) instead of the default sticky-top
 * placement — used by the "Lista" capture step, which needs the vertical
 * space above for its per-meal blocks. */
export function CaloriasMethodNav({ variant = "sticky" }: { variant?: "sticky" | "fixed" }) {
  const pathname = usePathname();

  const pillRow = (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.06] glass-specular-ring p-1 overflow-x-auto no-scrollbar">
      {METHODS.map(({ key, label, href, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs md:text-sm font-medium whitespace-nowrap transition-all shrink-0",
              active ? "text-white" : "text-white/50 hover:text-white/80",
            )}
            style={
              active
                ? {
                    background: "linear-gradient(135deg, var(--gym), var(--gym)CC)",
                    boxShadow: "0 2px 12px var(--gym)55",
                  }
                : undefined
            }
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </div>
  );

  if (variant === "fixed") {
    return (
      <nav className="fixed bottom-20 md:bottom-6 left-0 right-0 z-30 px-4 py-3 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        {pillRow}
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-2 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_75%,transparent)]">
      {pillRow}
    </nav>
  );
}
