"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { HABIT_CATEGORIES } from "@/lib/data/habit-categories";
import { getHabitIcon } from "@/lib/habits-utils";
import { cn } from "@/lib/utils";

export function CreateHabitModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; categoryId?: string; icon: string; color: string }) => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;
    const category = HABIT_CATEGORIES.find((c) => c.id === categoryId);
    onCreate({
      name: name.trim(),
      categoryId: category?.id,
      icon: category?.icon ?? "Star",
      color: category?.color ?? "var(--habitos)",
    });
    setName("");
    setCategoryId(null);
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Nuevo hábito">
      <div className="flex flex-col gap-4">
        <GlassInput placeholder="Nombre del hábito" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Categoría (opcional)</span>
          <div className="grid grid-cols-3 gap-2">
            {HABIT_CATEGORIES.map((cat) => {
              const Icon = getHabitIcon(cat.icon);
              const selected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(selected ? null : cat.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-medium cursor-pointer transition-colors border",
                    selected ? "border-white bg-white/[0.12] text-white" : "border-white/10 bg-white/[0.04] text-white/60",
                  )}
                >
                  <Icon size={18} style={{ color: cat.color }} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer disabled:cursor-not-allowed transition-[box-shadow,background-color] duration-300"
          style={{
            background: name.trim() ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
            boxShadow: name.trim()
              ? "0 0 22px 1px rgba(255,255,255,0.35), 0 10px 24px rgba(0,0,0,0.35)"
              : "0 0 14px 1px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.35)",
          }}
        >
          Crear hábito
        </button>
      </div>
    </GlassModal>
  );
}
