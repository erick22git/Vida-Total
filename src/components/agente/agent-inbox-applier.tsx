"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { executeClient } from "@/lib/agent/actions/client";
import { newId } from "@/lib/agent/actions/pure";
import { QUEUED_TOOLS } from "@/lib/agent/server/queued-tools";
import { getTool } from "@/lib/agent/tools/registry";
import { hydrateGymStore } from "@/lib/store/gymStore";
import { hydrateHabitsStore } from "@/lib/store/habitsStore";
import { useAgentStore } from "@/lib/store/agentStore";

const SEEN_KEY = "vt-agent-tg-seen";
const MIN_GAP_MS = 20_000;

interface CommandRow {
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Hace que lo que el agente hizo por Telegram aparezca en la app sin recargar:
 *  1. aplica la bandeja `agent_commands` (ediciones de cosas que ya existen) con las acciones normales de los stores y
 *     marca cada comando como aplicado o rechazado;
 *  2. si hubo acciones nuevas desde Telegram (filas nuevas: agua, comidas, tareas, notas) vuelve a traer los datos con la
 *     misma hidratación "merge" de siempre (nunca reemplaza).
 * Corre al abrir la app y cada vez que vuelve a primer plano. No hace nada si no hay Telegram vinculado (no hay filas).
 */
export function AgentInboxApplier({ userId }: { userId: string }) {
  const busy = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    const run = async () => {
      if (busy.current || Date.now() - last.current < MIN_GAP_MS) return;
      busy.current = true;
      last.current = Date.now();
      try {
        const supabase = createClient();
        let seen = "1970-01-01T00:00:00.000Z";
        try {
          seen = window.localStorage.getItem(SEEN_KEY) ?? seen;
        } catch {
          /* sin localStorage */
        }

        // 1) Bandeja de comandos
        const { data: cmds } = await supabase.from("agent_commands").select("id,tool,args").eq("user_id", userId).eq("status", "pending").order("created_at", { ascending: true }).limit(20);
        for (const c of (cmds ?? []) as CommandRow[]) {
          const tool = getTool(c.tool);
          const v = tool && QUEUED_TOOLS.has(c.tool) ? tool.validate(c.args) : null;
          if (!v || !v.ok) {
            await supabase.from("agent_commands").update({ status: "rejected", result: "Comando no válido", applied_at: new Date().toISOString() }).eq("id", c.id).eq("user_id", userId);
            continue;
          }
          const r = executeClient(c.tool, v.args);
          useAgentStore.getState().record({ id: newId(), at: Date.now(), channel: "telegram", tool: c.tool, args: v.args, summary: r.summary, ok: r.ok, undo: r.undo });
          await supabase.from("agent_commands").update({ status: r.ok ? "applied" : "rejected", result: r.summary.slice(0, 300), applied_at: new Date().toISOString() }).eq("id", c.id).eq("user_id", userId);
        }

        // 2) ¿Hay filas nuevas hechas desde Telegram?
        const { data: fresh } = await supabase.from("agent_action_log").select("created_at").eq("user_id", userId).eq("channel", "telegram").gt("created_at", seen).order("created_at", { ascending: false }).limit(1);
        if (fresh && fresh.length > 0) {
          await Promise.allSettled([hydrateGymStore(userId), hydrateHabitsStore(userId)]);
          try {
            window.localStorage.setItem(SEEN_KEY, fresh[0].created_at as string);
          } catch {
            /* sin localStorage */
          }
        }
      } catch (err) {
        console.warn("[agent-inbox] falló:", err instanceof Error ? err.message : err);
      } finally {
        busy.current = false;
      }
    };
    void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);

  return null;
}
