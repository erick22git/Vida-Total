"use client";

/** Une el chat con el contexto de la pantalla: qué agente fijó el usuario y en qué módulo está (para el enrutamiento). */
import { usePathname } from "next/navigation";
import { AGENTS, type AgentDef, type AgentId } from "@/lib/agent/agents";
import { sendChat, useAgentChatStore } from "./agentChatStore";
import { useMascotUi } from "./mascotUiStore";
import { agentForScreen, screenKey } from "@/lib/agent/router";

export function sendFromUi(text: string): Promise<void> {
  const ui = useMascotUi.getState();
  return sendChat(text, {
    agent: ui.pinned,
    screen: typeof window === "undefined" ? undefined : screenKey(window.location.pathname),
    onAgent: (a) => useMascotUi.getState().setLastAgent(a),
  });
}

/** Agente activo para mostrar (traje y etiqueta): el fijado a mano; si no, el último que atendió; si no, el del módulo de la pantalla. */
export function useActiveAgent(): AgentDef & { pinned: boolean } {
  const pathname = usePathname();
  const pinned = useMascotUi((s) => s.pinned);
  const last = useMascotUi((s) => s.lastAgent);
  const hasChat = useAgentChatStore((s) => s.entries.length > 0);
  const id: AgentId = pinned !== "auto" ? pinned : hasChat && last ? last : agentForScreen(screenKey(pathname ?? "")) ?? "general";
  return { ...AGENTS[id], pinned: pinned !== "auto" };
}
