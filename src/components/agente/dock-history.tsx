"use client";

import { format } from "date-fns";
import { MessageSquare, Trash2, Undo2 } from "lucide-react";
import { undoRecord } from "@/lib/agent/actions/undo";
import { BORDER, CARD, CHIP, SURFACE } from "@/components/agente/ui";
import { useAgentChatStore } from "@/lib/store/agentChatStore";
import { useAgentStore } from "@/lib/store/agentStore";
import { cn } from "@/lib/utils";

/** Historial: conversaciones anteriores (se pueden retomar) y acciones del agente (con «Deshacer» cuando se puede). */
export function DockHistory({ onOpenChat }: { onOpenChat: () => void }) {
  const saved = useAgentChatStore((s) => s.saved);
  const restore = useAgentChatStore((s) => s.restore);
  const removeSaved = useAgentChatStore((s) => s.removeSaved);
  const history = useAgentStore((s) => s.history);

  return (
    <div className="flex flex-col gap-3 px-3 pb-3 pt-1 max-h-[min(58dvh,460px)] overflow-y-auto">
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[12px] font-extrabold uppercase tracking-wide text-white/45 px-1">Conversaciones</h3>
        {saved.length === 0 && <p className="text-xs text-white/45 px-1">Todavía no hay conversaciones guardadas. Al empezar una nueva con «+», la actual queda aquí.</p>}
        {saved.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-[18px] pl-3 pr-1.5 min-h-[48px]" style={{ background: SURFACE, border: BORDER }}>
            <button
              className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer min-h-[44px]"
              onClick={() => {
                restore(c.id);
                onOpenChat();
              }}
            >
              <MessageSquare size={15} className="text-white/45 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[14px] font-bold truncate">{c.title}</span>
                <span className="block text-[11px] text-white/40">{format(c.at, "d MMM HH:mm")}</span>
              </span>
            </button>
            <button aria-label="Borrar conversación" onClick={() => removeSaved(c.id)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-white/45" style={{ background: CHIP }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-[12px] font-extrabold uppercase tracking-wide text-white/45 px-1">Acciones del agente</h3>
        {history.length === 0 && <p className="text-xs text-white/45 px-1">Todavía no hizo nada.</p>}
        {history.slice(0, 20).map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-[18px] pl-3 pr-1.5 min-h-[48px]" style={{ background: CARD, border: BORDER }}>
            <div className="min-w-0 flex-1 py-1.5">
              <p className={cn("text-[13px] font-bold truncate", r.undone && "line-through text-white/40", !r.ok && "text-red-300")}>{r.summary}</p>
              <p className="text-[11px] text-white/40">
                {format(r.at, "d MMM HH:mm")} · {r.channel === "app" ? "App" : "Telegram"}
              </p>
            </div>
            {r.undo && !r.undone && (
              <button onClick={() => undoRecord(r)} className="rounded-full px-3 min-h-[36px] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer" style={{ background: CHIP }}>
                <Undo2 size={13} /> Deshacer
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
