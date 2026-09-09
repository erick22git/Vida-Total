"use client";

/**
 * Icon + label pill used in the exercise action row (Tutorial / Reemplazar /
 * Notas / Descanso / Borrar...). Shared between the active-workout screen
 * and the plan/routine day editor so both stay visually identical.
 */
export function PillActionButton({
  icon: Icon,
  title,
  onClick,
  active,
  danger,
  badge,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center gap-1 rounded-xl cursor-pointer transition-colors shrink-0 px-2.5 h-9 ${className}`}
      style={{
        background: active ? "var(--gym)22" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "var(--gym)" : "rgba(255,255,255,0.12)"}`,
        color: danger ? "#f87171" : active ? "white" : "rgba(255,255,255,0.65)",
      }}
    >
      <Icon size={15} />
      <span className="text-[11px] font-semibold whitespace-nowrap">{badge ?? title}</span>
    </button>
  );
}
