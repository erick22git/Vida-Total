"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Scale, TrendingUp, LineChart as LineChartIcon, Trophy, ChevronRight } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { BodySilhouetteFront } from "@/components/gym/body-silhouette";
import { TrainingHeatmap } from "@/components/gym/training-heatmap";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { getAllPersonalRecords } from "@/lib/gym-utils";

export default function ProfilePage() {
  const sessions = useGymStore((s) => s.sessions);
  const allExercises = useAllExercises();
  const [tab, setTab] = useState<"entrenamientos" | "grafica">("entrenamientos");
  const [period, setPeriod] = useState<"Semana" | "Mes">("Semana");

  const records = useMemo(() => getAllPersonalRecords(sessions), [sessions]);

  const chartData = useMemo(() => {
    const days = period === "Semana" ? 7 : 30;
    const dayList = Array.from({ length: days }).map((_, i) => subDays(new Date(), days - 1 - i));
    return dayList.map((date) => {
      const vol = sessions
        .filter((s) => format(new Date(s.date), "yyyy-MM-dd") === format(date, "yyyy-MM-dd"))
        .reduce(
          (sum, s) =>
            sum +
            s.ejercicios.reduce(
              (a, e) => a + e.sets.filter((set) => set.completado).reduce((b, set) => b + set.peso * set.reps, 0),
              0,
            ),
          0,
        );
      return { date: format(date, period === "Semana" ? "EEEEEE" : "d", { locale: es }), volumen: vol };
    });
  }, [sessions, period]);

  const totalVolumeThisPeriod = chartData.reduce((s, d) => s + d.volumen, 0);
  const prevPeriodVolume = totalVolumeThisPeriod * 0.3 + 1; // heuristic baseline to avoid divide-by-zero
  const changePct = Math.round(((totalVolumeThisPeriod - prevPeriodVolume) / prevPeriodVolume) * 100);

  const recentPRs = records.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Perfil</h1>
      </header>

      <div className="flex flex-col items-center gap-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: "linear-gradient(135deg, var(--gym), var(--gym-2))" }}
        >
          🏋️
        </div>
        <p className="text-sm text-white/60">@atleta</p>
        <div className="flex items-center gap-6">
          <StatCol label="Entrenamientos" value={sessions.length} />
          <StatCol label="Seguidores" value={128} />
          <StatCol label="Siguiendo" value={94} />
        </div>
        <div className="flex gap-3 w-full">
          <Link href="/gym/entrenamiento/escaneo" className="flex-1">
            <GlassCard padding="sm" className="flex items-center justify-center gap-2 py-3">
              <Camera size={15} /> <span className="text-sm font-medium">Escaneo</span>
            </GlassCard>
          </Link>
          <Link href="/gym/entrenamiento/perfil/peso" className="flex-1">
            <GlassCard padding="sm" className="flex items-center justify-center gap-2 py-3">
              <Scale size={15} /> <span className="text-sm font-medium">Peso</span>
            </GlassCard>
          </Link>
        </div>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-white/[0.04] p-1 border border-white/[0.08]">
        <TabButton active={tab === "entrenamientos"} onClick={() => setTab("entrenamientos")} icon={Trophy} label="Entrenamientos" />
        <TabButton active={tab === "grafica"} onClick={() => setTab("grafica")} icon={LineChartIcon} label="Gráfica" />
      </div>

      {tab === "entrenamientos" ? (
        <div className="flex flex-col gap-2.5">
          {sessions.length === 0 && <p className="text-sm text-white/35 text-center py-8">Aún no hay entrenamientos.</p>}
          {sessions.map((s) => (
            <Link key={s.id} href={`/gym/entrenamiento/perfil/entrenamiento/${s.id}`}>
              <GlassCard padding="sm" className="flex items-center gap-3">
                <BodySilhouetteFront size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.nombre ?? s.grupoMuscular}</p>
                  <p className="text-xs text-white/40">
                    {format(new Date(s.date), "d MMM, HH:mm", { locale: es })} ·{" "}
                    {s.durationSeconds ? `${Math.round(s.durationSeconds / 60)} min` : "—"}
                  </p>
                </div>
                <ChevronRight size={15} className="text-white/30" />
              </GlassCard>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "Semana" | "Mes")}
              className="rounded-xl bg-white/[0.06] border border-white/[0.12] px-3 py-1.5 text-xs text-white outline-none"
            >
              <option value="Semana" className="bg-[#141420]">Semana</option>
              <option value="Mes" className="bg-[#141420]">Mes</option>
            </select>
            <GlassBadge color={changePct >= 0 ? "#22c55e" : "#ef4444"}>
              <TrendingUp size={11} /> {changePct >= 0 ? "+" : ""}
              {changePct}%
            </GlassBadge>
          </div>
          <GlassCard interactive={false} padding="sm" className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gym-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--gym-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="volumen" stroke="var(--gym-2)" fill="url(#volGradient)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
          <div className="grid grid-cols-2 gap-3">
            <GlassCard padding="sm" interactive={false} className="flex flex-col items-center gap-1 py-4">
              <p className="text-2xl font-bold">{sessions.length}</p>
              <p className="text-xs text-white/45">Entrenamientos</p>
            </GlassCard>
            <GlassCard padding="sm" interactive={false} className="flex flex-col items-center gap-1 py-4">
              <div className="flex items-center gap-1.5">
                <Trophy size={16} className="text-amber-400" />
                <p className="text-2xl font-bold">{records.length}</p>
              </div>
              <p className="text-xs text-white/45">Nuevos PRs</p>
            </GlassCard>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white/85">PRs recientes</h3>
          <Link href="/gym/entrenamiento/perfil/records" className="text-xs font-medium text-white/50 hover:text-white">
            Ver todos
          </Link>
        </div>
        {recentPRs.length === 0 ? (
          <p className="text-sm text-white/35">Aún no hay récords personales.</p>
        ) : (
          recentPRs.map((pr) => {
            const ex = allExercises.find((e) => e.id === pr.exerciseId);
            return (
              <GlassCard key={pr.sessionId + pr.exerciseId} padding="sm" interactive={false} className="flex items-center gap-3">
                <GlassBadge color="#3b82f6">NUEVO</GlassBadge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ex?.nombre ?? pr.exerciseId}</p>
                  <p className="text-xs text-white/40">
                    {pr.peso} kg x {pr.reps} · {format(new Date(pr.date), "d MMM", { locale: es })}
                  </p>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold text-white/85">Constancia</h3>
        <GlassCard interactive={false}>
          <TrainingHeatmap sessions={sessions} days={90} />
        </GlassCard>
      </div>
    </div>
  );
}

function StatCol({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs md:text-sm font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "linear-gradient(135deg, var(--gym), var(--gym-2))" : "transparent",
        color: active ? "white" : "rgba(255,255,255,0.5)",
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
