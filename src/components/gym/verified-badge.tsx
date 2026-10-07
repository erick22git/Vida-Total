import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const GREEN = "#34d399";

/**
 * Check verde de "Verificado" — el ÚNICO componente que lo dibuja, en todo Calorías y Recetas.
 * Lee siempre el campo real `verificado` del alimento/receta (`item.verificado === true`): nunca se asume verificado
 * por defecto, y nada que no haya pasado por la acción manual "Verificar" lo muestra.
 *
 * - Por defecto solo el check (junto al nombre), y nada si no está verificado.
 * - `label`: agrega el texto "Verificado".
 * - `showUnverified`: en pantallas de editar, muestra "Sin verificar" cuando no lo está.
 */
export function VerifiedBadge({
  item,
  label = false,
  showUnverified = false,
  size = 14,
  className,
}: {
  item: { verificado?: boolean } | null | undefined;
  label?: boolean;
  showUnverified?: boolean;
  size?: number;
  className?: string;
}) {
  const verified = item?.verificado === true;
  if (!verified) {
    if (!showUnverified) return null;
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] text-white/45 shrink-0", className)} data-verified="false">
        <BadgeCheck size={size} className="opacity-40" aria-hidden /> Sin verificar
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1 shrink-0", className)}
      style={{ color: GREEN }}
      role="img"
      aria-label="Verificado"
      title="Verificado"
      data-verified="true"
    >
      <BadgeCheck size={size} aria-hidden />
      {label && <span className="text-[11px]">Verificado</span>}
    </span>
  );
}
