"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getAgendaIcon } from "@/lib/agenda/icons";
import { getLoadedIcons, isLucideKey, loadAllIcons, lucideName } from "@/lib/agenda/all-icons";

interface AgendaIconProps {
  /** Clave del icono: del catálogo rápido ("coffee") o de la biblioteca completa ("lucide:Utensils"). */
  k: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Dibuja el icono de una tarea. Los de la biblioteca completa se cargan bajo demanda (mientras tanto, una estrella). */
export function AgendaIcon({ k, size = 18, color, strokeWidth = 2.4 }: AgendaIconProps) {
  const [, force] = useState(0);
  const lucide = isLucideKey(k);
  useEffect(() => {
    if (lucide && !getLoadedIcons()) loadAllIcons().then(() => force((n) => n + 1));
  }, [lucide]);
  const Icon = lucide ? (getLoadedIcons()?.[lucideName(k)] ?? Star) : getAgendaIcon(k).Icon;
  return <Icon size={size} strokeWidth={strokeWidth} color={color} />;
}
