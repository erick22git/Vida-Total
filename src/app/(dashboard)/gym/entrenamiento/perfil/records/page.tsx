"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { format, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { getAllPersonalRecords } from "@/lib/gym-utils";

export default function PersonalRecordsPage() {
  const sessions = useGymStore((s) => s.sessions);
  const allExercises = useAllExercises();
  const records = useMemo(() => getAllPersonalRecords(sessions), [sessions]);
  const exerciseCount = new Set(records.map((r) => r.exerciseId)).size;
  const thisMonth = records.filter((r) => isSameMonth(new Date(r.date), new Date()));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Récords personales</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard accentColor="var(--gym)" className="flex flex-col items-center gap-1 py-6">
          <p className="text-3xl font-extrabold">+{exerciseCount}</p>
          <p className="text-xs text-white/45">Ejercicios</p>
        </GlassCard>
        <GlassCard accentColor="#f59e0b" className="flex flex-col items-center gap-1 py-6">
          <div className="flex items-center gap-1.5">
            <Trophy size={18} className="text-amber-400" />
            <p className="text-3xl font-extrabold">+{records.length}</p>
          </div>
          <p className="text-xs text-white/45">Total de PRs</p>
        </GlassCard>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold text-white/85">Este mes</h3>
        {thisMonth.length === 0 ? (
          <p className="text-sm text-white/35">No hay récords este mes todavía.</p>
        ) : (
          thisMonth.map((pr) => {
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
        <h3 className="text-base font-semibold text-white/85">Historial completo</h3>
        {records.length === 0 ? (
          <p className="text-sm text-white/35">Aún no hay récords registrados.</p>
        ) : (
          records.map((pr) => {
            const ex = allExercises.find((e) => e.id === pr.exerciseId);
            return (
              <GlassCard key={"all-" + pr.sessionId + pr.exerciseId} padding="sm" interactive={false} className="flex items-center justify-between">
                <p className="text-sm text-white/75">{ex?.nombre ?? pr.exerciseId}</p>
                <p className="text-xs text-white/40">
                  {pr.peso}kg x {pr.reps} · {format(new Date(pr.date), "d MMM yyyy", { locale: es })}
                </p>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
