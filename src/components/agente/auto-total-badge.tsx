"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { autoTotalRemainingMs, isAutoTotalActive } from "@/lib/agent/config";
import { getAgentSessionId, useAgentStore } from "@/lib/store/agentStore";

/** ¿Está vigente el Auto total ahora mismo? Se re-evalúa cada 20 s para que caduque a la vista. */
export function useAutoTotalActive(): { active: boolean; remainingMs: number | null } {
  const config = useAgentStore((s) => s.config);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!config.autoTotal) return;
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [config.autoTotal]);
  const active = !config.killSwitch && isAutoTotalActive(config, now, getAgentSessionId());
  return { active, remainingMs: active ? autoTotalRemainingMs(config, now) : null };
}

/**
 * Insignia PERMANENTE de "Auto total" para la mascota/botón del agente, con botón de apagado inmediato. No se renderiza
 * nada cuando no está activo.
 */
export function AutoTotalBadge({ className = "" }: { className?: string }) {
  const { active, remainingMs } = useAutoTotalActive();
  const stop = useAgentStore((s) => s.stopAutoTotal);
  if (!active) return null;
  const mins = remainingMs === null ? null : Math.ceil(remainingMs / 60_000);
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-red-500/90 text-white pl-2 pr-1 py-1 text-[11px] font-semibold shadow-lg ${className}`} role="status" aria-label="Auto total activo">
      <Zap size={12} aria-hidden />
      <span>AUTO TOTAL{mins !== null ? ` · ${mins} min` : ""}</span>
      <button onClick={stop} className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] cursor-pointer" aria-label="Apagar Auto total ahora">
        Apagar
      </button>
    </div>
  );
}
