"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, Settings2, X } from "lucide-react";
import { AutoTotalBadge } from "@/components/agente/auto-total-badge";
import { PlanReview } from "@/components/agente/plan-review";
import { runAgentTurn, type ChatEntry } from "@/lib/agent/runner";
import type { LlmMessage } from "@/lib/agent/llm";
import type { Plan } from "@/lib/agent/plan";
import { useAgentStore } from "@/lib/store/agentStore";
import { cn } from "@/lib/utils";

/** Panel de chat con el agente (hoja inferior). El historial del modelo vive solo mientras está abierto. */
export function AgentChat({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [review, setReview] = useState<{ plan: Plan; resolve: (p: Plan) => void } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<LlmMessage[]>([]);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const killed = useAgentStore((s) => s.config.killSwitch || !s.config.channels.app.enabled);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries, review]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async () => {
    const msg = text.trim();
    if (!msg || busy) return;
    setText("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      history.current = await runAgentTurn(
        msg,
        history.current.slice(-24),
        {
          push: (e) => setEntries((p) => [...p, e]),
          review: (plan) => new Promise<Plan>((resolve) => setReview({ plan, resolve })),
        },
        abort.current.signal,
      );
    } finally {
      setBusy(false);
      setReview(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md h-[78dvh] rounded-t-3xl glass-panel flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Agente"
      >
        <header className="flex items-center gap-2 px-4 pt-3 pb-2">
          <Bot size={18} className="text-emerald-300" />
          <h2 className="text-sm font-semibold flex-1">Tu agente</h2>
          <AutoTotalBadge />
          <Link href="/configuracion/agente" onClick={onClose} aria-label="Agente y permisos" className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center">
            <Settings2 size={16} />
          </Link>
          <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center cursor-pointer">
            <X size={16} />
          </button>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2">
          {entries.length === 0 && !review && (
            <p className="text-sm text-white/55 pt-6 text-center px-4">
              Pídeme cosas como «crea una tarea para mañana a las 9 con 2 subtareas», «anota mi idea en una nota» o «registra 250 ml de agua».
            </p>
          )}
          {killed && <p className="text-xs text-red-200 text-center">El agente está apagado o desactivado en la app (Agente y permisos).</p>}
          {entries.map((e) => (
            <div
              key={e.id}
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                e.kind === "user" && "self-end bg-emerald-500/85 text-black",
                e.kind === "assistant" && "self-start bg-white/[0.08]",
                e.kind === "result" && (e.ok ? "self-start bg-white/[0.04] text-emerald-200 text-xs" : "self-start bg-white/[0.04] text-amber-200 text-xs"),
                e.kind === "error" && "self-start bg-red-500/15 text-red-200 text-xs",
              )}
            >
              {e.kind === "result" ? `${e.ok ? "✓" : "✗"} ${e.text}` : e.text}
            </div>
          ))}
          {review && (
            <PlanReview
              plan={review.plan}
              onDone={(p) => {
                review.resolve(p);
                setReview(null);
              }}
            />
          )}
          {busy && !review && <p className="text-xs text-white/40 self-start">Pensando…</p>}
        </div>

        <form
          className="flex items-end gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-white/10"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Escribe al agente…"
            className="flex-1 resize-none rounded-2xl bg-white/[0.08] px-3.5 py-3 text-sm text-white outline-none max-h-28"
          />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Enviar" className="w-11 h-11 rounded-full bg-emerald-500 text-black flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0">
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
