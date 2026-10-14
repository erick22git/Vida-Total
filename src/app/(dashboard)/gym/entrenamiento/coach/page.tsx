"use client";

/**
 * Coach — vista 4 de la cadena Hoy/Año/Rango/Coach (Fase 4). Es la última de la cadena de swipe
 * vertical: deslizar hacia abajo vuelve a Rango, no hay nada después. Adentro, 4 tarjetas con swipe
 * HORIZONTAL (mismo hook que Hábitos/Calorías, `swipe-carousel.tsx`): Coach por voz, Rutina/sugerencia,
 * Gráficas, Progreso general. Todo lee del motor puro `hypertrophy-engine.ts` — esta pantalla solo
 * muestra, nunca decide.
 *
 * Mesociclo: no hay una fecha de "inicio de mesociclo" guardada en ningún lado todavía, así que esta
 * pantalla NO inventa un "semana N de M" global — ver docs/ciencia-entrenamiento.md y el reporte de
 * la Fase 4 para esa decisión.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, X as XIcon } from "lucide-react";
import { useGymStore, type Experiencia } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { Mascot } from "@/components/agente/mascot";
import { todayDayIndex } from "@/lib/data/weekly-plan";
import { trainingStreakInfo } from "@/lib/gym/training-streak";
import {
  estimated1RM,
  experienceLevelFrom,
  plateauDetected,
  volumeLandmarksFor,
  volumeStatus,
  weeklyMuscleVolume,
  VOLUME_COLORS,
  type VolumeStatus,
} from "@/lib/training/hypertrophy-engine";
import { useSwipeCarousel, SwipeCarouselStage, SwipeCarouselDots } from "@/components/shared/swipe-carousel";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { MuscleGroup, WorkoutSession } from "@/lib/types";

const ENTRENAMIENTO_ACCENT = "#ff9f0a"; // mismo accent que el agente "entrenamiento" en agents.ts

/** Lunes de la semana de `d`, como "yyyy-MM-dd" (mismo criterio de día-de-semana que el resto de
 * Entrenamiento: `(getDay()+6)%7`, 0 = lunes). */
function mondayOf(d: Date): string {
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const STATUS_LABEL: Record<VolumeStatus, string> = {
  bajo: "Bajo",
  enRango: "En rango",
  cercaLimite: "Cerca del límite",
  excedido: "Excedido",
};

export default function CoachPage() {
  const router = useRouter();
  const [card, setCard] = useState(0);
  const CARD_COUNT = 4;
  const { direction, goTo, onDragEnd } = useSwipeCarousel({ index: card, length: CARD_COUNT, onIndexChange: setCard });

  const startY = useRef<number | null>(null);
  function onPointerUp(e: React.PointerEvent) {
    const dy = e.clientY - (startY.current ?? e.clientY);
    startY.current = null;
    if (dy > 70) router.push("/gym/entrenamiento/rango");
  }

  // Teclado y rueda del mouse: esta es la última pantalla de la cadena, así que solo "volver" (sin
  // gesto táctil no había forma de hacerlo desde acá — mismo motivo que en Rango).
  const wheelLock = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") router.push("/gym/entrenamiento/rango");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      onPointerDown={(e) => (startY.current = e.clientY)}
      onPointerUp={onPointerUp}
      onWheel={(e) => {
        if (wheelLock.current || Math.abs(e.deltaY) < 30) return;
        wheelLock.current = true;
        setTimeout(() => (wheelLock.current = false), 500);
        if (e.deltaY < 0) router.push("/gym/entrenamiento/rango");
      }}
    >
      <header className="shrink-0 px-5 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="flex items-center h-11">
          <Link
            href="/gym/entrenamiento/rango"
            aria-label="Volver a Rango"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center bg-black/70 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Link>
          <h1 className="flex-1 text-center text-[18px] uppercase tracking-[0.16em]" style={MONO_FONT}>
            Coach
          </h1>
          <span className="w-10 h-10" />
        </div>
        <div className="flex items-center justify-center gap-2.5 h-5">
          {/* Tappables, mismo criterio que Rango: el swipe vertical no es confiable en todos los
              dispositivos, así que cada punto también navega. */}
          {(["/gym/entrenamiento", "/gym/entrenamiento?view=1", "/gym/entrenamiento/rango", null] as const).map((href, i) => (
            <button
              key={i}
              type="button"
              aria-label={i === 3 ? "Ya estás en Coach" : `Ir a ${["Hoy", "Año", "Rango", "Coach"][i]}`}
              disabled={href === null}
              onClick={() => href && router.push(href)}
              className="p-1 -m-1 cursor-pointer disabled:cursor-default"
            >
              <span className="block w-1.5 h-1.5 rounded-full" style={{ background: i === 3 ? "#fff" : "rgba(255,255,255,0.3)" }} />
            </button>
          ))}
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <SwipeCarouselStage itemKey={card} direction={direction} length={CARD_COUNT} onDragEnd={onDragEnd} className="absolute inset-0 overflow-y-auto no-scrollbar px-5 pb-8 pt-2">
          {card === 0 && <CoachVozCard />}
          {card === 1 && <RutinaCard />}
          {card === 2 && <GraficasCard />}
          {card === 3 && <ProgresoCard />}
        </SwipeCarouselStage>
      </main>

      <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        <SwipeCarouselDots length={CARD_COUNT} index={card} onSelect={goTo} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] uppercase tracking-[0.12em] text-white/50" style={MONO_FONT}>
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 1: Coach por voz
// ---------------------------------------------------------------------------
function CoachVozCard() {
  const gymProfile = useGymStore((s) => s.gymProfile);
  const sessions = useGymStore((s) => s.sessions);
  const allExercises = useAllExercises();

  const feedback = useMemo(() => buildCoachFeedback(sessions, allExercises, gymProfile?.experiencia), [sessions, allExercises, gymProfile?.experiencia]);

  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <Mascot costume="sport" accent={ENTRENAMIENTO_ACCENT} size={140} />
      <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10 max-w-sm">
        <p className="text-sm leading-relaxed">{feedback}</p>
      </div>
      <p className="text-xs text-white/40 text-center max-w-xs">
        Para hablar con tu coach (voz o texto), usá el ícono flotante del asistente — este especialista ya está
        configurado en esta pantalla.
      </p>
    </div>
  );
}

