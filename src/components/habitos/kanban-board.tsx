"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/habits-utils";
import { useHabitsStore } from "@/lib/store/habitsStore";
import type { KanbanColumnId } from "@/lib/types/habits";

export function KanbanBoard() {
  const tasks = useHabitsStore((s) => s.tasks);
  const columns = useHabitsStore((s) => s.kanbanColumns);
  const moveTaskToColumn = useHabitsStore((s) => s.moveTaskToColumn);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  return (
    <div className="flex sm:grid sm:grid-cols-3 gap-4 overflow-x-auto no-scrollbar sm:overflow-visible snap-x snap-mandatory scroll-px-1 -mx-4 px-4 sm:mx-0 sm:px-0">
      {columns.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragTaskId) moveTaskToColumn(dragTaskId, col.id as KanbanColumnId);
          }}
          className="flex flex-col gap-3 rounded-3xl bg-white/[0.03] glass-specular-ring p-3 min-h-[200px] shrink-0 w-[78vw] sm:w-auto snap-start"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-white/80">{col.title}</p>
            <span className="text-xs text-white/40">{col.taskIds.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {col.taskIds.map((taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              if (!task) return null;
              return (
                <motion.div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => setDragTaskId(null)}
                  layout
                  whileDrag={{ scale: 1.03 }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <GlassCard padding="sm" interactive={false} className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <GlassBadge color={PRIORITY_COLORS[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </GlassBadge>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
            {col.taskIds.length === 0 && (
              <p className="text-xs text-white/25 text-center py-6">Sin tareas</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
