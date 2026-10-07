"use client";

/**
 * Estado del chat con el agente (vive mientras la app esté abierta; no se guarda). Está fuera del componente para que la
 * conversación sobreviva a cerrar y abrir el panel de la mascota, y para que la mascota pueda reaccionar ("pensando").
 */
import { create } from "zustand";
import type { LlmMessage } from "@/lib/agent/llm";
import type { Plan } from "@/lib/agent/plan";
import { runAgentTurn, type ChatEntry } from "@/lib/agent/runner";

interface ChatState {
  entries: ChatEntry[];
  history: LlmMessage[];
  busy: boolean;
  review: Plan | null;
  clear: () => void;
}

export const useAgentChatStore = create<ChatState>()((set) => ({
  entries: [],
  history: [],
  busy: false,
  review: null,
  clear: () => set({ entries: [], history: [], review: null }),
}));

let resolveReview: ((p: Plan) => void) | null = null;

/** El usuario terminó de revisar el plan: se reanuda el turno del agente. */
export function resolvePlan(plan: Plan) {
  resolveReview?.(plan);
  resolveReview = null;
  useAgentChatStore.setState({ review: null });
}

export async function sendChat(text: string): Promise<void> {
  const msg = text.trim();
  const st = useAgentChatStore.getState();
  if (!msg || st.busy) return;
  useAgentChatStore.setState({ busy: true });
  try {
    const history = await runAgentTurn(msg, st.history.slice(-24), {
      push: (e) => useAgentChatStore.setState((s) => ({ entries: [...s.entries, e].slice(-80) })),
      review: (plan) =>
        new Promise<Plan>((resolve) => {
          resolveReview = resolve;
          useAgentChatStore.setState({ review: plan });
        }),
    });
    useAgentChatStore.setState({ history });
  } finally {
    useAgentChatStore.setState({ busy: false, review: null });
  }
}
