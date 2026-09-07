"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import {
  BLOCK_COLOR_OPTIONS,
  HABIT_ICON_MAP,
  ICON_PICKER_OPTIONS,
} from "@/lib/habits-utils";
import { useHabitsStore } from "@/lib/store/habitsStore";

export function TimeBlockModal({
  open,
  onClose,
  startHour,
}: {
  open: boolean;
  onClose: () => void;
  startHour: number;
}) {
  const addTimeBlock = useHabitsStore((s) => s.addTimeBlock);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(1);
  const [color, setColor] = useState(BLOCK_COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(ICON_PICKER_OPTIONS[0]);

  function handleCreate() {
    if (!title.trim()) return;
    addTimeBlock({
      startHour,
      endHour: Math.min(24, startHour + duration),
      color,
      icon,
      title: title.trim(),
    });
    setTitle("");
    setDuration(1);
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title={`Nuevo bloque · ${startHour}:00`}>
      <div className="flex flex-col gap-4">
        <GlassInput
          placeholder="Título del bloque"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Duración (horas)</label>
          <input
            type="range"
            min={1}
            max={6}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-[var(--habitos)]"
          />
          <p className="text-xs text-white/40">{duration}h</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {BLOCK_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full cursor-pointer border-2 transition-transform"
                style={{
                  background: c,
                  borderColor: color === c ? "white" : "transparent",
                  transform: color === c ? "scale(1.1)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Ícono</label>
          <div className="flex items-center gap-2 flex-wrap max-h-28 overflow-y-auto">
            {ICON_PICKER_OPTIONS.map((name) => {
              const Icon = HABIT_ICON_MAP[name];
              return (
                <button
                  key={name}
                  onClick={() => setIcon(name)}
                  className="flex items-center justify-center w-8 h-8 rounded-xl cursor-pointer border transition-colors"
                  style={{
                    background: icon === name ? `${color}33` : "rgba(255,255,255,0.05)",
                    borderColor: icon === name ? color : "rgba(255,255,255,0.1)",
                  }}
                >
                  <Icon size={15} style={{ color: icon === name ? color : "rgba(255,255,255,0.6)" }} />
                </button>
              );
            })}
          </div>
        </div>

        <GlassButton accentColor="var(--habitos)" onClick={handleCreate} className="w-full">
          Crear bloque
        </GlassButton>
      </div>
    </GlassModal>
  );
}
