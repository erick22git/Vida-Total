"use client";

import Link from "next/link";
import { ChevronRight, Mic, HandHeart, Presentation, Flame } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import {
  useVoiceStreak,
  useTodayVoiceLesson,
  VOICE_CATEGORY_LABEL,
} from "@/lib/store/voiceStore";

const SECTIONS = [
  {
    href: "/voz/entrenamiento",
    icon: Mic,
    title: "Entrenamiento de Voz",
    desc: "Habla con más resonancia",
  },
  {
    href: "/voz/lenguaje-no-verbal",
    icon: HandHeart,
    title: "Lenguaje No Verbal",
    desc: "Comunica sin palabras",
  },
  {
    href: "/voz/oratoria",
    icon: Presentation,
    title: "Oratoria",
    desc: "Domina el escenario",
  },
];

export default function VozHubPage() {
  const streak = useVoiceStreak();
  const todayLesson = useTodayVoiceLesson();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Mic style={{ color: "var(--voz)" }} /> Voz &amp; Comunicación
        </h1>
      </header>

      <GlassCard accentColor="var(--voz)" glow className="flex items-center gap-4">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-2xl shrink-0"
          style={{ background: "var(--voz)22" }}
        >
          <Flame size={22} style={{ color: "var(--voz)" }} />
        </div>
        <div className="flex flex-col">
          <p className="text-2xl font-semibold">
            {streak} <span className="text-white/40 text-base font-normal">días de racha</span>
          </p>
          <p className="text-xs text-white/45">
            {streak > 0
              ? "Sigue practicando para no perder tu racha."
              : "Practica hoy para empezar tu racha."}
          </p>
        </div>
      </GlassCard>

      <Link href="/voz/entrenamiento">
        <GlassCard accentColor="var(--voz)" glow className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/70">Lección de hoy</p>
            <GlassBadge color="var(--voz)">
              {VOICE_CATEGORY_LABEL[todayLesson.category]}
            </GlassBadge>
          </div>
          <p className="text-lg font-semibold text-white">{todayLesson.title}</p>
          <p className="text-sm text-white/55">{todayLesson.description}</p>
          <span className="text-sm font-medium" style={{ color: "var(--voz)" }}>
            Practicar ahora →
          </span>
        </GlassCard>
      </Link>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <GlassCard accentColor="var(--voz)" glow className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{ background: "var(--voz)22" }}
                >
                  <s.icon size={20} style={{ color: "var(--voz)" }} />
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
    </div>
  );
}
