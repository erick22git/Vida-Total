"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { executeClient } from "@/lib/agent/actions/client";
import { SNOOZE_MIN, buttonLabel, type NoticeButton } from "@/lib/agent/notifications";
import { useAgentStore } from "@/lib/store/agentStore";
import { notify } from "@/lib/notify/use-notify";
import type { NotifyType } from "@/lib/store/notifyStore";

const nowIso = () => new Date().toISOString();
const snoozeIso = () => new Date(Date.now() + SNOOZE_MIN * 60_000).toISOString();

type NoticeKind = "task" | "subtask" | "routine" | "water" | "meal" | "summary";

interface Row {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  payload: { taskId?: string | null; subtaskId?: string | null; buttons?: NoticeButton[] };
}

const KIND_TO_NOTIFY_TYPE: Record<NoticeKind, NotifyType> = {
  task: "reminder",
  subtask: "reminder",
  routine: "reminder",
  water: "reminder",
  meal: "reminder",
  summary: "agent-message",
};

/**
 * Avisos DENTRO de la app (recordatorios de tarea/subtarea, rutina próxima, agua, resúmenes del
 * agente) — Fase 4/Adenda: ya no dibuja su propia tarjeta, empuja cada aviso a la Isla Dinámica
 * (`useNotify`, prioridad "media" = recordatorio, se queda hasta que se actúe o se deslice). El
 * servidor deja cada aviso en `agent_notification_log` (migración 0015, pendiente de aplicar); este
 * componente solo sincroniza: no vuelve a empujar un `id` que ya empujó en esta sesión.
 */
export function AgentNotificationBanner({ userId }: { userId: string }) {
  const enabled = useAgentStore((s) => s.config.notifications.enabled && s.config.notifications.inApp && !s.config.killSwitch);
  const busy = useRef(false);
  const pushed = useRef(new Set<string>());

  const close = useCallback(
    async (row: Row, extra: Record<string, unknown> = {}) => {
      try {
        await createClient().from("agent_notification_log").update({ read_at: nowIso(), ...extra }).eq("id", row.id).eq("user_id", userId);
      } catch {
        /* se reintenta en la próxima carga */
      }
    },
    [userId],
  );

  const act = useCallback(
    (row: Row, b: NoticeButton) => {
      if (b === "snooze") {
        void close(row, { snooze_until: snoozeIso() });
        return;
      }
      if (b === "done" && row.payload.taskId) {
        executeClient(
          row.payload.subtaskId ? "subtask_complete" : "task_complete",
          row.payload.subtaskId ? { taskId: row.payload.taskId, subtaskId: row.payload.subtaskId, done: true } : { id: row.payload.taskId, done: true },
        );
      }
      if (b === "water250") executeClient("water_add", { ml: 250 });
      void close(row);
    },
    [close],
  );

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const since = new Date(Date.now() - 12 * 3_600_000).toISOString();
      const { data } = await createClient()
        .from("agent_notification_log")
        .select("id,kind,title,body,payload")
        .eq("user_id", userId)
        .is("read_at", null)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2);
      for (const row of (data ?? []) as Row[]) {
        if (pushed.current.has(row.id)) continue;
        pushed.current.add(row.id);
        notify({
          type: KIND_TO_NOTIFY_TYPE[row.kind] ?? "reminder",
          priority: "medium",
          title: row.title,
          message: row.body,
          actions: (row.payload.buttons ?? []).map((b) => ({ label: buttonLabel[b], onClick: () => act(row, b) })),
          onDismiss: () => void close(row),
        });
      }
    } catch {
      /* sin conexión: se reintenta */
    } finally {
      busy.current = false;
    }
  }, [userId, act, close]);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, load]);

  return null;
}
