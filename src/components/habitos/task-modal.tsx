"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import type { Task, TaskPriority } from "@/lib/types/habits";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/habits-utils";
import { useHabitsStore, todayISO } from "@/lib/store/habitsStore";

const PRIORITIES: TaskPriority[] = ["alta", "media", "baja"];

export function TaskModal({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
}) {
  const addTask = useHabitsStore((s) => s.addTask);
  const updateTask = useHabitsStore((s) => s.updateTask);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "media");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayISO());
  const [tagsInput, setTagsInput] = useState(task?.tags.join(", ") ?? "");
  const [subtasks, setSubtasks] = useState<{ id: string; title: string; done: boolean }[]>(
    task?.subtasks ?? [],
  );
  const [newSubtask, setNewSubtask] = useState("");

  function handleAddSubtask() {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), title: newSubtask.trim(), done: false },
    ]);
    setNewSubtask("");
  }

  function handleSave() {
    if (!title.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (task) {
      updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate,
        tags,
        subtasks,
      });
    } else {
      addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate,
        tags,
        subtasks,
      });
    }
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title={task ? "Editar tarea" : "Nueva tarea"}>
      <div className="flex flex-col gap-4">
        <GlassInput
          placeholder="Título de la tarea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] backdrop-blur-md px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/30 resize-none"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Prioridad</label>
          <div className="flex items-center gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="flex-1 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer border transition-colors"
                style={{
                  color: priority === p ? "white" : PRIORITY_COLORS[p],
                  background: priority === p ? PRIORITY_COLORS[p] : `${PRIORITY_COLORS[p]}1A`,
                  borderColor: `${PRIORITY_COLORS[p]}55`,
                }}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Fecha</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] backdrop-blur-md px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
          />
        </div>

        <GlassInput
          placeholder="Tags separados por coma"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <label className="text-xs text-white/50">Subtareas</label>
          {subtasks.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 bg-white/[0.04] rounded-xl px-3 py-2"
            >
              <span className="text-sm text-white/80">{s.title}</span>
              <button
                onClick={() => setSubtasks((prev) => prev.filter((x) => x.id !== s.id))}
                className="text-white/30 hover:text-white/70 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <GlassInput
              placeholder="Agregar subtarea"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
            />
            <button
              onClick={handleAddSubtask}
              className="flex items-center justify-center w-10 h-10 shrink-0 rounded-2xl cursor-pointer"
              style={{ background: "var(--habitos)" }}
            >
              <Plus size={16} className="text-white" />
            </button>
          </div>
        </div>

        <GlassButton accentColor="var(--habitos)" onClick={handleSave} className="w-full">
          {task ? "Guardar cambios" : "Crear tarea"}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
