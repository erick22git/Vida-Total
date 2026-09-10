"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Dumbbell,
  Play,
  History,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ListPlus,
  Shield,
  User,
  CalendarRange,
  Flame,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import { MUSCLE_COLOR } from "@/lib/data/gym-meta";
import { getMuscleDistribution, estimateRoutineDurationMinutes } from "@/lib/gym-utils";
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
  const streak = useGymStore((s) => s.streak);
  const allExercises = useAllExercises();

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const todayIndex = todayDayIndex();
  const todayPlan = weeklyPlan[todayIndex];
  const isRestDay = todayPlan.grupoMuscular === "Descanso";

  const todayRoutine = todayPlan.routineId ? routines.find((r) => r.id === todayPlan.routineId) : undefined;
  const todayBgExercise = todayRoutine
    ? todayRoutine.ejercicios
        .map((rex) => allExercises.find((e) => e.id === rex.exerciseId))
        .find((e) => e?.imagen)
    : allExercises.find((e) => e.categoria === todayPlan.grupoMuscular && e.imagen);

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
      <PageBackdrop
        src="/backgrounds/entrenamiento.png"
        positionClass="object-[50%_70%] md:object-[50%_60%] lg:object-[50%_50%]"
      />

      {/* `relative`: sin position, estos hijos se pintan debajo del
      PageBackdrop (fixed) sin importar el orden en el DOM. */}
      <div className="relative flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/gym" className="text-white/50 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2 truncate">
            <Dumbbell style={{ color: "var(--gym-2)" }} /> Entrenamiento
          </h1>
        </div>
        <Link
          href="/gym/entrenamiento/rachas"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0 cursor-pointer"
          style={{ background: "var(--gym)22", border: "1px solid var(--gym)55" }}
        >
          <Flame size={16} style={{ color: "var(--gym)" }} fill="var(--gym)" fillOpacity={0.3} />
          <span className="text-sm font-bold text-white tabular-nums">{streak}</span>
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <QuickLink href="/gym/entrenamiento/planificaciones" icon={CalendarRange} label="Planes" />
        <QuickLink href="/gym/entrenamiento/rango" icon={Shield} label="Rango" />
        <QuickLink href="/gym/entrenamiento/perfil" icon={User} label="Perfil" />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {weeklyPlan.map((d, i) => (
          <GlassCard
            key={d.day}
            padding="none"
            interactive={false}
            accentColor={i === todayIndex ? "var(--gym-2)" : undefined}
            glow={i === todayIndex}
            className="shrink-0 w-[52px] flex flex-col items-center justify-center gap-0.5 py-2 px-1"
            style={{ minHeight: 44 }}
          >
            <span
              className="text-[11px] font-semibold"
              style={{ color: i === todayIndex ? "var(--gym-2)" : "rgba(255,255,255,0.5)" }}
            >
              {d.day}
            </span>
            <span className="text-[9px] text-white/60 text-center leading-tight line-clamp-1">
              {d.grupoMuscular}
            </span>
          </GlassCard>
        ))}
      </div>

      <GlassCard
        accentColor="var(--gym-2)"
        glow
        padding="none"
        className="relative flex flex-col gap-4 items-center text-center py-8 overflow-hidden"
        style={{
          background: !todayBgExercise?.imagen
            ? "linear-gradient(160deg, var(--gym)33, var(--gym-2)22)"
            : undefined,
        }}
      >
        {todayBgExercise?.imagen && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={todayBgExercise.imagen}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.85) 100%)",
              }}
            />
          </>
        )}
        <div className="relative z-10 flex flex-col gap-4 items-center px-4">
          <p className="text-sm text-white/60">Hoy toca</p>
          <h2 className="text-3xl font-bold text-white">{todayPlan.grupoMuscular}</h2>
          {activeSession && (
            <p className="text-xs text-white/50">Tienes un entrenamiento en curso</p>
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
        </div>
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
            const distribution = routine ? getMuscleDistribution(routine.ejercicios, allExercises) : [];
            const durationMins = routine ? estimateRoutineDurationMinutes(routine.ejercicios) : 0;
            const bgExercise = routine
              ? routine.ejercicios
                  .map((rex) => allExercises.find((e) => e.id === rex.exerciseId))
                  .find((e) => e?.imagen)
              : undefined;
            const href = routine
              ? `/gym/entrenamiento/rutinas/${routine.id}`
              : "/gym/entrenamiento/rutinas/nueva";

            return (
              <Link key={d.day + i} href={isRest ? "#" : href} className={isRest ? "pointer-events-none" : "shrink-0"}>
                <GlassCard
                  padding="none"
                  accentColor={i === todayIndex ? "var(--gym-2)" : undefined}
                  glow={i === todayIndex}
                  className="shrink-0 w-64 h-56 overflow-hidden relative flex flex-col justify-end p-4 cursor-pointer"
                  style={{
                    background: isRest
                      ? "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
                      : `linear-gradient(160deg, var(--gym)33, var(--gym-2)22)`,
                  }}
                >
                  {bgExercise?.imagen && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bgExercise.imagen}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.85) 100%)",
                        }}
                      />
                    </>
                  )}

                  <span className="absolute top-3 left-4 text-[11px] font-semibold text-white/70 z-10">
                    {DAY_NAMES[i]}
                  </span>

                  <div className="relative z-10 flex flex-col gap-1">
                    <p className="text-lg font-extrabold uppercase tracking-tight text-white leading-tight line-clamp-2">
                      {routine?.nombre ?? d.grupoMuscular}
                    </p>
                    {!isRest && (
                      <p className="text-[11px] text-white/60">
                        {routine ? `${durationMins} min` : "Sin rutina asignada"}
                      </p>
                    )}

                    {distribution.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1.5 -mx-0.5 px-0.5">
                        {distribution.map((m) => {
                          const color = MUSCLE_COLOR[m.categoria] ?? "var(--gym)";
                          return (
                            <span
                              key={m.categoria}
                              className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                              style={{ background: `${color}33`, border: `1px solid ${color}66`, color: "#fff" }}
                            >
                              <Dumbbell size={9} style={{ color }} /> {m.categoria} {m.pct}%
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {routine && (
                      <p className="text-[11px] text-white/50 mt-1">
                        {routine.ejercicios.length} ejercicios
                      </p>
                    )}

                    {!isRest && (
                      <div className="flex justify-center mt-2">
                        <span
                          className="rounded-full px-4 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)" }}
                        >
                          Ver
                        </span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      </div>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <button
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setTemplatesOpen((v) => !v)}
        >
          <h3 className="text-sm font-semibold text-white">Tus plantillas</h3>
          {templatesOpen ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
        </button>
        {templatesOpen && (
          <>
            <Link
              href="/gym/entrenamiento/rutinas/nueva"
              className="flex items-center gap-1 self-end text-xs font-medium text-white/50 hover:text-white -mt-1"
            >
              <ListPlus size={14} /> Nueva
            </Link>
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
          </>
        )}
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <button
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <div className="flex items-center gap-2 text-white/70">
            <History size={16} />
            <p className="text-sm font-semibold text-white">Historial reciente</p>
          </div>
          {historyOpen ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
        </button>
        {historyOpen && (
          sessions.length === 0 ? (
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
          )
        )}
      </GlassCard>
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
