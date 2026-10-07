"use client";

/**
 * Estado del chat con el agente. La conversación en curso vive mientras la app esté abierta; al empezar una nueva, la anterior
 * se archiva en el historial (últimas 12, solo en este dispositivo y sin los resultados de herramientas). Está fuera del
 * componente para que sobreviva a cerrar y abrir el panel y para que la mascota pueda reaccionar ("pensando").
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import type { LlmMessage } from "@/lib/agent/llm";
import type { Plan } from "@/lib/agent/plan";
import { runAgentTurn, type ChatEntry, type RunOptions } from "@/lib/agent/runner";
import { newId } from "@/lib/agent/actions/pure";

export interface SavedChat {
  id: string;
  title: string;
  at: number;
  entries: ChatEntry[];
  history: LlmMessage[];
}

const MAX_SAVED = 12;

interface ChatState {
  entries: ChatEntry[];
  history: LlmMessage[];
  busy: boolean;
  review: Plan | null;
  saved: SavedChat[];
  /** Archiva la conversación actual (si tiene algo) y empieza una nueva. */
  clear: () => void;
  /** Archiva la actual y abre una guardada. */
  restore: (id: string) => void;
  removeSaved: (id: string) => void;
}

/** Solo texto: nada de llamadas a herramientas ni resultados (pueden traer datos). */
const plainHistory = (h: LlmMessage[]): LlmMessage[] =>
  h.filter((m) => (m.role === "user" || m.role === "assistant") && !m.tool_calls && m.content).map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) })).slice(-20);

function archive(s: Pick<ChatState, "entries" | "history" | "saved">): SavedChat[] {
  if (s.entries.length === 0) return s.saved;
  const first = s.entries.find((e) => e.kind === "user");
  const title = (first && first.kind === "user" ? first.text : "Conversación").slice(0, 48);
  const item: SavedChat = { id: newId(), title, at: Date.now(), entries: s.entries.slice(-40), history: plainHistory(s.history) };
  return [item, ...s.saved].slice(0, MAX_SAVED);
}

export const useAgentChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      entries: [],
      history: [],
      busy: false,
      review: null,
      saved: [],
      clear: () => {
        const s = get();
        set({ saved: archive(s), entries: [], history: [], review: null });
      },
      restore: (id) => {
        const s = get();
        const target = s.saved.find((c) => c.id === id);
        if (!target) return;
        const rest = { ...s, saved: s.saved.filter((c) => c.id !== id) };
        set({ saved: archive(rest), entries: target.entries, history: target.history, review: null });
      },
      removeSaved: (id) => set((s) => ({ saved: s.saved.filter((c) => c.id !== id) })),
    }),
    {
      name: "vida-total-agent-chats",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-agent-chats")),
      partialize: (s) => ({ saved: s.saved }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { saved?: SavedChat[] };
        return { ...current, saved: Array.isArray(p.saved) ? p.saved.slice(0, MAX_SAVED) : [] };
      },
    },
  ),
);

let resolveReview: ((p: Plan) => void) | null = null;

/** El usuario terminó de revisar el plan: se reanuda el turno del agente. */
export function resolvePlan(plan: Plan) {
  resolveReview?.(plan);
  resolveReview = null;
  useAgentChatStore.setState({ review: null });
}

export async function sendChat(text: string, opts: RunOptions = {}): Promise<void> {
  const msg = text.trim();
  const st = useAgentChatStore.getState();
  if (!msg || st.busy) return;
  useAgentChatStore.setState({ busy: true });
  try {
    const history = await runAgentTurn(
      msg,
      st.history.slice(-24),
      {
        push: (e) => useAgentChatStore.setState((s) => ({ entries: [...s.entries, e].slice(-80) })),
        review: (plan) =>
          new Promise<Plan>((resolve) => {
            resolveReview = resolve;
            useAgentChatStore.setState({ review: plan });
          }),
      },
      undefined,
      opts,
    );
    useAgentChatStore.setState({ history });
  } finally {
    useAgentChatStore.setState({ busy: false, review: null });
  }
}
