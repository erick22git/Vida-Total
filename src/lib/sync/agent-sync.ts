/**
 * Sincronización de la configuración del agente con Supabase (tabla `agent_settings`, migración 0012). Mismo patrón que el
 * resto de capas de sync: "fire and forget", cliente de navegador con RLS, nunca lanza.
 *
 * Seguridad: el "Auto total" NUNCA se sube (es un estado de este dispositivo que caduca) y nunca se acepta de vuelta. El
 * servidor, además, vuelve a sanear la configuración que lee (`sanitizeConfig`).
 */
import { createClient } from "@/lib/supabase/client";
import { sanitizeConfig } from "@/lib/agent/config";
import type { AgentConfig } from "@/lib/agent/types";
import type { ActionRecord } from "@/lib/agent/history";

export function syncUpsertAgentConfig(config: AgentConfig, userId: string): void {
  const toSend: AgentConfig = { ...config, autoTotal: null };
  void (async () => {
    try {
      const { error } = await createClient()
        .from("agent_settings")
        .upsert({ user_id: userId, config: toSend, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) console.warn("[agent-sync] guardar configuración falló:", error.message);
    } catch (err) {
      console.warn("[agent-sync] guardar configuración lanzó una excepción:", err);
    }
  })();
}

export async function fetchAgentConfig(userId: string): Promise<{ config: AgentConfig; updatedAt: number } | null> {
  try {
    const { data, error } = await createClient().from("agent_settings").select("config, updated_at").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return { config: { ...sanitizeConfig(data.config), autoTotal: null }, updatedAt: new Date(data.updated_at as string).getTime() };
  } catch {
    return null;
  }
}

interface LogRow {
  id: string;
  channel: ActionRecord["channel"] | "scheduler";
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ok: boolean;
  undo: ActionRecord["undo"] | null;
  undone: boolean;
  created_at: string;
}

/** Acciones hechas desde Telegram (o el programador), para mostrarlas en el historial de la app. */
export async function fetchRemoteActionLog(userId: string): Promise<ActionRecord[]> {
  try {
    const { data, error } = await createClient()
      .from("agent_action_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return (data as LogRow[]).map((r) => ({
      id: r.id,
      at: new Date(r.created_at).getTime(),
      channel: r.channel === "app" ? "app" : "telegram",
      tool: r.tool,
      args: r.args ?? {},
      summary: r.summary,
      ok: r.ok,
      undo: r.undo ?? undefined,
      undone: r.undone,
    }));
  } catch {
    return [];
  }
}

export function syncMarkRemoteUndone(id: string, userId: string): void {
  void (async () => {
    try {
      await createClient().from("agent_action_log").update({ undone: true }).eq("id", id).eq("user_id", userId);
    } catch (err) {
      console.warn("[agent-sync] marcar deshecho falló:", err);
    }
  })();
}
