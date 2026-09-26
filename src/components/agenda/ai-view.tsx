"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUp, Check, Sparkles } from "lucide-react";
import { getAssistant, type AgendaSuggestion } from "@/lib/agenda/assistant";
import { emptyDraft, useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, timeRange } from "@/lib/agenda/time";
import type { AgendaTaskDraft } from "@/lib/agenda/types";
import { haptic } from "@/lib/haptics/haptic";
import { TaskNode } from "./task-node";

const EXAMPLES = ["Quiero entrenar mañana a las 7", "Estudiar inglés el viernes a las 6 pm", "Llamar al médico hoy a las 10"];

type Phase = { name: "idle" } | { name: "loading" } | { name: "result"; s: AgendaSuggestion } | { name: "empty" } | { name: "added"; s: AgendaSuggestion };

/**
 * Espacio del asistente dentro de la Agenda. Hoy es solo la interfaz (sin IA real): escribes una frase, se muestra
 * "pensando", aparece una tarjeta de sugerencia y NADA se crea hasta que confirmas con "Añadir a la agenda".
 */
export function AiView({ onEdit, onOpenDay }: { onEdit: (prefill: Partial<AgendaTaskDraft>) => void; onOpenDay: (date: string) => void }) {
  const addTask = useAgendaStore((s) => s.addTask);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const run = useRef(0);
  const assistant = getAssistant();

  async function submit(value = text) {
    const v = value.trim();
    if (!v || phase.name === "loading") return;
    const id = ++run.current;
    setPhase({ name: "loading" });
    const s = await assistant.suggest(v, new Date());
    if (id !== run.current) return;
    setPhase(s ? { name: "result", s } : { name: "empty" });
  }
  const draftOf = (s: AgendaSuggestion): AgendaTaskDraft => ({
    ...emptyDraft(s.date, s.startMin),
    title: s.title,
    icon: s.icon,
    durationMin: s.durationMin,
    allDay: s.startMin === null,
  });

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-44 flex flex-col" data-testid="ai-view">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#2b2b2e" }}>
          <Sparkles size={18} />
        </span>
        <p className="text-[19px] font-extrabold">Organiza tu agenda</p>
      </div>
      <p className="text-[14px] font-semibold mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
        Cuenta qué quieres hacer y te preparo la tarea con día, hora y duración.
      </p>
      <p data-testid="ai-notice" className="text-[12px] font-bold px-3 py-1.5 rounded-full self-start mb-4" style={{ background: "#232326", color: "rgba(255,255,255,0.6)" }}>
        {assistant.label}
      </p>

      {phase.name === "idle" && (
        <div className="flex flex-col gap-2 mb-4">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => { setText(e); submit(e); }} className="text-left h-12 px-4 rounded-full text-[15px] font-semibold cursor-pointer" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}>
              “{e}”
            </button>
          ))}
        </div>
      )}

      {phase.name === "loading" && (
        <div role="status" aria-label="Interpretando tu frase" className="rounded-[28px] p-5 mb-4" style={{ background: "#1c1c1e" }} data-testid="ai-loading">
          <div className="flex items-center gap-4">
            <div className="w-[52px] h-[52px] rounded-full animate-pulse" style={{ background: "#2b2b2e" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-2/3 rounded-full animate-pulse" style={{ background: "#2b2b2e" }} />
              <div className="h-3 w-1/2 rounded-full animate-pulse" style={{ background: "#2b2b2e" }} />
            </div>
          </div>
          <p className="text-[13px] font-semibold mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>Interpretando tu frase…</p>
        </div>
      )}

      {phase.name === "empty" && (
        <p role="status" className="text-[15px] font-semibold mb-4 px-1" style={{ color: "rgba(255,255,255,0.6)" }}>No pude interpretar esa frase. Prueba con algo como “Quiero entrenar mañana a las 7”.</p>
      )}

      {phase.name === "result" && (
        <div className="rounded-[28px] p-5 mb-4" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="ai-result">
          <p className="text-[12px] font-extrabold tracking-wide mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>SUGERENCIA</p>
          <div className="flex items-center gap-4">
            <TaskNode icon={phase.s.icon} color="#FFFFFF" width={56} height={56} iconSize={26} label={phase.s.title} />
            <div className="min-w-0">
              <p className="text-[22px] font-extrabold leading-tight truncate">{phase.s.title}</p>
              <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                {format(new Date(`${phase.s.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                {phase.s.startMin === null ? "Sin hora (todo el día)" : `${timeRange(phase.s.startMin, phase.s.durationMin)} (${durationLabel(phase.s.durationMin)})`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                addTask(draftOf(phase.s));
                haptic("success");
                setPhase({ name: "added", s: phase.s });
              }}
              className="flex-1 h-12 rounded-full text-[16px] font-extrabold cursor-pointer"
              style={{ background: "#f4f4f5", color: "#111" }}
            >
              Añadir a la agenda
            </button>
            <button onClick={() => onEdit(draftOf(phase.s))} className="h-12 px-5 rounded-full text-[16px] font-extrabold cursor-pointer" style={{ background: "#2b2b2e" }}>Editar</button>
            <button aria-label="Descartar" onClick={() => setPhase({ name: "idle" })} className="h-12 px-4 rounded-full text-[15px] font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.6)" }}>Descartar</button>
          </div>
        </div>
      )}

      {phase.name === "added" && (
        <div className="rounded-[28px] p-5 mb-4 flex flex-col items-center text-center gap-3" style={{ background: "#1c1c1e" }} data-testid="ai-added">
          <span className="flex items-center justify-center w-12 h-12 rounded-full" style={{ background: "#fff", color: "#111" }}>
            <Check size={26} strokeWidth={4} />
          </span>
          <p className="text-[19px] font-extrabold">Añadida a tu agenda</p>
          <div className="flex gap-2">
            <button onClick={() => onOpenDay(phase.s.date)} className="h-11 px-5 rounded-full text-[15px] font-extrabold cursor-pointer" style={{ background: "#f4f4f5", color: "#111" }}>Verla en la agenda</button>
            <button onClick={() => { setText(""); setPhase({ name: "idle" }); }} className="h-11 px-5 rounded-full text-[15px] font-bold cursor-pointer" style={{ background: "#2b2b2e" }}>Otra</button>
          </div>
        </div>
      )}

      <form
        className="mt-auto flex items-end gap-2 rounded-[28px] p-2 pl-5"
        style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)" }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} aria-label="Cuéntame qué quieres hacer" placeholder="Cuéntame qué quieres hacer…" rows={1} className="flex-1 bg-transparent outline-none resize-none text-[17px] font-semibold py-3 max-h-28 placeholder:text-white/40" />
        <button type="submit" aria-label="Enviar" disabled={!text.trim() || phase.name === "loading"} className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-35" style={{ background: "#f4f4f5", color: "#111" }}>
          <ArrowUp size={22} strokeWidth={3.4} />
        </button>
      </form>
    </div>
  );
}
