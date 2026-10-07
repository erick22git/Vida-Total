"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { executeClient } from "@/lib/agent/actions/client";
import { SNOOZE_MIN, buttonLabel, type NoticeButton } from "@/lib/agent/notifications";
import { useAgentStore } from "@/lib/store/agentStore";

const nowIso = () => new Date().toISOString();
const snoozeIso = () => new Date(Date.now() + SNOOZE_MIN * 60_000).toISOString();

interface Row {
  id: string;
  title: string;
  body: string;
  payload: { taskId?: string | null; subtaskId?: string | null; buttons?: NoticeButton[] };
}

/**
 * Avisos DENTRO de la app. El servidor deja cada aviso en `agent_notification_log`; aquí se muestran (máx. 2 a la vez) los
 * no leídos de las últimas 12 h, con los mismos botones que en Telegram. «Hecho» usa las acciones normales de la app.
 */
export function AgentNotificationBanner({ userId }: { userId: string }) {
  const enabled = useAgentStore((s) => s.config.notifications.enabled && s.config.notifications.inApp && !s.config.killSwitch);
  const [rows, setRows] = useState<Row[]>([]);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const since = new Date(Date.now() - 12 * 3_600_000).toISOString();
      const { data } = await createClient().from("agent_notification_log").select("id,title,body,payload").eq("user_id", userId).is("read_at", null).gt("created_at", since).order("created_at", { ascending: false }).limit(2);
      setRows((data ?? []) as Row[]);
    } catch {
      /* sin conexión: se reintenta */
    } finally {
      busy.current = false;
    }
  }, [userId]);

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

  const close = async (row: Row, extra: Record<string, unknown> = {}) => {
    setRows((p) => p.filter((r) => r.id !== row.id));
    try {
      await createClient().from("agent_notification_log").update({ read_at: nowIso(), ...extra }).eq("id", row.id).eq("user_id", userId);
    } catch {
      /* se reintenta en la próxima carga */
    }
  };

  const act = async (row: Row, b: NoticeButton) => {
    if (b === "snooze") return close(row, { snooze_until: snoozeIso() });
    if (b === "done" && row.payload.taskId) {
      executeClient(row.payload.subtaskId ? "subtask_complete" : "task_complete", row.payload.subtaskId ? { taskId: row.payload.taskId, subtaskId: row.payload.subtaskId, done: true } : { id: row.payload.taskId, done: true });
    }
    if (b === "water250") executeClient("water_add", { ml: 250 });
    return close(row);
  };

  if (!enabled || rows.length === 0) return null;
  return (
    <div className="fixed left-0 right-0 top-[max(env(safe-area-inset-top),8px)] z-[65] px-3 flex flex-col gap-2 pointer-events-none">
      {rows.map((r) => (
        <div key={r.id} className="pointer-events-auto mx-auto w-full max-w-md rounded-[24px] bg-[#1c1c1e] border border-white/[0.1] shadow-2xl p-3 flex flex-col gap-2" role="status">
          <div className="flex items-start gap-2">
            <Bell size={16} className="text-amber-300 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-white/70 break-words">{r.body}</p>
            </div>
            <button aria-label="Cerrar aviso" onClick={() => void close(r)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer shrink-0">
              <X size={14} />
            </button>
          </div>
          {(r.payload.buttons?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.payload.buttons!.map((b) => (
                <button key={b} onClick={() => void act(r, b)} className="rounded-full bg-[#3b3b3f] px-4 py-2 text-xs font-bold cursor-pointer min-h-[38px]">
                  {buttonLabel[b]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
