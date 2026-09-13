"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Users, ScrollText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, exact: false },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, exact: false },
];

export function AdminHeader({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <header className="w-full glass-surface rounded-none border-x-0 border-t-0 sticky top-0 z-30">
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 md:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-2xl shrink-0"
            style={{ background: "color-mix(in srgb, var(--gym) 18%, transparent)" }}
          >
            <ShieldCheck size={18} style={{ color: "var(--gym)" }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">Panel de Administrador</div>
            <div className="text-[11px] text-white/40 truncate">{adminName}</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shrink-0",
                  active ? "bg-white/[0.09] text-white" : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]",
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-colors shrink-0 ml-1 border-l border-white/10 pl-3"
          >
            <ArrowLeft size={15} />
            Volver a la app
          </Link>
        </nav>
      </div>
    </header>
  );
}
