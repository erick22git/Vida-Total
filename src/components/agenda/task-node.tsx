"use client";

import type { CSSProperties } from "react";
import { Bell, CalendarDays } from "lucide-react";
import { readableInk } from "@/lib/agenda/colors";
import type { AgendaSource } from "@/lib/agenda/types";
import { AgendaIcon } from "./agenda-icon";

const BASE = "#3d3d40";
const INK = "#161618";

interface TaskNodeProps {
  icon: string;
  color: string;
  width: number;
  height: number;
  /** 0–1: cuánto del bloque ya pasó según la hora (se rellena de arriba hacia abajo, con borde suave). */
  progress?: number;
  done?: boolean;
  selected?: boolean;
  /** Icono en píxeles. */
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  label?: string;
  /** Marca de origen: evento de calendario o recordatorio (las tareas de Vida Total no llevan marca). */
  source?: AgendaSource;
}

/**
 * Icono de una tarea: círculo (15 min) o cápsula (más tiempo). Fondo gris con icono claro; a medida que pasa la hora
 * se llena del color de la tarea (blanco por defecto) y el icono se invierte en la parte llena. Hecha = se apaga.
 */
export function TaskNode({ icon, color, width, height, progress = 0, done, selected, iconSize = 18, className, style, onClick, label, source }: TaskNodeProps) {
  const p = Math.min(1, Math.max(0, progress));
  const mask = p >= 0.999 ? undefined : `linear-gradient(to bottom, #000 ${Math.max(0, p * 100 - 10)}%, transparent ${p * 100}%)`;
  const iconEl = (c: string) => <AgendaIcon k={icon} size={iconSize} color={c} />;
  const badge = source && source !== "local" ? Math.max(12, Math.min(18, width * 0.36)) : 0;
  return (
    <span className="relative inline-block shrink-0" style={{ width, height, lineHeight: 0 }}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-source={source ?? "local"}
      className={`relative shrink-0 overflow-hidden cursor-pointer ${className ?? ""}`}
      style={{
        width,
        height,
        borderRadius: width / 2,
        background: BASE,
        boxShadow: selected ? "0 0 0 3px #fff, 0 0 0 5px rgba(0,0,0,0.9)" : undefined,
        opacity: done ? 0.5 : 1,
        transition: "box-shadow 160ms ease, opacity 200ms ease",
        ...style,
      }}
    >
      <span className="absolute inset-0 flex items-center justify-center">{iconEl(color)}</span>
      {p > 0 && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: color, WebkitMaskImage: mask, maskImage: mask, transition: "all 600ms ease" }}
        >
          {iconEl(readableInk(color) === "#FFFFFF" ? "#FFFFFF" : INK)}
        </span>
      )}
    </button>
      {badge > 0 && (
        <span aria-hidden className="absolute flex items-center justify-center rounded-full" style={{ width: badge, height: badge, right: -badge * 0.25, top: -badge * 0.25, background: "#fff", color: "#111", boxShadow: "0 0 0 2px #000", zIndex: 3 }}>
          {source === "calendar" ? <CalendarDays size={badge * 0.62} strokeWidth={3} /> : <Bell size={badge * 0.6} strokeWidth={3} />}
        </span>
      )}
    </span>
  );
}
