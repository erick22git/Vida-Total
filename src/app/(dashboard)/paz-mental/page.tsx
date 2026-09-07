"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Leaf,
  Wind,
  Angry,
  BookHeart,
  MessageCircleHeart,
  PersonStanding,
  Smile,
  Droplet,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { usePazMentalStore, useTodayMood } from "@/lib/store/pazMentalStore";

const MOODS: { level: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { level: 1, emoji: "😞", label: "Mal" },
  { level: 2, emoji: "😕", label: "Bajo" },
  { level: 3, emoji: "😐", label: "Normal" },
  { level: 4, emoji: "🙂", label: "Bien" },
  { level: 5, emoji: "😄", label: "Genial" },
];

const SECTIONS = [
  {
    href: "/paz-mental/meditacion",
    icon: Wind,
    title: "Meditación",
    desc: "Encuentra tu calma",
  },
  {
    href: "/paz-mental/ira",
    icon: Angry,
    title: "Control de Ira",
    desc: "Maneja tus emociones",
  },
  {
    href: "/paz-mental/diario",
    icon: BookHeart,
    title: "Diario",
    desc: "Escribe tus pensamientos",
  },
  {
    href: "/paz-mental/asistente",
    icon: MessageCircleHeart,
    title: "Asistente IA",
    desc: "Habla con tu compañero",
  },
  {
    href: "/paz-mental/yoga",
    icon: PersonStanding,
    title: "Yoga",
    desc: "Cuerpo y mente",
  },
  {
    href: "/paz-mental/yoga-facial",
    icon: Smile,
    title: "Yoga Facial",
    desc: "Rejuvenece tu rostro",
  },
  {
    href: "/paz-mental/piel",
    icon: Droplet,
    title: "Control de Piel",
    desc: "Cuida tu piel",
  },
];

export default function PazMentalHubPage() {
  const addMoodEntry = usePazMentalStore((s) => s.addMoodEntry);
  const todayMood = useTodayMood();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Leaf style={{ color: "var(--paz-mental)" }} /> Paz Mental
        </h1>
      </header>

      <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/85">¿Cómo te sientes hoy?</p>
        <div className="flex items-center justify-between gap-2">
          {MOODS.map((m) => {
            const selected = todayMood?.level === m.level;
            return (
              <motion.button
                key={m.level}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                onClick={() => addMoodEntry({ level: m.level, emoji: m.emoji, gratitudeItems: [] })}
                className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 flex-1 transition-colors cursor-pointer"
                style={{
                  background: selected ? "var(--paz-mental)22" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selected ? "var(--paz-mental)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[11px] text-white/60">{m.label}</span>
              </motion.button>
            );
          })}
        </div>
        {todayMood && (
          <p className="text-xs text-white/45 text-center">
            Registraste tu humor de hoy como &ldquo;{MOODS.find((m) => m.level === todayMood.level)?.label}&rdquo;. Puedes cambiarlo cuando quieras.
          </p>
        )}
      </GlassCard>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <GlassCard
              accentColor="var(--paz-mental)"
              glow
              className="flex flex-col gap-4 h-full"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{ background: "var(--paz-mental)22" }}
                >
                  <s.icon size={20} style={{ color: "var(--paz-mental)" }} />
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
