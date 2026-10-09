"use client";

/**
 * Botón-píldora con el mismo bisel oscuro 3D que los círculos de "agregar" del vaso de Agua (radial
 * oscuro + sombras internas/externas) — usado en Agua (Hoy/Semana/Mes/Todo el tiempo, 7/30/90 días).
 */
const BEZEL_BG = "radial-gradient(circle at 50% 20%, rgb(30,30,30) 0%, rgb(13,13,13) 60%, rgb(5,5,5) 100%)";
const SHADOW_BASE = "inset 0 1px 3px rgba(255,255,255,0.08), inset 0 -8px 16px rgba(0,0,0,0.75), 0 6px 14px rgba(0,0,0,0.45)";
const SHADOW_SELECTED = "inset 0 1px 3px rgba(255,255,255,0.12), inset 0 -8px 16px rgba(0,0,0,0.7), 0 6px 14px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(255,255,255,0.45)";

export function BezelPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold cursor-pointer transition-transform active:scale-95"
      style={{ background: BEZEL_BG, boxShadow: selected ? SHADOW_SELECTED : SHADOW_BASE, color: selected ? "#fff" : "rgba(255,255,255,0.5)" }}
    >
      {label}
    </button>
  );
}
