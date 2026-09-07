"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, Play, History, ChevronRight, ListPlus, Shield, User, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import type { MuscleGroup } from "@/lib/types";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function EntrenamientoPage() {
  const router = useRouter();
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const sessions = useGymStore((s) => s.sessions);
  const routines = useGymStore((s) => s.routines);
  const activeSession = useGymStore((s) => s.activeSession);
  const startWorkout = useGymStore((s) => s.startWorkout);
  const startWorkoutFromRoutine = useGymStore((s) => s.startWorkoutFromRoutine);
  const allExercises = useAllExercises();

  const todayIndex = todayDayIndex();
  const todayPlan = weeklyPlan[todayIndex];
  const isRestDay = todayPlan.grupoMuscular === "Descanso";

  function handleStart() {
    if (isRestDay) return;
    if (!activeSession) {
      const routine = todayPlan.routineId ? routines.find((r) => r.id === todayPlan.routineId) : undefined;
      if (routine) {
        startWorkoutFromRoutine(routine);
      } else {
        const grupo = todayPlan.grupoMuscular as MuscleGroup;
        const pool = allExercises.filter((e) => e.categoria === grupo).slice(0, 5);
        const ids = pool.length > 0 ? pool.map((e) => e.id) : [allExercises[0].id];
        startWorkout(grupo, ids);
      }
    }
    router.push("/gym/entrenamiento/activo");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Dumbbell style={{ color: "var(--gym-2)" }} /> Entrenamiento
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <QuickLink href="/gym/entrenamiento/planificaciones" icon={CalendarRange} label="Planes" />
        <QuickLink href="/gym/entrenamiento/rango" icon={Shield} label="Rango" />
        <QuickLink href="/gym/entrenamiento/perfil" icon={User} label="Perfil" />
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {weeklyPlan.map((d, i) => (
          <GlassCard
            key={d.day}
            padding="sm"
            interactive={false}
            accentColor={i === todayIndex ? "var(--gym-2)" : undefined}
            glow={i === todayIndex}
            className="shrink-0 w-20 flex flex-col items-center gap-1.5 py-4"
          >
            <span
              className="text-xs font-semibold"
              style={{ color: i === todayIndex ? "var(--gym-2)" : "rgba(255,255,255,0.5)" }}
            >
              {d.day}
            </span>
            <span className="text-[11px] text-white/60 text-center leading-tight">
              {d.grupoMuscular}
            </span>
          </GlassCard>
        ))}
      </div>

      <GlassCard accentColor="var(--gym-2)" glow className="flex flex-col gap-4 items-center text-center py-8">
        <p className="text-sm text-white/50">Hoy toca</p>
        <h2 className="text-3xl font-bold">{todayPlan.grupoMuscular}</h2>
        {activeSession && (
          <p className="text-xs text-white/40">Tienes un entrenamiento en curso</p>
        )}
        <GlassButton
          accentColor="var(--gym-2)"
          size="lg"
          onClick={handleStart}
          disabled={isRestDay}
        >
          <Play size={18} />
          {activeSession ? "Continuar entrenamiento" : "Iniciar entrenamiento"}
        </GlassButton>
      </GlassCard>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tu Plan</h3>
          <Link href="/gym/entrenamiento/planificaciones" className="text-xs font-medium text-white/50 hover:text-white flex items-center gap-1">
            Más planes <ChevronRight size={13} />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {weeklyPlan.map((d, i) => {
            const routine = d.routineId ? routines.find((r) => r.id === d.routineId) : undefined;
            const isRest = d.grupoMuscular === "Descanso";
            return (
              <GlassCard
                key={d.day + i}
                padding="none"
                accentColor={i === todayIndex ? "var(--gym-2)" : undefined}
                glow={i === todayIndex}
                className="shrink-0 w-52 h-40 overflow-hidden relative flex flex-col justify-end p-4"
                style={{
                  background: isRest
                    ? "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
                    : `linear-gradient(160deg, var(--gym)33, var(--gym-2)22)`,
                }}
              >
                <span className="absolute top-3 left-4 text-[11px] font-semibold text-white/60">
                  {DAY_NAMES[i]}
                </span>
                <p className="text-lg font-extrabold uppercase tracking-tight text-white leading-tight">
                  {routine?.nombre ?? d.grupoMuscular}
                </p>
                {!isRest && (
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {routine ? `${routine.ejercicios.length} ejercicios` : "Sin rutina asignada"}
                  </p>
                )}
                {routine && (
                  <p className="text-[11px] text-white/40 mt-1">
                    {routine.timesCompleted} entrenamientos completados
                  </p>
                )}
                {!isRest && (
                  <Link
                    href={routine ? `/gym/entrenamiento/rutinas/${routine.id}` : "/gym/entrenamiento/rutinas/nueva"}
                    className="absolute bottom-3 right-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}
                  >
                    Ver
                  </Link>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tus plantillas</h3>
          <Link
            href="/gym/entrenamiento/rutinas/nueva"
            className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white"
          >
            <ListPlus size={14} /> Nueva
          </Link>
        </div>
        {routines.length === 0 ? (
          <p className="text-sm text-white/30">Aún no tienes rutinas guardadas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {routines.map((r) => (
              <Link key={r.id} href={`/gym/entrenamiento/rutinas/${r.id}`}>
                <GlassCard padding="sm" className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{r.nombre}</p>
                    <p className="text-xs text-white/40">{r.ejercicios.length} ejercicios</p>
                  </div>
                  <ChevronRight size={16} className="text-white/30" />
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-white/70">
          <History size={16} />
          <p className="text-sm font-semibold">Historial reciente</p>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-white/30">Aún no hay entrenamientos registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 8).map((s) => (
              <GlassCard key={s.id} padding="sm" interactive={false} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{s.nombre ?? s.grupoMuscular}</p>
                  <p className="text-xs text-white/40">
                    {format(new Date(s.date), "EEEE d MMM, HH:mm", { locale: es })}
                  </p>
                </div>
                <span className="text-xs text-white/40">
                  {s.ejercicios.length} ejercicios
                </span>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href}>
      <GlassCard padding="sm" className="flex flex-col items-center gap-1.5 py-3.5">
        <Icon size={18} style={{ color: "var(--gym-2)" }} />
        <span className="text-xs font-medium text-white/70">{label}</span>
      </GlassCard>
    </Link>
  );
}
