"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  ChevronRight,
  ListTodo,
  Rows3,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { HabitOrbsCard, habitHref } from "@/components/habitos/habit-orbs-card";
import { NewHabitFlow } from "@/components/habitos/new-habit-flow";
import { usePreferencesStore } from "@/lib/store/preferencesStore";

export default function HabitosHubPage() {
  const router = useRouter();
  const habits = useHabitsStore((s) => s.habits);
  const addHabit = useHabitsStore((s) => s.addHabit);
  const today = todayISO();
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

      <HabitOrbsCard habits={habits} todayISO={today} onCreate={() => setCreateOpen(true)} />

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

      <NewHabitFlow
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => router.push(habitHref(addHabit(input)))}
      />
    </div>
  );
}
