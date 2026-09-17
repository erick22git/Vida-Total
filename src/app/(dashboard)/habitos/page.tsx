"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock,
  Flame,
  ListTodo,
  Rows3,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  useHabitsCompletedToday,
  useHabitsStore,
  useTodayTasks,
} from "@/lib/store/habitsStore";
import { getHabitIcon } from "@/lib/habits-utils";

export default function HabitosHubPage() {
  const habits = useHabitsStore((s) => s.habits);
  const toggleHabitToday = useHabitsStore((s) => s.toggleHabitToday);
  const { completed, total } = useHabitsCompletedToday();
  const todayTasks = useTodayTasks();
  const pendingTasks = todayTasks.filter((t) => !t.isCompleted).length;
  const today = new Date().toISOString().slice(0, 10);

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
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarCheck2 style={{ color: "var(--habitos)" }} /> Hábitos
        </h1>
      </header>

      <GlassCard accentColor="var(--habitos)" glow className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-white/55">
              <Flame size={15} style={{ color: "var(--habitos)" }} />
              Hábitos hoy
            </div>
            <p className="text-2xl font-semibold">
              {completed}
              <span className="text-white/40 text-base font-normal"> / {total}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-white/55">
              <Clock size={15} style={{ color: "var(--habitos)" }} />
              Tareas pendientes
            </div>
            <p className="text-2xl font-semibold">{pendingTasks}</p>
          </div>
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
        <p className="text-sm font-semibold text-white/80">Hábitos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {habits.map((h) => {
            const Icon = getHabitIcon(h.icon);
            const doneToday = h.completedDates.includes(today);
            return (
              <GlassCard
                key={h.id}
                padding="sm"
                accentColor="var(--habitos)"
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{ background: "var(--habitos)22" }}
                  >
                    <Icon size={17} style={{ color: "var(--habitos)" }} />
                  </div>
                  <button
                    onClick={() => toggleHabitToday(h.id)}
                    className="relative flex items-center justify-center w-7 h-7 rounded-full border cursor-pointer transition-colors"
                    style={{
                      borderColor: doneToday ? "var(--habitos)" : "rgba(255,255,255,0.25)",
                      background: doneToday ? "var(--habitos)" : "transparent",
                    }}
                  >
                    <AnimatePresence>
                      {doneToday && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <Check size={14} className="text-white" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-white truncate">{h.name}</p>
                  <div className="flex items-center gap-1 text-xs text-white/45">
                    <Flame size={12} className="text-orange-400" />
                    {h.streak} días
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
