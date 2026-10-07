"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, History } from "lucide-react";
import { AGENTS } from "@/lib/agent/agents";
import { Mascot } from "@/components/agente/mascot";
import { PlanReview } from "@/components/agente/plan-review";
import { CARD, CHIP, LIGHT, SURFACE, BORDER } from "@/components/agente/ui";
import { resolvePlan, useAgentChatStore } from "@/lib/store/agentChatStore";
import { sendFromUi, useActiveAgent } from "@/lib/store/agentSend";
import { useAgentStore } from "@/lib/store/agentStore";
import { useMascotUi } from "@/lib/store/mascotUiStore";

/** Chat con el agente (diseño negro, como la Agenda). El texto que dejó una opción rápida llega ya escrito. */
export function DockChat() {
  const entries = useAgentChatStore((s) => s.entries);
  const busy = useAgentChatStore((s) => s.busy);
  const review = useAgentChatStore((s) => s.review);
  const prefill = useMascotUi((s) => s.prefill);
  const clearPrefill = useMascotUi((s) => s.clearPrefill);
  const off = useAgentStore((s) => s.config.killSwitch || !s.config.channels.app.enabled);
  const [draft, setDraft] = useState(prefill);
  const setTab = useMascotUi((s) => s.setTab);
  const agent = useActiveAgent();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Al abrir desde una opción rápida, el texto sugerido queda escrito y el cursor al final.
  useEffect(() => {
    if (!prefill) return;
    clearPrefill();
    const t = setTimeout(() => {
      input.current?.focus();
      input.current?.setSelectionRange(prefill.length, prefill.length);
    }, 280);
    return () => clearTimeout(t);
  }, [prefill, clearPrefill]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries, review, busy]);

  const send = () => {
    const t = draft.trim();
    if (!t || busy) return;
    setDraft("");
    void sendFromUi(t);
  };

  return (
    <div className="flex flex-col h-[min(62dvh,500px)]">
      <div className="flex justify-end px-3 pt-1">
        <button onClick={() => setTab("history")} aria-label="Historial" className="flex items-center gap-1.5 rounded-full px-3 min-h-[30px] text-[12px] font-extrabold text-white/60 cursor-pointer" style={{ background: SURFACE, border: BORDER }}>
          <History size={13} /> Historial
        </button>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto px-3 pt-2 pb-2 flex flex-col gap-2.5">
        {entries.length === 0 && !review && (
          <div className="flex items-start gap-2.5 pt-1">
            <div className="w-9 shrink-0 pt-1"><Mascot size={36} still costume={agent.costume} accent={agent.accent} /></div>
            <p className="text-[14px] leading-snug text-white/85">
              ¡Hola! Soy tu asistente. Puedo crear tareas y notas, registrar agua y comidas, y decirte cómo vas hoy. ¿Qué necesitas?
            </p>
          </div>
        )}
        {off && <p className="text-xs text-center" style={{ color: "#ff9a9d" }}>El agente está apagado o desactivado en la app (pestaña ajustes).</p>}
        {entries.map((e, i) =>
          e.kind === "user" ? (
            <div key={e.id} className="self-end max-w-[82%] rounded-[20px] px-3.5 py-2 text-[14px] whitespace-pre-wrap break-words" style={{ background: CARD, border: BORDER }}>
              {e.text}
            </div>
          ) : e.kind === "assistant" ? (
            <div key={e.id} className="flex items-start gap-2.5">
              <div className="w-9 shrink-0 pt-0.5">{entries[i - 1]?.kind !== "assistant" ? <Mascot size={36} still costume={e.agent ? AGENTS[e.agent].costume : "none"} accent={e.agent ? AGENTS[e.agent].accent : undefined} /> : null}</div>
              <p className="text-[14px] leading-snug text-white/90 whitespace-pre-wrap break-words min-w-0">{e.text}</p>
            </div>
          ) : (
            <p key={e.id} className="text-[12px] font-bold pl-[46px] break-words" style={{ color: e.kind === "error" ? "#ff9a9d" : e.ok ? "#7ee2a8" : "#ffcf6e" }}>
              {e.kind === "result" ? `${e.ok ? "✓" : "✗"} ${e.text}` : e.text}
            </p>
          ),
        )}
        {review && <PlanReview plan={review} onDone={resolvePlan} />}
        {busy && !review && <p className="text-xs text-white/40 pl-[46px]">Pensando…</p>}
      </div>

      <form
        className="flex items-end gap-2 p-2.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Escríbele a tu asistente…"
          className="flex-1 resize-none rounded-[22px] px-4 py-3 text-[14px] text-white outline-none max-h-28 placeholder:text-white/35"
          style={{ background: SURFACE, border: BORDER }}
        />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Enviar" className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-35 cursor-pointer shrink-0 active:scale-95 transition-transform" style={{ background: draft.trim() && !busy ? LIGHT : CHIP, color: draft.trim() && !busy ? "#111" : "#aaa" }}>
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      </form>
    </div>
  );
}
