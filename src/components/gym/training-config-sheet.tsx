"use client";

/**
 * Panel de "Configuración e Historial" de Entrenamiento (ícono de sliders arriba a la derecha de la
 * pantalla principal). Acá se mudó lo que antes estaba apilado en la pantalla de inicio: "Tu plan"
 * (el acceso rápido por día para editar), "Tus plantillas" y el "Historial reciente" — la pantalla
 * principal quedó solo con lo de HOY (ver `entrenamiento/page.tsx`).
 */
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, ChevronLeft, ChevronRight, Dumbbell, Flame, ListPlus, Plus, Shield, User } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { MUSCLE_COLOR } from "@/lib/data/gym-meta";
import { estimateRoutineDurationMinutes, getMuscleDistribution } from "@/lib/gym-utils";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const CARD_BG = { background: "var(--t-card)" } as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.12em] px-1" style={{ ...MONO_FONT, color: "var(--t-fg-faint)" }}>
      {children}
    </p>
  );
}

export function TrainingConfigSheet({ open, onClose, todayIndex }: { open: boolean; onClose: () => void; todayIndex: number }) {
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const routines = useGymStore((s) => s.routines);
  const sessions = useGymStore((s) => s.sessions);
  const plans = useGymStore((s) => s.plans);
  const activePlanId = useGymStore((s) => s.activePlanId);
  const activePlan = activePlanId ? plans.find((p) => p.id === activePlanId) : undefined;
  const allExercises = useAllExercises();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] overflow-y-auto no-scrollbar"
          style={{ background: "var(--t-bg)", color: "var(--t-fg)" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col gap-6 px-4 pb-12 max-w-md mx-auto">
            <header className="flex items-center gap-3 pt-[max(env(safe-area-inset-top),16px)]">
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                style={CARD_BG}
              >
                <ChevronLeft size={22} strokeWidth={2.6} />
              </button>
              <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
                Configuración e historial
              </h1>
            </header>

            <section className="grid grid-cols-4 gap-2">
              {[
                { href: "/gym/entrenamiento/planificaciones", label: "Planes", icon: CalendarRange },
                { href: "/gym/entrenamiento/rango", label: "Rango", icon: Shield },
                { href: "/gym/entrenamiento/perfil", label: "Perfil", icon: User },
                { href: "/gym/entrenamiento/rachas", label: "Racha", icon: Flame },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <div className="rounded-2xl py-3 flex flex-col items-center gap-1.5" style={CARD_BG}>
                    <Icon size={18} />
                    <span className="text-[11px] text-[color:var(--t-fg-dim)]">{label}</span>
                  </div>
                </Link>
              ))}
            </section>

            <Link href="/gym/entrenamiento/configurar-perfil">
              <div className="rounded-2xl px-4 py-3.5 flex items-center justify-between" style={CARD_BG}>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Perfil de entrenamiento</span>
                  <span className="text-[11px] text-[color:var(--t-fg-dim)]">
                    Sexo, peso, experiencia, objetivo y equipo — lo usa tu rango
                  </span>
                </div>
                <ChevronRight size={16} className="text-[color:var(--t-fg-dim)]" />
              </div>
            </Link>

            <section className="flex flex-col gap-3">
              <SectionTitle>Apariencia</SectionTitle>
              <ThemeToggle />
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <SectionTitle>Tu plan</SectionTitle>
                  <h3 className="text-lg font-semibold truncate mt-1">{activePlan ? activePlan.nombre : "Sin planificación"}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/gym/entrenamiento/planificaciones/manual"
                    className="rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                    style={{ background: "var(--t-line)", color: "var(--t-fg-dim)" }}
                  >
                    <Plus size={13} /> Nuevo
                  </Link>
                  <Link
                    href={activePlan ? `/gym/entrenamiento/planificaciones/${activePlan.id}` : "/gym/entrenamiento/planificaciones"}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                    style={{ background: "var(--t-accent)", color: "var(--t-on-accent)" }}
                  >
                    {activePlan ? "Ver plan" : "Más planes"} <ChevronRight size={13} />
                  </Link>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                {weeklyPlan.map((d, i) => {
                  const routine = d.routineId ? routines.find((r) => r.id === d.routineId) : undefined;
                  const isRest = d.grupoMuscular === "Descanso";
                  const distribution = routine ? getMuscleDistribution(routine.ejercicios, allExercises) : [];
                  const durationMins = routine ? estimateRoutineDurationMinutes(routine.ejercicios) : 0;
                  const bgExercise = routine
                    ? routine.ejercicios.map((rex) => allExercises.find((e) => e.id === rex.exerciseId)).find((e) => e?.imagen)
                    : undefined;
                  // Con un plan activo, el acceso rápido por día abre ESE día dentro del plan.
                  const href = activePlan
                    ? `/gym/entrenamiento/planificaciones/${activePlan.id}?day=${i}`
                    : routine
                      ? `/gym/entrenamiento/rutinas/${routine.id}`
                      : "/gym/entrenamiento/rutinas/nueva";
                  return (
                    <Link key={d.day + i} href={isRest ? "#" : href} className={isRest ? "pointer-events-none shrink-0" : "shrink-0"}>
                      <div
                        data-keep-colors
                        className="w-64 h-52 rounded-3xl overflow-hidden relative flex flex-col justify-end p-4"
                        style={{
                          ...CARD_BG,
                          color: "#fff",
                          border: i === todayIndex ? "1px solid var(--t-ring)" : "1px solid var(--t-line)",
                        }}
                      >
                        {bgExercise?.imagen && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={bgExercise.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            <div
                              className="absolute inset-0"
                              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.88) 100%)" }}
                            />
                          </>
                        )}
                        <span className="absolute top-3 left-4 text-[11px] font-semibold opacity-70 z-10" style={MONO_FONT}>
                          {DAY_NAMES[i].toUpperCase()}
                        </span>
                        <div className="relative z-10 flex flex-col gap-1">
                          <p className="text-lg font-extrabold uppercase tracking-tight leading-tight line-clamp-2">
                            {routine?.nombre ?? d.grupoMuscular}
                          </p>
                          {!isRest && (
                            <p className="text-[11px] opacity-60">
                              {routine ? `${durationMins} min · ${routine.ejercicios.length} ejercicios` : "Sin rutina asignada"}
                            </p>
                          )}
                          {distribution.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1">
                              {distribution.map((m) => {
                                const color = MUSCLE_COLOR[m.categoria] ?? "#fff";
                                return (
                                  <span
                                    key={m.categoria}
                                    className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                                    style={{ background: `${color}33`, border: `1px solid ${color}66` }}
                                  >
                                    <Dumbbell size={9} style={{ color }} /> {m.categoria} {m.pct}%
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Tus plantillas</SectionTitle>
                <Link href="/gym/entrenamiento/rutinas/nueva" className="flex items-center gap-1 text-xs font-medium text-[color:var(--t-fg-dim)]">
                  <ListPlus size={14} /> Nueva
                </Link>
              </div>
              {routines.length === 0 ? (
                <p className="text-sm text-[color:var(--t-fg-faint)] px-1">Aún no tienes rutinas guardadas.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {routines.map((r) => (
                    <Link key={r.id} href={`/gym/entrenamiento/rutinas/${r.id}`}>
                      <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={CARD_BG}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.nombre}</p>
                          <p className="text-xs text-[color:var(--t-fg-faint)]">{r.ejercicios.length} ejercicios</p>
                        </div>
                        <ChevronRight size={16} className="text-[color:var(--t-fg-faint)] shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle>Historial reciente</SectionTitle>
              {sessions.length === 0 ? (
                <p className="text-sm text-[color:var(--t-fg-faint)] px-1">Aún no hay entrenamientos registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {sessions.slice(0, 8).map((s) => (
                    <div key={s.id} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={CARD_BG}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.nombre ?? s.grupoMuscular}</p>
                        <p className="text-xs text-[color:var(--t-fg-faint)]">{format(new Date(s.date), "EEEE d MMM, HH:mm", { locale: es })}</p>
                      </div>
                      <span className="text-xs text-[color:var(--t-fg-faint)] shrink-0">{s.ejercicios.length} ejercicios</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
