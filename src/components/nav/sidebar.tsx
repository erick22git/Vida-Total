"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MODULES } from "@/lib/constants";
import { ICON_MAP } from "./icon-map";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 lg:w-64 shrink-0 p-4 z-40">
      <div className="glass-surface rounded-3xl flex flex-col h-full p-4">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <Sparkles size={22} className="text-white" />
          <span className="text-lg font-semibold tracking-tight">Vida Total</span>
        </div>

        <nav className="flex flex-col gap-1">
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const active = isActive(pathname, mod.href);
            const color = `var(${mod.color})`;
            return (
              <Link key={mod.id} href={mod.href} className="relative">
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: `${color}1F`,
                      boxShadow: `inset 0 0 0 1px ${color}55, 0 0 20px ${color}33`,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-2xl">
                  <Icon
                    size={19}
                    style={{ color: active ? color : "rgba(255,255,255,0.55)" }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: active ? "white" : "rgba(255,255,255,0.6)" }}
                  >
                    {mod.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-2 py-3 text-[11px] text-white/35">
          Vida Total © 2026
        </div>
      </div>
    </aside>
  );
}
