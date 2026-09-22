"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { useHabitsStore } from "@/lib/store/habitsStore";
import { getHabitIcon } from "@/lib/habits-utils";
import type { RoutineStep } from "@/lib/types/habits";

type DraftStep = Omit<RoutineStep, "id" | "completedDates">;

export default function NuevaRutinaPage() {
  const router = useRouter();
  const habits = useHabitsStore((s) => s.habits);
  const addRoutine = useHabitsStore((s) => s.addRoutine);

  const [nombre, setNombre] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [hora, setHora] = useState("07:00");
  const [label, setLabel] = useState("");
  const [habitId, setHabitId] = useState<string>("");

  function addStep() {
    if (!label.trim()) return;
    setSteps((s) => [...s, { hora, label: label.trim(), habitId: habitId || undefined }].sort((a, b) => a.hora.localeCompare(b.hora)));
    setLabel("");
    setHabitId("");
  }

  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }

  function handleCreate() {
    if (!nombre.trim() || steps.length === 0) return;
    const created = addRoutine(nombre.trim(), steps);
    router.push(`/rutinas/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Nueva rutina</h1>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Nombre</span>
        <GlassInput placeholder="Rutina de mañana" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Pasos</span>
        {steps.map((s, i) => {
          const habit = s.habitId ? habits.find((h) => h.id === s.habitId) : undefined;
          const Icon = habit ? getHabitIcon(habit.icon) : undefined;
          return (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] glass-specular-ring px-3.5 py-2.5">
              <span className="text-xs font-semibold text-white/60 tabular-nums w-11 shrink-0">{s.hora}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{s.label}</p>
                {habit && (
                  <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                    {Icon && <Icon size={11} />} vinculado a {habit.name}
                  </p>
                )}
              </div>
              <button onClick={() => removeStep(i)} className="text-white/30 hover:text-red-400 cursor-pointer shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}

        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/15 p-3.5">
          <div className="flex gap-2">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="rounded-lg bg-white/[0.05] glass-specular-ring px-2 py-2 text-sm text-white outline-none w-24"
            />
            <input
              type="text"
              placeholder="Ej: beber agua"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 rounded-lg bg-white/[0.05] glass-specular-ring px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none"
            />
          </div>
          <select
            value={habitId}
            onChange={(e) => setHabitId(e.target.value)}
            className="rounded-lg bg-white/[0.05] glass-specular-ring px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Sin vincular a ningún hábito</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                Vincular a: {h.name}
              </option>
            ))}
          </select>
          <button
            onClick={addStep}
            disabled={!label.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-white/70 hover:text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <Plus size={14} /> Agregar paso
          </button>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!nombre.trim() || steps.length === 0}
        className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer disabled:cursor-not-allowed transition-[box-shadow,background-color] duration-300"
        style={{
          background: nombre.trim() && steps.length > 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
          boxShadow:
            nombre.trim() && steps.length > 0
              ? "0 0 22px 1px rgba(255,255,255,0.35), 0 10px 24px rgba(0,0,0,0.35)"
              : "0 0 14px 1px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.35)",
        }}
      >
        Crear rutina
      </button>
    </div>
  );
}
