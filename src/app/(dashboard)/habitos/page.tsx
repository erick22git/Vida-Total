"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  ChevronRight,
  Clock,
  Flame,
  ListTodo,
  Plus,
  Rows3,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  useHabitsCompletedToday,
  useHabitsStore,
  useTodayTasks,
} from "@/lib/store/habitsStore";
import { getHabitIcon } from "@/lib/habits-utils";
import { getCategory } from "@/lib/data/habit-categories";
import { computeStreak } from "@/lib/progress";
import { HabitCheckButton } from "@/components/animations/HabitCheckButton";
import { HabitsProgressHero } from "@/components/habitos/habits-progress-hero";
import { CreateHabitModal } from "@/components/habitos/create-habit-modal";
import { useEffectiveReduceMotion, usePreferencesStore } from "@/lib/store/preferencesStore";

export default function HabitosHubPage() {
  const habits = useHabitsStore((s) => s.habits);
  const toggleHabitToday = useHabitsStore((s) => s.toggleHabitToday);
  const addHabit = useHabitsStore((s) => s.addHabit);
  const { completed, total } = useHabitsCompletedToday();
  const todayTasks = useTodayTasks();
  const pendingTasks = todayTasks.filter((t) => !t.isCompleted).length;
  const today = new Date().toISOString().slice(0, 10);
  const reduceMotion = useEffectiveReduceMotion();
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled);
  const [createOpen, setCreateOpen] = useState(false);

  const sections = [
    {
      href: "/habitos/timeline",
      icon: Rows3,
      title: "Timeline",
      desc: "Tu día hora por hora, estilo Structured",
    },
    {
      href: "/habitos/tareas",
      icon: ListTodo,
      title: "Tareas",
      desc: "Captura e inbox rápido, estilo TickTick",
    },
    {
      href: "/habitos/workspace",
      icon: CalendarCheck2,
      title: "Workspace",
      desc: "Páginas y tablero, estilo Notion",
    },
  ];

  return (
    // El fondo de foto ya lo pone habitos/layout.tsx (compartido por todas
    // las pantallas de Hábitos).
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-white/50 text-sm md:text-base">Módulo</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarCheck2 style={{ color: "var(--habitos)" }} /> Hábitos
          </h1>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/50 hover:text-white cursor-pointer shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}
          title={soundEnabled ? "Silenciar sonido" : "Activar sonido"}
          aria-label={soundEnabled ? "Silenciar sonido" : "Activar sonido"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </header>

      <GlassCard accentColor="var(--habitos)" glow className="flex flex-col gap-4">
        <HabitsProgressHero completed={completed} total={total} />
        <div className="h-px bg-white/10" />
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Clock size={15} style={{ color: "var(--habitos)" }} />
          {pendingTasks} tarea{pendingTasks !== 1 ? "s" : ""} pendiente{pendingTasks !== 1 ? "s" : ""}
        </div>
      </GlassCard>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <GlassCard
              accentColor="var(--habitos)"
              glow
              className="flex flex-col gap-4 h-full"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{ background: "var(--habitos)22" }}
                >
                  <s.icon size={20} style={{ color: "var(--habitos)" }} />
                </div>
                <ChevronRight size={18} className="text-white/30" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold">{s.title}</p>
                <p className="text-sm text-white/55">{s.desc}</p>
              </div>
            </GlassCard>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Hábitos rápidos</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white cursor-pointer"
          >
            <Plus size={13} /> Nuevo
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {habits.map((h) => {
            const category = getCategory(h.categoryId);
            const Icon = getHabitIcon(h.icon);
            const accent = category?.color ?? "var(--habitos)";
            const doneToday = h.completedDates.includes(today);
            // Derivado en cada render — nunca depende de que el usuario haya
            // vuelto a tocar el hábito para "enterarse" de que la racha se
            // rompió (ver src/lib/progress/streak.ts).
            const streak = computeStreak({ completedDates: h.completedDates, frequency: h.frequency });
            return (
              <GlassCard key={h.id} padding="sm" accentColor={accent} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{ background: `${accent}22` }}
                  >
                    <Icon size={17} style={{ color: accent }} />
                  </div>
                  <HabitCheckButton
                    habitId={h.id}
                    done={doneToday}
                    accentColor={accent}
                    reduceMotion={reduceMotion}
                    onToggle={() => toggleHabitToday(h.id)}
                    size={38}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-white truncate">{h.name}</p>
                  <div className="flex items-center gap-1 text-xs text-white/45">
                    <Flame size={12} className="text-orange-400" />
                    {streak} día{streak !== 1 ? "s" : ""}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      <CreateHabitModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => addHabit(input)}
      />
    </div>
  );
}
