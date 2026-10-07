"use client";

import type { ReactNode } from "react";
import { CARD, CHIP, SURFACE } from "@/components/agenda/sheet";

/** Piezas del diseño NEGRO del agente (mismas que la Agenda de Hábitos: negro #000, superficies #1c1c1e / #2b2b2e, chips #3b3b3f, botón claro #f4f4f5, sin vidrio). */
export const BORDER = "1px solid rgba(255,255,255,0.08)";
export const LIGHT = "#f4f4f5";
export { CARD, CHIP, SURFACE };

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="w-12 h-7 rounded-full relative cursor-pointer shrink-0"
      style={{ background: on ? "#fff" : "#3a3a3d" }}
    >
      <span className="absolute top-1 w-5 h-5 rounded-full transition-all" style={{ left: on ? "calc(100% - 1.5rem)" : "0.25rem", background: on ? "#111" : "#fff" }} />
    </button>
  );
}

export function DarkCard({ children, className = "", tone = "surface" }: { children: ReactNode; className?: string; tone?: "surface" | "card" }) {
  return (
    <div className={`rounded-[24px] p-4 ${className}`} style={{ background: tone === "card" ? CARD : SURFACE, border: BORDER }}>
      {children}
    </div>
  );
}

export function Row({ label, hint, right }: { label: string; hint?: string; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <div className="min-w-0">
        <p className="text-[15px] font-bold">{label}</p>
        {hint && <p className="text-xs text-white/45">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** Botón claro (como el "+" de la Agenda) u oscuro (chip). */
export function Btn({ children, onClick, variant = "chip", disabled, className = "", ...rest }: { children: ReactNode; onClick?: () => void; variant?: "light" | "chip" | "danger"; disabled?: boolean; className?: string } & Record<string, unknown>) {
  const style =
    variant === "light" ? { background: LIGHT, color: "#111" } : variant === "danger" ? { background: "rgba(229,72,77,0.18)", color: "#ff9a9d" } : { background: CHIP, color: "#fff" };
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-full px-4 min-h-[40px] text-[14px] font-extrabold cursor-pointer disabled:opacity-40 active:scale-95 transition-transform ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}