function buildCoachFeedback(sessions: WorkoutSession[], allExercises: ReturnType<typeof useAllExercises>, experiencia: Experiencia | undefined) {
  const level = experienceLevelFrom(experiencia);
  const weekStart = mondayOf(new Date());
  const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
  const groups = Object.keys(volume) as MuscleGroup[];
  if (groups.length === 0) return "Todavía no registraste series esta semana. Cuando entrenes, te cuento cómo vas de volumen por grupo muscular.";

  const withStatus = groups
    .map((g) => {
      const landmarks = volumeLandmarksFor(g, level);
      if (!landmarks) return null;
      return { g, status: volumeStatus(volume[g] ?? 0, landmarks) };
    })
    .filter((x): x is { g: MuscleGroup; status: VolumeStatus } => x !== null);

  const excedido = withStatus.filter((x) => x.status === "excedido");
  const cercaLimite = withStatus.filter((x) => x.status === "cercaLimite");
  const bajo = withStatus.filter((x) => x.status === "bajo");

  if (excedido.length > 0) return `Esta semana ya pasaste el volumen máximo recuperable en ${excedido.map((x) => x.g).join(", ")}. Puede ser buen momento para un deload en esos grupos.`;
  if (cercaLimite.length > 0) return `${cercaLimite.map((x) => x.g).join(", ")} está cerca del límite de recuperación esta semana — seguí sumando con cuidado.`;
  if (bajo.length > 0) return `${bajo.map((x) => x.g).join(", ")} todavía está por debajo del mínimo para progresar esta semana. Sumá alguna serie más si podés.`;
  return "Tu volumen de esta semana está en rango en todos los grupos que entrenaste. Seguí así.";
}

