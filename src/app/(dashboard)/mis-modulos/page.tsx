"use client";

import Link from "next/link";
import { ChevronRight, Lock, Flame, Droplets, Dumbbell, Sparkles, CalendarCheck2, Shirt, Leaf, Wallet, Mic, type LucideIcon } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { DarkCard } from "@/components/agente/ui";
import { RequestAccessButton } from "@/components/account/request-access-button";
import { useAccount, useProfile } from "@/components/providers/profile-provider";
import { MODULE_CATALOG, type ModuleCatalogEntry } from "@/lib/account/module-catalog";
import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";
import { USER_MODULE_KEYS } from "@/lib/account/module-catalog";

const ICONS: Record<ModuleCatalogEntry["icon"], LucideIcon> = { Flame, Droplets, Dumbbell, Sparkles, CalendarCheck2, Shirt, Leaf, Wallet, Mic };

/**
 * Pantalla de entrada de un usuario normal (no hay Home genérico): de un vistazo, qué módulos tiene habilitados (entra directo
 * con un toque) y cuáles no (con "Pedir acceso"). Cada módulo es independiente; el estado sale de `account.modules`, que el
 * layout calcula por usuario desde `user_module_access` (un admin ve todo).
 */
export default function MisModulosPage() {
  const profile = useProfile();
  const { modules } = useAccount();
  const name = profile?.display_name || profile?.full_name?.split(" ")[0] || null;

  // Un usuario normal solo ve los módulos disponibles hoy; los que están en mantenimiento no aparecen ni como "no habilitados".
  const visibleKeys = profile?.role === "admin" ? MODULE_KEYS : USER_MODULE_KEYS;
  const enabled = visibleKeys.filter((k) => modules[k]);
  const locked = visibleKeys.filter((k) => !modules[k]);

  return (
    <div className="flex flex-col gap-6 max-w-[640px] mx-auto">
      <header className="flex items-center gap-3 pt-2">
        <Mascot mood="happy" size={64} />
        <div>
          <h1 className="text-xl font-extrabold leading-tight">¡Hola{name ? `, ${name}` : ""}!</h1>
          <p className="text-sm text-white/55">
            {enabled.length > 0 ? "Estos son tus módulos." : "Todavía no tenés módulos habilitados."}
          </p>
        </div>
      </header>

      {enabled.length === 0 && (
        <DarkCard className="flex flex-col gap-1">
          <p className="text-[15px] font-extrabold">Esperando al administrador</p>
          <p className="text-sm text-white/60">El administrador va a habilitarte los módulos que te correspondan. Mientras tanto podés pedir acceso a los que quieras desde acá abajo.</p>
        </DarkCard>
      )}

      {enabled.length > 0 && (
        <section aria-label="Módulos habilitados" className="flex flex-col gap-2.5">
          {enabled.map((key) => (
            <ModuleRow key={key} moduleKey={key} />
          ))}
        </section>
      )}

      {locked.length > 0 && (
        <section aria-label="Módulos no habilitados" className="flex flex-col gap-2.5">
          <h2 className="text-[13px] uppercase tracking-[0.12em] text-white/45">No habilitados</h2>
          {locked.map((key) => (
            <LockedRow key={key} moduleKey={key} />
          ))}
        </section>
      )}
    </div>
  );
}

function ModuleRow({ moduleKey }: { moduleKey: ModuleKey }) {
  const m = MODULE_CATALOG[moduleKey];
  const Icon = ICONS[m.icon];
  return (
    <Link href={m.href} className="flex items-center gap-3 rounded-[22px] px-4 min-h-[64px]" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Icon size={22} style={{ color: m.color }} className="shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-extrabold">{m.label}</span>
        <span className="block text-xs text-white/50 truncate">{m.description}</span>
      </span>
      <ChevronRight size={18} className="text-white/45 shrink-0" />
    </Link>
  );
}

function LockedRow({ moduleKey }: { moduleKey: ModuleKey }) {
  const m = MODULE_CATALOG[moduleKey];
  const Icon = ICONS[m.icon];
  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] px-4 py-3" style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-3 opacity-60">
        <Icon size={20} className="text-white/60 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold">{m.label}</span>
          <span className="block text-xs text-white/50 truncate">{m.description}</span>
        </span>
        <Lock size={15} className="text-white/45 shrink-0" />
      </div>
      <RequestAccessButton moduleKey={moduleKey} />
    </div>
  );
}
