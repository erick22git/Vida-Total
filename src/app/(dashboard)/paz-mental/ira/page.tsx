"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Wind, Lightbulb } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassModal } from "@/components/glass/glass-modal";
import { usePazMentalStore } from "@/lib/store/pazMentalStore";
import { differenceInCalendarDays, format } from "date-fns";

const TIPS = [
  "Cuenta hasta 10 antes de responder cuando sientas que la ira sube.",
  "Respirar profundo activa tu sistema nervioso parasimpático y te calma.",
  "Identifica el detonante: nombrar la emoción reduce su intensidad.",
  "Sal a caminar unos minutos antes de reaccionar a una situación tensa.",
  "Escribe lo que sientes en el diario en vez de decirlo de inmediato.",
  "Pregúntate: ¿esto me importará en una semana?",
  "La ira suele esconder tristeza o miedo. Investiga qué hay debajo.",
];

function intensityColor(v: number) {
  if (v <= 3) return "#22c55e";
  if (v <= 6) return "#eab308";
  return "#ef4444";
}

export default function IraPage() {
  const angerEpisodes = usePazMentalStore((s) => s.angerEpisodes);
  const addAngerEpisode = usePazMentalStore((s) => s.addAngerEpisode);

  const [intensity, setIntensity] = useState(5);
  const [modalOpen, setModalOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [technique, setTechnique] = useState("");
  const [outcome, setOutcome] = useState("");
  const [formIntensity, setFormIntensity] = useState(5);

  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const tip = TIPS[dayOfYear % TIPS.length];

  const topTriggers = useMemo(() => {
    const counts: Record<string, number> = {};
    angerEpisodes.forEach((e) => {
      const key = e.trigger.trim().toLowerCase();
      if (!key) return;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [angerEpisodes]);

  const weeklyChart = useMemo(() => {
    const now = new Date();
    const map: Record<string, { total: number; count: number }> = {};
    angerEpisodes.forEach((e) => {
      const diff = differenceInCalendarDays(now, new Date(e.date));
      if (diff >= 0 && diff < 7) {
        if (!map[e.date]) map[e.date] = { total: 0, count: 0 };
        map[e.date].total += e.intensity;
        map[e.date].count += 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, v]) => ({
        date: format(new Date(date), "dd/MM"),
        promedio: Number((v.total / v.count).toFixed(1)),
      }));
  }, [angerEpisodes]);

  const weeklyAvg = useMemo(() => {
    if (weeklyChart.length === 0) return 0;
    const sum = weeklyChart.reduce((s, d) => s + d.promedio, 0);
    return (sum / weeklyChart.length).toFixed(1);
  }, [weeklyChart]);

  function submitEpisode() {
    if (!trigger.trim()) return;
    addAngerEpisode({
      trigger: trigger.trim(),
      intensity: formIntensity,
      technique: technique.trim() || "Sin especificar",
      outcome: outcome.trim() || undefined,
    });
    setTrigger("");
    setTechnique("");
    setOutcome("");
    setFormIntensity(5);
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Control de Ira
          </h1>
        </div>
      </header>

      <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-5">
        <p className="text-sm font-semibold text-white/85">¿Estás enojado ahora?</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Intensidad</span>
            <span className="font-semibold" style={{ color: intensityColor(intensity) }}>
              {intensity}/10
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: intensityColor(intensity) }}
          />
          <div
            className="h-1.5 w-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)",
            }}
          />
        </div>
        <Link href="/paz-mental/meditacion">
          <GlassButton accentColor="var(--paz-mental)" className="w-full">
            <Wind size={18} /> Iniciar técnica de calma (4-7-8)
          </GlassButton>
        </Link>
      </GlassCard>

      <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Lightbulb size={16} style={{ color: "var(--paz-mental)" }} />
          <p className="font-semibold text-white/85">Tip del día</p>
        </div>
        <p className="text-sm text-white/60">{tip}</p>
      </GlassCard>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Episodios recientes</p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
            style={{ background: "var(--paz-mental)", color: "#04201c" }}
          >
            <Plus size={18} />
          </button>
        </div>
        {angerEpisodes.length === 0 ? (
          <GlassCard className="text-center py-8">
            <p className="text-sm text-white/45">Aún no registras episodios.</p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {angerEpisodes.slice(0, 8).map((ep) => (
              <GlassCard key={ep.id} padding="sm" className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{ep.trigger}</p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: intensityColor(ep.intensity),
                      background: `${intensityColor(ep.intensity)}22`,
                    }}
                  >
                    {ep.intensity}/10
                  </span>
                </div>
                <p className="text-xs text-white/45">
                  {ep.date} · Técnica: {ep.technique}
                  {ep.outcome ? ` · Resultado: ${ep.outcome}` : ""}
                </p>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/80">Tus patrones</p>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/50">Detonantes más frecuentes</p>
          {topTriggers.length === 0 ? (
            <p className="text-xs text-white/35">Sin datos suficientes todavía.</p>
          ) : (
            topTriggers.map(([t, count]) => (
              <div key={t} className="flex items-center justify-between text-sm">
                <span className="text-white/70 capitalize">{t}</span>
                <span className="text-white/40">{count}x</span>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
          <span className="text-white/50">Intensidad promedio (semana)</span>
          <span className="font-semibold text-white">{weeklyAvg}</span>
        </div>
        {weeklyChart.length > 0 && (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="promedio" stroke="var(--paz-mental)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar episodio">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Detonante</label>
            <GlassInput
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="¿Qué causó el enojo?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Intensidad: {formIntensity}/10</label>
            <input
              type="range"
              min={1}
              max={10}
              value={formIntensity}
              onChange={(e) => setFormIntensity(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: intensityColor(formIntensity) }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Técnica usada</label>
            <GlassInput
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              placeholder="Respiración, caminar, escribir..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Resultado (opcional)</label>
            <GlassInput
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="¿Cómo terminó?"
            />
          </div>
          <GlassButton accentColor="var(--paz-mental)" onClick={submitEpisode} className="w-full">
            Guardar episodio
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
