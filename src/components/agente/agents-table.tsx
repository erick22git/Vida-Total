"use client";

import { useEffect, useState } from "react";
import { AGENTS, AGENT_IDS, DEFAULT_MODEL, CLASSIFIER_MODEL } from "@/lib/agent/agents";
import { levelFor } from "@/lib/agent/config";
import { getTool } from "@/lib/agent/tools/registry";
import { Mascot } from "@/components/agente/mascot";
import { CARD, CHIP } from "@/components/agente/ui";
import { useAgentStore } from "@/lib/store/agentStore";

interface Usage {
  today: { calls: number; rateLimited: number };
  month: { calls: number; rateLimited: number; fallbacks: number };
  byAgentToday: Record<string, number>;
  unavailable?: boolean;
}

const KIND = { read: "lee", write: "escribe", destructive: "borra", config: "config" } as const;
const LEVEL = { ask: "pregunta", allow: "permitida", block: "bloqueada" } as const;

/** Tabla de agentes (herramientas y nivel de cada una) y contador de llamadas al proveedor del modelo. */
export function AgentsTable() {
  const config = useAgentStore((s) => s.config);
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
      .then((u) => !cancelled && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {AGENT_IDS.map((id) => {
        const a = AGENTS[id];
        return (
          <div key={id} className="rounded-[20px] p-3 flex flex-col gap-2" style={{ background: CARD }}>
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ background: "#1c1c1e" }}>
                <Mascot size={36} still costume={a.costume} accent={a.accent} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold">{a.name}</p>
                <p className="text-[11px] text-white/45">
                  {a.chat ? `Modelo: ${a.model ?? DEFAULT_MODEL}` : "Sin chat · lo decide el programador (función pura)"}
                  {a.canDelegate ? " · delega en especialistas" : ""}
                </p>
              </div>
            </div>
            {a.tools.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {a.tools.map((t) => {
                  const meta = getTool(t);
                  const level = levelFor(config, "app", t);
                  return (
                    <li key={t} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate">{meta?.label ?? t}</span>
                      <span className="flex gap-1 shrink-0">
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] text-white/60" style={{ background: CHIP }}>{meta ? KIND[meta.kind] : "—"}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: level === "allow" ? "rgba(52,199,89,0.25)" : level === "block" ? "rgba(229,72,77,0.25)" : CHIP }}>{LEVEL[level]}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-white/45">{a.chat ? "Solo delega." : "No usa herramientas ni modelo."}</p>
            )}
          </div>
        );
      })}
      <div className="rounded-[20px] p-3 text-[12.5px] flex flex-col gap-1" style={{ background: CARD }}>
        <p className="font-extrabold text-[14px]">Llamadas al proveedor del modelo</p>
        {usage ? (
          <>
            <p>
              Hoy: <b>{usage.today.calls}</b> · Últimos 30 días: <b>{usage.month.calls}</b>
            </p>
            <p className="text-white/55">
              Límite alcanzado (429): {usage.month.rateLimited} veces · con modelo de respaldo ({CLASSIFIER_MODEL}): {usage.month.fallbacks}
            </p>
            {usage.unavailable && <p className="text-amber-200/80">Aún no hay contador: falta aplicar la migración 0012.</p>}
          </>
        ) : (
          <p className="text-white/45">Cargando…</p>
        )}
      </div>
    </div>
  );
}
