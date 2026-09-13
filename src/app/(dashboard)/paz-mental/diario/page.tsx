"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, BookHeart, HeartHandshake, LineChart as LineChartIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { differenceInCalendarDays, format } from "date-fns";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassModal } from "@/components/glass/glass-modal";
import { usePazMentalStore, todayISO } from "@/lib/store/pazMentalStore";

const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😄"] as const;

type Tab = "diario" | "gratitud" | "emociones";

export default function DiarioPage() {
  const [tab, setTab] = useState<Tab>("diario");

  const journalEntries = usePazMentalStore((s) => s.journalEntries);
  const addJournalEntry = usePazMentalStore((s) => s.addJournalEntry);
  const moodEntries = usePazMentalStore((s) => s.moodEntries);
  const addMoodEntry = usePazMentalStore((s) => s.addMoodEntry);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tagsInput, setTagsInput] = useState("");

  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [g3, setG3] = useState("");

  const todayMood = moodEntries.find((m) => m.date === todayISO());

  function submitEntry() {
    if (!title.trim() || !content.trim()) return;
    addJournalEntry({
      title: title.trim(),
      content: content.trim(),
      mood,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setTitle("");
    setContent("");
    setTagsInput("");
    setMood(3);
    setModalOpen(false);
  }

  function submitGratitude() {
    const items = [g1, g2, g3].map((g) => g.trim()).filter(Boolean);
    if (items.length === 0) return;
    addMoodEntry({
      level: todayMood?.level ?? 4,
      emoji: todayMood?.emoji ?? "🙂",
      gratitudeItems: items,
    });
    setG1("");
    setG2("");
    setG3("");
  }

  const last30 = useMemo(() => {
    const now = new Date();
    return moodEntries
      .filter((m) => differenceInCalendarDays(now, new Date(m.date)) < 30)
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((m) => ({ date: format(new Date(m.date), "dd/MM"), humor: m.level }));
  }, [moodEntries]);

  const weeklyAvg = useMemo(() => {
    const now = new Date();
    const week = moodEntries.filter((m) => differenceInCalendarDays(now, new Date(m.date)) < 7);
    if (week.length === 0) return "-";
    return (week.reduce((s, m) => s + m.level, 0) / week.length).toFixed(1);
  }, [moodEntries]);

  const mostFrequentEmoji = useMemo(() => {
    const counts: Record<string, number> = {};
    moodEntries.forEach((m) => (counts[m.emoji] = (counts[m.emoji] ?? 0) + 1));
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] ?? "—";
  }, [moodEntries]);

  const gratitudeHistory = moodEntries
    .filter((m) => m.gratitudeItems.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Diario
          </h1>
        </div>
      </header>

      <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] glass-specular-ring w-full sm:w-fit">
        {([
          { id: "diario", label: "Diario", icon: BookHeart },
          { id: "gratitud", label: "Gratitud", icon: HeartHandshake },
          { id: "emociones", label: "Emociones", icon: LineChartIcon },
        ] as { id: Tab; label: string; icon: typeof BookHeart }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.id ? "var(--paz-mental)" : "transparent",
              color: tab === t.id ? "#04201c" : "rgba(255,255,255,0.6)",
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "diario" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/80">Tus entradas</p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
              style={{ background: "var(--paz-mental)", color: "#04201c" }}
            >
              <Plus size={18} />
            </button>
          </div>
          {journalEntries.length === 0 ? (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-white/45">Aún no tienes entradas. Escribe la primera.</p>
            </GlassCard>
          ) : (
            journalEntries.map((entry) => (
              <GlassCard key={entry.id} padding="sm" className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{entry.mood ? MOOD_EMOJIS[entry.mood - 1] : "📝"}</span>
                  <p className="text-sm font-medium text-white">{entry.title}</p>
                  <span className="text-xs text-white/35 ml-auto">{entry.date}</span>
                </div>
                <p className="text-xs text-white/50 line-clamp-2">{entry.content}</p>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--paz-mental)1A", color: "var(--paz-mental)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))
          )}
        </div>
      )}

      {tab === "gratitud" && (
        <div className="flex flex-col gap-4">
          <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white/85">
              3 cosas por las que estoy agradecido hoy
            </p>
            <GlassInput value={g1} onChange={(e) => setG1(e.target.value)} placeholder="1. ..." />
            <GlassInput value={g2} onChange={(e) => setG2(e.target.value)} placeholder="2. ..." />
            <GlassInput value={g3} onChange={(e) => setG3(e.target.value)} placeholder="3. ..." />
            <GlassButton accentColor="var(--paz-mental)" onClick={submitGratitude}>
              Guardar gratitud de hoy
            </GlassButton>
          </GlassCard>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white/80">Días anteriores</p>
            {gratitudeHistory.length === 0 ? (
              <GlassCard className="text-center py-8">
                <p className="text-sm text-white/45">Sin registros de gratitud todavía.</p>
              </GlassCard>
            ) : (
              gratitudeHistory.map((m) => (
                <GlassCard key={m.id} padding="sm" className="flex flex-col gap-1.5">
                  <p className="text-xs text-white/40">{m.date}</p>
                  <ul className="flex flex-col gap-0.5">
                    {m.gratitudeItems.map((item, i) => (
                      <li key={i} className="text-sm text-white/70">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "emociones" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-1">
              <p className="text-xs text-white/50">Promedio semanal</p>
              <p className="text-2xl font-semibold">{weeklyAvg}</p>
            </GlassCard>
            <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-1">
              <p className="text-xs text-white/50">Emoji más frecuente</p>
              <p className="text-2xl font-semibold">{mostFrequentEmoji}</p>
            </GlassCard>
          </div>
          <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-white/80">Últimos 30 días</p>
            {last30.length === 0 ? (
              <p className="text-sm text-white/45 text-center py-8">Sin datos suficientes todavía.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={last30}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <YAxis domain={[1, 5]} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="humor" stroke="var(--paz-mental)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva entrada">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Título</label>
            <GlassInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de tu entrada" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Contenido</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Escribe lo que sientes..."
              className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:shadow-[var(--glass-specular-strong)] focus:bg-white/[0.09] resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Humor</label>
            <div className="flex justify-between">
              {MOOD_EMOJIS.map((emoji, i) => {
                const level = (i + 1) as 1 | 2 | 3 | 4 | 5;
                return (
                  <button
                    key={i}
                    onClick={() => setMood(level)}
                    className="text-2xl rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
                    style={{
                      background: mood === level ? "var(--paz-mental)22" : "transparent",
                      border: `1px solid ${mood === level ? "var(--paz-mental)" : "transparent"}`,
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Tags (separados por coma)</label>
            <GlassInput value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="trabajo, familia..." />
          </div>
          <GlassButton accentColor="var(--paz-mental)" onClick={submitEntry} className="w-full">
            Guardar entrada
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
