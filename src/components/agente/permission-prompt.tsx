"use client";

import { ShieldQuestion } from "lucide-react";
import type { Decision, PermissionAnswer } from "@/lib/agent/types";

/**
 * Tarjeta de permiso, como en Claude Code: "Permitir esta vez", "Permitir siempre esta herramienta", "Denegar".
 * Si la herramienta está en la lista "nunca automático" (`canAlways = false`) no ofrece "siempre".
 */
export function PermissionPrompt({
  label,
  detail,
  before,
  after,
  decision,
  onAnswer,
}: {
  label: string;
  /** Qué va a hacer, en una frase ("Agregar 250 ml de agua"). */
  detail: string;
  before?: string;
  after?: string;
  decision: Extract<Decision, { action: "ask" }>;
  onAnswer: (a: PermissionAnswer) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#1c1c1e] border border-white/[0.08] p-3.5 flex flex-col gap-2.5" role="group" aria-label={`Permiso: ${label}`}>
      <div className="flex items-start gap-2.5">
        <ShieldQuestion size={18} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">{label}</p>
          <p className="text-xs text-white/70 break-words">{detail}</p>
          {(before !== undefined || after !== undefined) && (
            <p className="mt-1 text-[11px] text-white/55 break-words">
              {before !== undefined && <span className="line-through decoration-white/30">{before || "(vacío)"}</span>}
              {before !== undefined && after !== undefined && <span> → </span>}
              {after !== undefined && <span className="text-emerald-300/90">{after}</span>}
            </p>
          )}
          {!decision.canAlways && decision.reasons.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-200/80">Siempre pregunta: {decision.reasons.join(" · ")}.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onAnswer("allow_once")} className="rounded-full px-4 py-2 text-xs font-bold bg-[#f4f4f5] text-black font-extrabold cursor-pointer min-h-[38px]">
          Permitir esta vez
        </button>
        {decision.canAlways && (
          <button onClick={() => onAnswer("allow_always")} className="rounded-full px-4 py-2 text-xs font-bold bg-[#3b3b3f] text-white cursor-pointer min-h-[38px]">
            Permitir siempre esta herramienta
          </button>
        )}
        <button onClick={() => onAnswer("deny")} className="rounded-full px-4 py-2 text-xs font-bold bg-red-500/15 text-red-200 cursor-pointer min-h-[38px]">
          Denegar
        </button>
      </div>
    </div>
  );
}
