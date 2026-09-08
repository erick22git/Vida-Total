"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BOTTOM_NAV_MODULES } from "@/lib/constants";
import { ICON_MAP } from "./icon-map";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1">
      <div
        className="glass-surface rounded-3xl flex items-center justify-between px-1.5 py-2"
        style={{ background: "color-mix(in srgb, var(--background) 88%, transparent)" }}
      >
        {BOTTOM_NAV_MODULES.map((mod) => {
          const Icon = ICON_MAP[mod.icon];
          const active = isActive(pathname, mod.href);
          const color = `var(${mod.color})`;
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl"
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: `${color}22`,
                    boxShadow: `0 0 16px ${color}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={20}
                className="relative z-10"
                style={{ color: active ? color : "rgba(255,255,255,0.5)" }}
              />
              <span
                className="relative z-10 text-[10px] font-medium"
                style={{ color: active ? color : "rgba(255,255,255,0.45)" }}
              >
                {mod.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
