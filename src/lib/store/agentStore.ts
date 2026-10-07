"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
import { getCurrentUserId } from "./user-scope";
import { defaultAgentConfig, sanitizeConfig } from "@/lib/agent/config";
import { mergeHistory, pushRecord, type ActionRecord } from "@/lib/agent/history";
import { applyAnswer } from "@/lib/agent/permissions";
import type { AgentConfig, Channel, Decision, PermissionAnswer } from "@/lib/agent/types";
import { fetchAgentConfig, fetchRemoteActionLog, syncMarkRemoteUndone, syncUpsertAgentConfig } from "@/lib/sync/agent-sync";

/** Id de esta carga de la app (cambia al recargar): lo usa el "Auto total · esta sesión". */
const SESSION_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Math.random().toString(36).slice(2)}`;
export const getAgentSessionId = () => SESSION_ID;

interface AgentState {
  config: AgentConfig;
  /** Marca de la última edición local (para resolver conflictos con la copia remota). */
  configUpdatedAt: number;
  history: ActionRecord[];
  setConfig: (updater: (c: AgentConfig) => AgentConfig) => void;
  /** Aplica la respuesta a un permiso ("Permitir esta vez / siempre / Denegar"); devuelve si hay que ejecutar. */
  answerPermission: (tool: string, channel: Channel, answer: PermissionAnswer, decision: Decision) => boolean;
  record: (rec: ActionRecord) => void;
  markUndone: (id: string) => void;
  /** Apagado inmediato de "Auto total". */
  stopAutoTotal: () => void;
  /** Apagado total del agente. */
  setKillSwitch: (on: boolean) => void;
  _hydrateRemote: (patch: Partial<Pick<AgentState, "config" | "configUpdatedAt" | "history">>) => void;
}

function pushConfig(config: AgentConfig) {
  const uid = getCurrentUserId();
  if (uid) syncUpsertAgentConfig(config, uid);
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      config: defaultAgentConfig(),
      configUpdatedAt: 0,
      history: [],
      setConfig: (updater) => {
        const next = sanitizeConfig(updater(get().config));
        set({ config: next, configUpdatedAt: Date.now() });
        pushConfig(next);
      },
      answerPermission: (tool, channel, answer, decision) => {
        const { config, execute } = applyAnswer(get().config, tool, channel, answer, decision);
        if (config !== get().config) {
          const next = sanitizeConfig(config);
          set({ config: next, configUpdatedAt: Date.now() });
          pushConfig(next);
        }
        return execute;
      },
      record: (rec) => set((s) => ({ history: pushRecord(s.history, rec) })),
      markUndone: (id) => {
        set((s) => ({ history: s.history.map((r) => (r.id === id ? { ...r, undone: true } : r)) }));
        const uid = getCurrentUserId();
        if (uid) syncMarkRemoteUndone(id, uid);
      },
      stopAutoTotal: () => get().setConfig((c) => ({ ...c, autoTotal: null })),
      setKillSwitch: (on) => get().setConfig((c) => ({ ...c, killSwitch: on, autoTotal: on ? null : c.autoTotal })),
      _hydrateRemote: (patch) => set(patch),
    }),
    {
      name: "vida-total-agent",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-agent")),
      // Merge seguro: lo guardado se sanea (puede venir de una versión anterior o estar manipulado).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AgentState>;
        return {
          ...current,
          config: sanitizeConfig(p.config),
          configUpdatedAt: typeof p.configUpdatedAt === "number" ? p.configUpdatedAt : 0,
          history: Array.isArray(p.history) ? p.history.slice(0, 200) : [],
        };
      },
      partialize: (s) => ({ config: s.config, configUpdatedAt: s.configUpdatedAt, history: s.history }),
    },
  ),
);

/**
 * Trae la configuración remota y el historial de Telegram y los mezcla (nunca reemplaza): gana la configuración editada
 * más recientemente; el historial se une por id. Se llama al abrir la pantalla del agente.
 */
export async function hydrateAgentStore(userId: string): Promise<void> {
  const [remoteCfg, remoteLog] = await Promise.all([fetchAgentConfig(userId), fetchRemoteActionLog(userId)]);
  const local = useAgentStore.getState();
  const patch: Parameters<AgentState["_hydrateRemote"]>[0] = { history: mergeHistory(local.history, remoteLog) };
  if (remoteCfg && remoteCfg.updatedAt > local.configUpdatedAt) {
    // El "Auto total" es de este dispositivo: nunca se toma del remoto.
    patch.config = { ...remoteCfg.config, autoTotal: local.config.autoTotal };
    patch.configUpdatedAt = remoteCfg.updatedAt;
  } else if (!remoteCfg && local.configUpdatedAt > 0) {
    syncUpsertAgentConfig(local.config, userId);
  }
  local._hydrateRemote(patch);
}
