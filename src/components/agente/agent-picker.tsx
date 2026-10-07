"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AGENTS, CHAT_AGENTS, type AgentId } from "@/lib/agent/agents";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, CARD, CHIP, SURFACE } from "@/components/agente/ui";
import { useActiveAgent } from "@/lib/store/agentSend";
import { useMascotUi } from "@/lib/store/mascotUiStore";

/** Chip con el agente activo (traje + nombre). Al tocarlo se puede dejar en «Automático» (sigue al módulo) o fijar uno a mano. */
export function AgentPicker() {
  const [open, setOpen] = useState(false);
  const active = useActiveAgent();
  const pinned = useMascotUi((s) => s.pinned);
  const pin = useMascotUi((s) => s.pin);
  const choose = (a: AgentId | "auto") => {
    pin(a);
    setOpen(false);
  };
  return (
    <div className="relative px-2.5 pt-1.5">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Elegir agente" className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 min-h-[32px] text-[12px] font-extrabold cursor-pointer" style={{ background: SURFACE, border: BORDER }}>
        <span className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden" style={{ background: CHIP }}>
          <Mascot size={22} still costume={active.costume} accent={active.accent} />
        </span>
        <span>{active.label}</span>
        <span className="text-white/40 font-bold">{active.pinned ? "· fijado" : "· auto"}</span>
        <ChevronDown size={14} className="text-white/50" />
      </button>
      {open && (
        <div role="listbox" aria-label="Agentes" className="absolute left-2.5 top-[42px] z-10 w-[min(300px,92%)] rounded-[22px] p-1.5 flex flex-col gap-0.5" style={{ background: CARD, border: BORDER, boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}>
          <button role="option" aria-selected={pinned === "auto"} onClick={() => choose("auto")} className="flex items-center gap-2 rounded-[16px] px-3 min-h-[44px] text-left cursor-pointer" style={{ background: pinned === "auto" ? CHIP : "transparent" }}>
            <span className="flex-1">
              <span className="block text-[14px] font-extrabold">Automático</span>
              <span className="block text-[11px] text-white/45">Sigue al módulo en el que estás</span>
            </span>
            {pinned === "auto" && <Check size={16} />}
          </button>
          {CHAT_AGENTS.map((id) => (
            <button key={id} role="option" aria-selected={pinned === id} onClick={() => choose(id)} className="flex items-center gap-2 rounded-[16px] px-3 min-h-[44px] text-left cursor-pointer" style={{ background: pinned === id ? CHIP : "transparent" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ background: SURFACE }}>
                <Mascot size={26} still costume={AGENTS[id].costume} accent={AGENTS[id].accent} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-extrabold">{AGENTS[id].name}</span>
                <span className="block text-[11px] text-white/45 truncate">{AGENTS[id].tools.length ? `${AGENTS[id].tools.length} herramientas` : "Delega"}</span>
              </span>
              {pinned === id && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
