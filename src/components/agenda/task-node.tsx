"use client";

import type { CSSProperties } from "react";
import { getAgendaIcon } from "@/lib/agenda/icons";

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
}

/**
 * Icono de una tarea: círculo (15 min) o cápsula (más tiempo). Fondo gris con icono claro; a medida que pasa la hora
 * se llena del color de la tarea (blanco por defecto) y el icono se invierte en la parte llena. Hecha = se apaga.
 */
export function TaskNode({ icon, color, width, height, progress = 0, done, selected, iconSize = 18, className, style, onClick, label }: TaskNodeProps) {
  const { Icon } = getAgendaIcon(icon);
  const p = Math.min(1, Math.max(0, progress));
  const mask = p >= 0.999 ? undefined : `linear-gradient(to bottom, #000 ${Math.max(0, p * 100 - 10)}%, transparent ${p * 100}%)`;
  const iconEl = (c: string) => <Icon size={iconSize} strokeWidth={2.4} color={c} />;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
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
          {iconEl(INK)}
        </span>
      )}
    </button>
  );
}
