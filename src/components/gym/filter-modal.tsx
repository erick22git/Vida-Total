"use client";

import { Check, Dumbbell, type LucideIcon, icons } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";

export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
}

export function FilterModal({
  open,
  onClose,
  title,
  allLabel,
  options,
  selected,
  onToggle,
  accentColor = "var(--gym)",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  allLabel: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string | null) => void;
  accentColor?: string;
}) {
  const allSelected = selected.length === 0;

  return (
    <GlassModal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1.5">
        <Row
          label={allLabel}
          active={allSelected}
          accentColor={accentColor}
          onClick={() => onToggle(null)}
        />
        <div className="h-px bg-white/10 my-1" />
        {options.map((opt) => {
          const Icon: LucideIcon = opt.icon ? (icons[opt.icon as keyof typeof icons] ?? Dumbbell) : Dumbbell;
          return (
            <Row
              key={opt.value}
              label={opt.label}
              icon={Icon}
              active={selected.includes(opt.value)}
              accentColor={accentColor}
              onClick={() => onToggle(opt.value)}
            />
          );
        })}
      </div>
    </GlassModal>
  );
}

function Row({
  label,
  icon: Icon,
  active,
  accentColor,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors cursor-pointer"
      style={{
        background: active ? `${accentColor}1f` : "transparent",
      }}
    >
      {Icon && (
        <span
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", color: accentColor }}
        >
          <Icon size={16} />
        </span>
      )}
      <span className="flex-1 text-sm font-medium text-white/85">{label}</span>
      {active && <Check size={16} style={{ color: accentColor }} />}
    </button>
  );
}
