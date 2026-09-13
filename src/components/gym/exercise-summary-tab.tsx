"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { HelpCircle } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import type { WorkoutSession } from "@/lib/types";

const METRICS = ["Media de volumen por sesión", "Peso máximo", "Repeticiones totales"];
const PERIODS = ["Semana", "Mes", "Año"];

export function ExerciseSummaryTab({
  exerciseId,
  sessions,
}: {
  exerciseId: string;
  sessions: WorkoutSession[];
}) {
  const [metric, setMetric] = useState(METRICS[0]);
  const [period, setPeriod] = useState(PERIODS[1]);
  const [howToOpen, setHowToOpen] = useState(false);

  const exerciseSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.ejercicios.some((e) => e.exerciseId === exerciseId))
        .slice()
        .reverse(),
    [sessions, exerciseId],
  );

  const chartData = useMemo(
    () =>
      exerciseSessions.map((s) => {
        const log = s.ejercicios.find((e) => e.exerciseId === exerciseId)!;
        const completedSets = log.sets.filter((set) => set.completado);
        const volume = completedSets.reduce((sum, set) => sum + set.peso * set.reps, 0);
        return {
          date: format(new Date(s.date), "d MMM", { locale: es }),
          volumen: metric === METRICS[0] ? (completedSets.length ? Math.round(volume / completedSets.length) : 0) : volume,
        };
      }),
    [exerciseSessions, exerciseId, metric],
  );

  const records = useMemo(() => {
    let bestSetVolume = 0;
    let bestSessionVolume = 0;
    let maxPeso = 0;
    let oneRepMax = 0;
    for (const s of exerciseSessions) {
      const log = s.ejercicios.find((e) => e.exerciseId === exerciseId)!;
      let sessionVolume = 0;
      for (const set of log.sets) {
        if (!set.completado) continue;
        const vol = set.peso * set.reps;
        sessionVolume += vol;
        if (vol > bestSetVolume) bestSetVolume = vol;
        if (set.peso > maxPeso) maxPeso = set.peso;
        const epley = set.peso * (1 + set.reps / 30);
        if (epley > oneRepMax) oneRepMax = epley;
      }
      if (sessionVolume > bestSessionVolume) bestSessionVolume = sessionVolume;
    }
    return { bestSetVolume, bestSessionVolume, maxPeso, oneRepMax: Math.round(oneRepMax) };
  }, [exerciseSessions, exerciseId]);

  const hasData = exerciseSessions.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => setHowToOpen(true)}
        className="flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium cursor-pointer"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
      >
        <HelpCircle size={15} /> Cómo registrar el peso
      </button>

      <div>
        <p className="text-sm font-semibold text-white/80 mb-2.5">Tus estadísticas</p>
        <div className="flex gap-2 mb-3">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="flex-1 rounded-xl bg-white/[0.06] glass-specular-ring px-3 py-2 text-xs text-white outline-none"
          >
            {METRICS.map((m) => (
              <option key={m} value={m} className="bg-[#141420]">
                {m}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-28 rounded-xl bg-white/[0.06] glass-specular-ring px-3 py-2 text-xs text-white outline-none"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p} className="bg-[#141420]">
                {p}
              </option>
            ))}
          </select>
        </div>
        <GlassCard interactive={false} padding="sm" className="h-48">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "white" }}
                />
                <Line type="monotone" dataKey="volumen" stroke="var(--gym)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gym)" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-white/30">
              No tienes datos aquí
            </div>
          )}
        </GlassCard>
      </div>

      <div>
        <p className="text-sm font-semibold text-white/80 mb-2.5">Tus récords personales</p>
        <div className="grid grid-cols-2 gap-3">
          <RecordCard label="Serie de volumen" value={hasData ? `${records.bestSetVolume.toLocaleString()} kg` : null} />
          <RecordCard label="Sesión de volumen" value={hasData ? `${records.bestSessionVolume.toLocaleString()} kg` : null} />
          <RecordCard label="Mayor peso" value={hasData && records.maxPeso > 0 ? `${records.maxPeso} kg` : null} />
          <RecordCard label="1 repetición máxima" value={hasData && records.oneRepMax > 0 ? `${records.oneRepMax} kg` : null} />
        </div>
      </div>

      <GlassModal open={howToOpen} onClose={() => setHowToOpen(false)} title="Cómo registrar el peso">
        <p className="text-sm text-white/70 leading-relaxed">
          Registra siempre el peso total que mueves, incluyendo el peso de la barra u otros implementos. Para
          ejercicios con peso corporal, registra solo el peso adicional (lastre) si lo usas.
        </p>
      </GlassModal>
    </div>
  );
}

function RecordCard({ label, value }: { label: string; value: string | null }) {
  return (
    <GlassCard padding="sm" interactive={false} className="flex flex-col gap-1">
      <p className="text-[11px] text-white/45">{label}</p>
      <p className="text-base font-semibold text-white">{value ?? "No tienes datos aquí"}</p>
    </GlassCard>
  );
}
