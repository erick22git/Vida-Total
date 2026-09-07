"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Dumbbell, Flame, MessageCircle, Share2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { MUSCLE_COLOR } from "@/lib/data/gym-meta";

export default function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const sessions = useGymStore((s) => s.sessions);
  const streak = useGymStore((s) => s.streak);
  const allExercises = useAllExercises();
  const session = sessions.find((s) => s.id === sessionId);

  const distribution = useMemo(() => {
    if (!session) return [];
    const counts: Record<string, number> = {};
    let total = 0;
    for (const ex of session.ejercicios) {
      const data = allExercises.find((e) => e.id === ex.exerciseId);
      if (!data) continue;
      const completed = ex.sets.filter((s) => s.completado).length;
      counts[data.categoria] = (counts[data.categoria] ?? 0) + completed;
      total += completed;
    }
    return Object.entries(counts)
      .map(([categoria, count]) => ({ categoria, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [session, allExercises]);

  if (!session) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-16">
        <p className="text-white/60">Entrenamiento no encontrado.</p>
        <Link href="/gym/entrenamiento/perfil" className="text-sm underline text-white/60">
          Volver al perfil
        </Link>
      </div>
    );
  }

  const volume = session.ejercicios.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completado).reduce((a, s) => a + s.peso * s.reps, 0),
    0,
  );
  const seriesCount = session.ejercicios.reduce((sum, e) => sum + e.sets.filter((s) => s.completado).length, 0);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="text-sm font-semibold text-white">@atleta</p>
          <p className="text-xs text-white/40">{format(new Date(session.date), "EEEE d MMM, HH:mm", { locale: es })}</p>
        </div>
      </header>

      <h2 className="text-xl font-bold text-white">{session.nombre ?? session.grupoMuscular}</h2>

      <GlassCard accentColor="var(--gym)" className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Tiempo" value={session.durationSeconds ? `${Math.round(session.durationSeconds / 60)} min` : "—"} />
        <Stat label="Volumen" value={`${volume.toLocaleString()} kg`} />
        <Stat label="Series" value={`${seriesCount}`} />
        <Stat label="Racha" value={`${streak} d`} icon={<Flame size={13} className="text-orange-400" />} />
      </GlassCard>

      <div className="flex items-center gap-6 justify-center text-white/50">
        <button className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-white">
          <Flame size={16} /> Kudos
        </button>
        <button className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-white">
          <MessageCircle size={16} /> Comentar
        </button>
        <button className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-white">
          <Share2 size={16} /> Compartir
        </button>
      </div>

      {distribution.length > 0 && (
        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-white/80">Distribución Muscular</p>
          <div className="flex flex-col gap-2">
            {distribution.map((d) => {
              const color = MUSCLE_COLOR[d.categoria] ?? "var(--gym)";
              return (
                <div key={d.categoria} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-white/60 shrink-0">{d.categoria}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: color }} />
                  </div>
                  <span className="w-9 text-right text-xs text-white/45">{d.pct}%</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <div className="flex flex-col gap-2.5">
        {session.ejercicios.map((ex) => {
          const data = allExercises.find((e) => e.id === ex.exerciseId);
          return (
            <GlassCard key={ex.exerciseId} padding="sm" interactive={false} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Dumbbell size={16} className="text-white/30" />
                </div>
                <p className="text-sm font-medium text-white">{data?.nombre ?? ex.exerciseId}</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pl-1">
                {ex.sets.filter((s) => s.completado).map((s, i) => (
                  <span key={s.id} className="text-xs text-white/55">
                    Set {i + 1}: {s.peso}kg x {s.reps}
                  </span>
                ))}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 text-sm font-bold text-white">
        {icon}
        {value}
      </div>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}
