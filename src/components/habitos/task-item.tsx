"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import type { Task } from "@/lib/types/habits";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/habits-utils";
import { useHabitsStore } from "@/lib/store/habitsStore";

export function TaskItem({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const toggleTaskCompleted = useHabitsStore((s) => s.toggleTaskCompleted);
  const toggleSubtask = useHabitsStore((s) => s.toggleSubtask);
  const removeTask = useHabitsStore((s) => s.removeTask);
  const [expanded, setExpanded] = useState(false);

  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="md:hidden absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-500/80 rounded-3xl">
        <Trash2 size={18} className="text-white" />
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.05}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) removeTask(task.id);
        }}
        animate={{ x: 0 }}
        className="relative group w-full"
      >
        <GlassCard
          accentColor={task.color}
          padding="md"
          interactive={false}
          className="flex flex-col gap-2"
        >
          <div className="flex items-start gap-3">
            <button
              onClick={() => toggleTaskCompleted(task.id)}
              className="relative mt-0.5 flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 cursor-pointer transition-colors"
              style={{
                borderColor: task.isCompleted ? PRIORITY_COLORS[task.priority] : "rgba(255,255,255,0.3)",
                background: task.isCompleted ? PRIORITY_COLORS[task.priority] : "transparent",
              }}
            >
              <AnimatePresence>
                {task.isCompleted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={13} className="text-white" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm md:text-base font-medium truncate ${
                    task.isCompleted ? "line-through text-white/40" : "text-white"
                  }`}
                >
                  {task.title}
                </p>
                <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onEdit(task)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {task.description && (
                <p className="text-xs text-white/45 truncate">{task.description}</p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <GlassBadge color={PRIORITY_COLORS[task.priority]}>
                  {PRIORITY_LABELS[task.priority]}
                </GlassBadge>
                {task.tags.map((tag) => (
                  <GlassBadge key={tag} color="#9a9aa5">
                    {tag}
                  </GlassBadge>
                ))}
                {task.subtasks.length > 0 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white cursor-pointer ml-auto"
                  >
                    {doneSubtasks}/{task.subtasks.length}
                    <ChevronDown
                      size={13}
                      className="transition-transform"
                      style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {expanded && task.subtasks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden flex flex-col gap-1.5 pt-1"
                  >
                    {task.subtasks.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleSubtask(task.id, s.id)}
                        className="flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span
                          className="flex items-center justify-center w-4 h-4 rounded-full border shrink-0"
                          style={{
                            borderColor: s.done ? "var(--habitos)" : "rgba(255,255,255,0.3)",
                            background: s.done ? "var(--habitos)" : "transparent",
                          }}
                        >
                          {s.done && <Check size={10} className="text-white" />}
                        </span>
                        <span
                          className={`text-xs ${s.done ? "line-through text-white/35" : "text-white/70"}`}
                        >
                          {s.title}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
