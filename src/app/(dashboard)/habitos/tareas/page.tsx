"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ListTodo, Plus, Send } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { useHabitsStore, todayISO } from "@/lib/store/habitsStore";
import { TaskItem } from "@/components/habitos/task-item";
import { TaskModal } from "@/components/habitos/task-modal";
import type { Task } from "@/lib/types/habits";

type FilterId = "todas" | "hoy" | "pendientes" | "completadas";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "hoy", label: "Hoy" },
  { id: "pendientes", label: "Pendientes" },
  { id: "completadas", label: "Completadas" },
];

export default function TareasPage() {
  const tasks = useHabitsStore((s) => s.tasks);
  const addTask = useHabitsStore((s) => s.addTask);
  const [filter, setFilter] = useState<FilterId>("todas");
  const [quickInput, setQuickInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const today = todayISO();

  const filtered = useMemo(() => {
    switch (filter) {
      case "hoy":
        return tasks.filter((t) => t.dueDate === today);
      case "pendientes":
        return tasks.filter((t) => !t.isCompleted);
      case "completadas":
        return tasks.filter((t) => t.isCompleted);
      default:
        return tasks;
    }
  }, [tasks, filter, today]);

  function handleQuickAdd() {
    if (!quickInput.trim()) return;
    addTask({ title: quickInput.trim(), priority: "media", dueDate: today });
    setQuickInput("");
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  function openCreate() {
    setEditingTask(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/habitos" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ListTodo size={20} style={{ color: "var(--habitos)" }} /> Tareas
        </h1>
      </header>

      <div className="flex items-center gap-2">
        <GlassInput
          placeholder="Capturar tarea rápida..."
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
        />
        <button
          onClick={handleQuickAdd}
          className="flex items-center justify-center w-11 h-11 shrink-0 rounded-2xl cursor-pointer"
          style={{ background: "var(--habitos)", boxShadow: "0 4px 16px var(--habitos)55" }}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs md:text-sm font-medium cursor-pointer border transition-colors"
            style={{
              color: filter === f.id ? "white" : "rgba(255,255,255,0.55)",
              background: filter === f.id ? "var(--habitos)" : "rgba(255,255,255,0.05)",
              borderColor: filter === f.id ? "var(--habitos)" : "rgba(255,255,255,0.12)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-sm text-white/35 text-center py-10">
            No hay tareas en esta vista.
          </p>
        )}
        {filtered.map((task) => (
          <TaskItem key={task.id} task={task} onEdit={openEdit} />
        ))}
      </div>

      <button
        onClick={openCreate}
        className="fixed bottom-24 md:bottom-8 right-6 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer z-30"
        style={{ background: "var(--habitos)", boxShadow: "0 4px 24px var(--habitos)77" }}
      >
        <Plus size={24} className="text-white" />
      </button>

      {modalOpen && (
        <TaskModal
          key={editingTask?.id ?? "new"}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          task={editingTask}
        />
      )}
    </div>
  );
}