// ---------------------------------------------------------------------------
// Tarjeta 2: Rutina / sugerencia de cambio
// ---------------------------------------------------------------------------
function RutinaCard() {
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const routines = useGymStore((s) => s.routines);
  const sessions = useGymStore((s) => s.sessions);
  const allExercises = useAllExercises();
  const [dismissed, setDismissed] = useState(false);

  const todayIndex = todayDayIndex();
  const dayPlan = weeklyPlan[todayIndex];
  const routine = dayPlan.routineId ? routines.find((r) => r.id === dayPlan.routineId) : undefined;

  const suggestion = useMemo(() => {
    if (!routine) return null;
    for (const rex of routine.ejercicios) {
      const history: number[] = [];
      for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
        const log = s.ejercicios.find((l) => l.exerciseId === rex.exerciseId);
        if (!log) continue;
        const best = log.sets.filter((set) => set.completado).reduce((max, set) => Math.max(max, estimated1RM(set.peso, set.reps)), 0);
        if (best > 0) history.push(best);
      }
      if (plateauDetected(history)) {
        const ex = allExercises.find((e) => e.id === rex.exerciseId);
        return { exerciseId: rex.exerciseId, nombre: ex?.nombre ?? rex.exerciseId };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine?.id, sessions]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Rutina de hoy</SectionTitle>
      {dayPlan.grupoMuscular === "Descanso" ? (
        <p className="text-sm text-white/50">Hoy es día de descanso.</p>
      ) : !routine ? (
        <p className="text-sm text-white/50">Sin rutina asignada para hoy.</p>
      ) : (
        <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10">
          <p className="text-sm font-semibold">{routine.nombre ?? dayPlan.grupoMuscular}</p>
          {routine.ejercicios.map((rex) => {
            const ex = allExercises.find((e) => e.id === rex.exerciseId);
            return (
              <div key={rex.exerciseId} className="flex items-center justify-between text-xs text-white/60">
                <span className="truncate">{ex?.nombre ?? rex.exerciseId}</span>
                <span className="shrink-0 tabular-nums">{rex.sets.length} series</span>
              </div>
            );
          })}
        </div>
      )}

      {suggestion && !dismissed && (
        <div className="rounded-3xl p-4 flex flex-col gap-3 bg-amber-400/10 border border-amber-300/25">
          <p className="text-sm text-amber-100">
            <b>{suggestion.nombre}</b> no sube de 1RM estimado en las últimas sesiones — parece una meseta. Considerá un deload o cambiar el
            ejercicio.
          </p>
          <div className="flex gap-2">
            <Link
              href={routine ? `/gym/entrenamiento/rutinas/${routine.id}/editar` : "#"}
              className="flex-1 rounded-full py-2.5 text-xs font-semibold text-center cursor-pointer bg-white text-black flex items-center justify-center gap-1.5"
            >
              <Check size={13} /> Revisar rutina
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white/10 text-white flex items-center justify-center gap-1.5"
            >
              <XIcon size={13} /> Por ahora no
            </button>
          </div>
        </div>
      )}
      {!suggestion && routine && <p className="text-xs text-white/35">Sin señales de meseta en esta rutina por ahora.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 3: Gráficas
// ---------------------------------------------------------------------------
function GraficasCard() {
  const sessions = useGymStore((s) => s.sessions);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const allExercises = useAllExercises();
  const level = experienceLevelFrom(gymProfile?.experiencia);

  const weekStart = mondayOf(new Date());
  const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
  const groups = (Object.keys(volume) as MuscleGroup[]).filter((g) => volumeLandmarksFor(g, level) !== null);

  const recentWeights = [...weightEntries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-10);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <section className="flex flex-col gap-3">
        <SectionTitle>Volumen semanal por grupo</SectionTitle>
        {groups.length === 0 ? (
          <p className="text-xs text-white/40">Sin series completadas esta semana todavía.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {groups.map((g) => {
              const landmarks = volumeLandmarksFor(g, level)!;
              const sets = volume[g] ?? 0;
              const status = volumeStatus(sets, landmarks);
              const pct = Math.min(100, (sets / Math.max(landmarks.mrv, 1)) * 100);
              const mevPct = Math.min(100, (landmarks.mev / Math.max(landmarks.mrv, 1)) * 100);
              const mavPct = Math.min(100, (landmarks.mav / Math.max(landmarks.mrv, 1)) * 100);
              return (
                <div key={g} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{g}</span>
                    <span className="tabular-nums text-white/50">
                      {sets} series · {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: VOLUME_COLORS[status] }} />
                    <span className="absolute inset-y-0 w-px bg-white/30" style={{ left: `${mevPct}%` }} />
                    <span className="absolute inset-y-0 w-px bg-white/30" style={{ left: `${mavPct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-white/30">Las rayas verticales marcan MEV y MAV; el final de la barra es el MRV.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Peso corporal (últimas {recentWeights.length})</SectionTitle>
        {recentWeights.length < 2 ? (
          <p className="text-xs text-white/40">Cargá al menos 2 pesadas para ver una tendencia.</p>
        ) : (
          <Sparkline values={recentWeights.map((w) => w.kg)} unit="kg" />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>RIR promedio por sesión (recientes)</SectionTitle>
        <RirTrend sessions={sessions} />
      </section>
    </div>
  );
}

function Sparkline({ values, unit }: { values: number[]; unit: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300;
  const h = 60;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <div className="rounded-2xl p-3 bg-white/[0.04]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={ENTRENAMIENTO_ACCENT} strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[10px] text-white/40 tabular-nums pt-1">
        <span>
          {Math.round(min * 10) / 10} {unit}
        </span>
        <span>
          {Math.round(max * 10) / 10} {unit}
        </span>
      </div>
    </div>
  );
}

function RirTrend({ sessions }: { sessions: WorkoutSession[] }) {
  const withRir = [...sessions]
    .filter((s) => s.completado)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const rirs = s.ejercicios.flatMap((l) => l.sets.filter((set) => set.completado && typeof set.rir === "number").map((set) => set.rir as number));
      if (rirs.length === 0) return null;
      return rirs.reduce((a, b) => a + b, 0) / rirs.length;
    })
    .filter((v): v is number => v !== null)
    .slice(-10);

  if (withRir.length === 0) return <p className="text-xs text-white/40">Todavía no registraste RIR en ninguna serie.</p>;
  return <Sparkline values={withRir} unit="RIR" />;
}

// ---------------------------------------------------------------------------
// Tarjeta 4: Progreso general
// ---------------------------------------------------------------------------
function ProgresoCard() {
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const sessions = useGymStore((s) => s.sessions);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const allExercises = useAllExercises();

  const todayISO = new Date().toISOString().slice(0, 10);
  const trainedKeys = new Set(sessions.filter((s) => s.completado).map((s) => s.date.slice(0, 10)));
  const { streak } = trainingStreakInfo(trainedKeys, weeklyPlan, todayISO);

  const weekStart = mondayOf(new Date());
  const endDate = new Date(weekStart + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endISO = endDate.toISOString().slice(0, 10);
  const completedThisWeek = sessions.filter((s) => s.completado && s.date.slice(0, 10) >= weekStart && s.date.slice(0, 10) < endISO).length;
  const plannedThisWeek = weeklyPlan.filter((d) => d.grupoMuscular !== "Descanso").length;

  const level = experienceLevelFrom(gymProfile?.experiencia);
  const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
  const bajo = (Object.keys(volume) as MuscleGroup[])
    .filter((g) => {
      const l = volumeLandmarksFor(g, level);
      return l && volumeStatus(volume[g] ?? 0, l) === "bajo";
    });
  // Grupos con landmarks que todavía no se entrenaron nada esta semana también cuentan como "bajo"
  // (0 series < MEV siempre, salvo que el MEV sea 0).
  const allGroupKeys: MuscleGroup[] = ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps", "Antebrazo", "Cuadriceps", "Femoral", "Pantorrilla", "Abdomen", "Gluteos"];
  const untrainedLow = allGroupKeys.filter((g) => {
    if (volume[g] !== undefined) return false;
    const l = volumeLandmarksFor(g, level);
    return l && l.mev > 0;
  });
  const priorities = Array.from(new Set([...bajo, ...untrainedLow]));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="rounded-3xl p-4 flex items-center justify-between bg-white/[0.05] border border-white/10">
        <div>
          <SectionTitle>Racha</SectionTitle>
          <p className="text-2xl font-black tabular-nums pt-1">{streak} días</p>
        </div>
        <ChevronRight size={16} className="text-white/30" />
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Adherencia esta semana</SectionTitle>
        <p className="text-sm text-white/70">
          {completedThisWeek} de {plannedThisWeek} sesiones planeadas
        </p>
        <div className="h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${plannedThisWeek > 0 ? Math.min(100, (completedThisWeek / plannedThisWeek) * 100) : 0}%`, background: ENTRENAMIENTO_ACCENT }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Próximos hitos</SectionTitle>
        {priorities.length === 0 ? (
          <p className="text-sm text-white/50">Ningún grupo está por debajo de su mínimo esta semana.</p>
        ) : (
          <p className="text-sm text-white/70">
            Priorizá: <b>{priorities.join(", ")}</b> — están por debajo del mínimo para progresar esta semana.
          </p>
        )}
      </section>
    </div>
  );
}
