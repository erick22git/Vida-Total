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
import {
  estimated1RM,
  experienceLevelFrom,
  plateauDetected,
  volumeLandmarksFor,
  volumeStatus,
  weeklyMuscleVolume,
  weeklyMuscleVolumeBreakdown,
  weeklyFailureLoad,
  recentTechniqueWarnings,
  DROPSET_VOLUME_MULTIPLIER,
  VOLUME_COLORS,
  volumeCeilingForPhase,
  type VolumeStatus,
} from "@/lib/training/hypertrophy-engine";
import { suggestNextWeight, type ProgressionSuggestion } from "@/lib/training/progressive-overload";
import { adviseImprovements, type Priority } from "@/lib/training/improvement-advice";
import { diagnoseAcrossModules, type Area } from "@/lib/gym/cross-diagnosis";
import { evaluatePlanAdherence } from "@/lib/nutrition/plan-adherence";
import { useTargetProfile } from "@/lib/nutrition/use-targets";
import { activeLoggedFoods } from "@/lib/food-utils";
import { localDayKey } from "@/lib/gym/kegel-dates";
import { phaseFromObjetivo, type CaloriePhase } from "@/lib/gym/calorie-periodization";
import { useSwipeCarousel, SwipeCarouselStage } from "@/components/shared/swipe-carousel";
import { ChainDots } from "@/components/gym/chain-dots";
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

const CARD_LABELS = ["Coach por voz", "Rutina de hoy", "Gráficas", "Progreso general", "Diagnóstico"] as const;

/** Sesiones para el Coach: fecha en día LOCAL (antes se comparaba la fecha UTC, que corre el día de lo que
 * entrenas de noche) y, si hay un entrenamiento en curso con series ya tildadas, también cuenta: antes el Coach
 * decía "no registraste series esta semana" mientras tenías el entrenamiento abierto sin terminar. */
function useCoachSessions(): WorkoutSession[] {
  const sessions = useGymStore((s) => s.sessions);
  const active = useGymStore((s) => s.activeSession);
  return useMemo(() => {
    const local = (s: WorkoutSession): WorkoutSession => ({ ...s, date: `${localDayKey(new Date(s.date))}T12:00:00` });
    const list = sessions.map(local);
    if (active && active.ejercicios.some((e) => e.sets.some((x) => x.completado))) list.push(local(active));
    return list;
  }, [sessions, active]);
}

export default function CoachPage() {
  const router = useRouter();
  const [card, setCard] = useState(0);
  const CARD_COUNT = 5;
  const { direction, goTo, onDragEnd } = useSwipeCarousel({ index: card, length: CARD_COUNT, onIndexChange: setCard });

  const startY = useRef<number | null>(null);
  function onPointerUp(e: React.PointerEvent) {
    const dy = e.clientY - (startY.current ?? e.clientY);
    startY.current = null;
    if (dy > 70) router.push("/gym/entrenamiento/rango");
  }

  // Teclado y rueda del mouse: izquierda/derecha cambian de tarjeta (horizontal, dentro de esta
  // pantalla); arriba vuelve a Rango (esta es la última de la cadena vertical, sin gesto táctil no
  // había forma de hacerlo desde acá — mismo motivo que en Rango).
  const wheelLock = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") router.push("/gym/entrenamiento/rango");
      else if (e.key === "ArrowRight") goTo(card + 1);
      else if (e.key === "ArrowLeft") goTo(card - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, goTo, card]);

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden touch-none"
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
        <p className="text-center text-xs tabular-nums text-white/40 pt-1" style={MONO_FONT}>
          {card + 1}/{CARD_COUNT}
        </p>
      </header>

      <main className="relative flex-1 min-h-0">
        <ChainDots current={3} />
        <SwipeCarouselStage itemKey={card} direction={direction} length={CARD_COUNT} onDragEnd={onDragEnd} className="absolute inset-0 overflow-y-auto no-scrollbar px-5 pb-8 pt-2">
          {card === 0 && <CoachVozCard />}
          {card === 1 && <RutinaCard />}
          {card === 2 && <GraficasCard />}
          {card === 3 && <ProgresoCard />}
          {card === 4 && <DiagnosticoCard />}
        </SwipeCarouselStage>
      </main>

      <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Tarjeta anterior"
          disabled={card === 0}
          onClick={() => goTo(card - 1)}
          className="w-8 h-8 flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-default"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-white/80 min-w-[150px] text-center" style={MONO_FONT}>
          {CARD_LABELS[card]}
        </p>
        <button
          type="button"
          aria-label="Tarjeta siguiente"
          disabled={card === CARD_COUNT - 1}
          onClick={() => goTo(card + 1)}
          className="w-8 h-8 flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-default"
        >
          <ChevronRight size={18} />
        </button>
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
const PHASE_LABEL: Record<CaloriePhase, string> = { deficit: "Déficit calórico", mantenimiento: "Mantenimiento", volumen: "Superávit calórico" };

function CoachVozCard() {
  const gymProfile = useGymStore((s) => s.gymProfile);
  const sessions = useCoachSessions();
  const allExercises = useAllExercises();
  const phase = phaseFromObjetivo(gymProfile?.objetivoCalorico);

  const feedback = useMemo(
    () => buildCoachFeedback(sessions, allExercises, gymProfile?.experiencia, phase),
    [sessions, allExercises, gymProfile?.experiencia, phase],
  );

  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <Mascot costume="sport" accent={ENTRENAMIENTO_ACCENT} size={140} />
      <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10 max-w-sm">
        {gymProfile?.objetivoCalorico && (
          <span className="text-[10px] uppercase tracking-wide text-white/40 self-start">Fase: {PHASE_LABEL[phase]}</span>
        )}
        <p className="text-sm leading-relaxed">{feedback}</p>
      </div>
      <p className="text-xs text-white/40 text-center max-w-xs">
        Para hablar con tu coach (voz o texto), usá el ícono flotante del asistente — este especialista ya está
        configurado en esta pantalla.
      </p>
    </div>
  );
}

/** El volumen "en rango" (semáforo de `volumeStatus`) no cambia con la fase calórica — los landmarks
 * MEV/MAV/MRV son los mismos. Lo que SÍ cambia es el TECHO que el Coach recomienda perseguir dentro de
 * ese rango (`volumeCeilingForPhase`, ver hypertrophy-engine.ts): en déficit, aunque técnicamente estés
 * "en rango", si ya pasaste el techo de la fase se avisa aparte en vez de invitar a seguir sumando. */
function buildCoachFeedback(
  sessions: WorkoutSession[],
  allExercises: ReturnType<typeof useAllExercises>,
  experiencia: Experiencia | undefined,
  phase: CaloriePhase,
) {
  const level = experienceLevelFrom(experiencia);
  const weekStart = mondayOf(new Date());
  const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
  const groups = Object.keys(volume) as MuscleGroup[];
  if (groups.length === 0) return "Todavía no registraste series esta semana. Cuando entrenes, te cuento cómo vas de volumen por grupo muscular.";

  const withStatus = groups
    .map((g) => {
      const landmarks = volumeLandmarksFor(g, level);
      if (!landmarks) return null;
      const sets = volume[g] ?? 0;
      const ceiling = volumeCeilingForPhase(landmarks, phase);
      return { g, status: volumeStatus(sets, landmarks), sobreTechoFase: phase !== "volumen" && sets >= ceiling && sets < landmarks.mrv };
    })
    .filter((x): x is { g: MuscleGroup; status: VolumeStatus; sobreTechoFase: boolean } => x !== null);

  const excedido = withStatus.filter((x) => x.status === "excedido");
  const sobreTechoFase = withStatus.filter((x) => x.sobreTechoFase && x.status !== "excedido");
  const cercaLimite = withStatus.filter((x) => x.status === "cercaLimite" && !x.sobreTechoFase);
  const bajo = withStatus.filter((x) => x.status === "bajo");

  if (excedido.length > 0) return `Esta semana ya pasaste el volumen máximo recuperable en ${excedido.map((x) => x.g).join(", ")}. Puede ser buen momento para un deload en esos grupos.`;
  if (sobreTechoFase.length > 0 && phase === "deficit") {
    return `${sobreTechoFase.map((x) => x.g).join(", ")} está técnicamente en rango, pero con el déficit activo tu cuerpo recupera peor — no hace falta sumar más series ahí por ahora. Si querés subir más volumen, conviene esperar a mantenimiento o superávit.`;
  }
  if (cercaLimite.length > 0) return `${cercaLimite.map((x) => x.g).join(", ")} está cerca del límite de recuperación esta semana — seguí sumando con cuidado.`;
  if (bajo.length > 0) return `${bajo.map((x) => x.g).join(", ")} todavía está por debajo del mínimo para progresar esta semana. Sumá alguna serie más si podés.`;
  if (phase === "volumen") return "Tu volumen de esta semana está en rango en todos los grupos que entrenaste. Con el superávit activo, tenés margen para sumar más series si buscás progresar más rápido.";
  if (phase === "deficit") return "Tu volumen de esta semana está en rango en todos los grupos que entrenaste. Con el déficit activo, no hace falta buscar más volumen que el que ya tenés — mantenerlo ya es suficiente estímulo.";
  return "Tu volumen de esta semana está en rango en todos los grupos que entrenaste. Seguí así.";
}

// ---------------------------------------------------------------------------
// Tarjeta 2: Rutina / sugerencia de cambio
// ---------------------------------------------------------------------------
/** Series de trabajo (sin calentamiento) de las 2 sesiones completadas más recientes que incluyeron
 * este ejercicio — [más reciente, anterior a esa] (la segunda solo para sacar `referenceReps`). */
function lastTwoWorkingLogsFor(sessions: WorkoutSession[], exerciseId: string) {
  const sorted = [...sessions].filter((s) => s.completado).sort((a, b) => (a.date < b.date ? 1 : -1));
  const logs: WorkoutSession["ejercicios"][number]["sets"][] = [];
  for (const s of sorted) {
    const log = s.ejercicios.find((l) => l.exerciseId === exerciseId);
    if (log) {
      logs.push(log.sets.filter((set) => set.completado && set.tipo !== "calentamiento"));
      if (logs.length === 2) break;
    }
  }
  return logs;
}

function weightProgressionFor(sessions: WorkoutSession[], exerciseId: string): ProgressionSuggestion | null {
  const [lastSets, previousSets] = lastTwoWorkingLogsFor(sessions, exerciseId);
  if (!lastSets || lastSets.length === 0) return null;
  const referenceReps = (previousSets ?? lastSets).map((s) => s.reps);
  return suggestNextWeight({ lastSets, referenceReps });
}

function RutinaCard() {
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const routines = useGymStore((s) => s.routines);
  const sessions = useCoachSessions();
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
            const progression = weightProgressionFor(sessions, rex.exerciseId);
            return (
              <div key={rex.exerciseId} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="truncate">{ex?.nombre ?? rex.exerciseId}</span>
                  <span className="shrink-0 tabular-nums">{rex.sets.length} series</span>
                </div>
                {progression && !progression.sinDatos && (
                  <p className="text-[11px]" style={{ color: progression.decision === "subir" ? "#4ade80" : progression.decision === "bajar" ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                    {progression.decision === "subir"
                      ? `Probá ${progression.suggestedWeightKg} kg hoy`
                      : progression.decision === "bajar"
                        ? `Probá bajar a ${progression.suggestedWeightKg} kg hoy`
                        : `Mismo peso hoy (${progression.lastWeight} kg) — sumá reps antes de subir`}
                  </p>
                )}
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
  const sessions = useCoachSessions();
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const allExercises = useAllExercises();
  const level = experienceLevelFrom(gymProfile?.experiencia);

  const weekStart = mondayOf(new Date());
  const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
  const breakdown = weeklyMuscleVolumeBreakdown(sessions, allExercises, weekStart);
  const groups = (Object.keys(volume) as MuscleGroup[]).filter((g) => volumeLandmarksFor(g, level) !== null);
  const failureLoad = weeklyFailureLoad(sessions, weekStart);
  const techniqueWarnings = recentTechniqueWarnings(sessions);

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
              const dropset = breakdown[g]?.dropset ?? 0;
              return (
                <div key={g} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{g}</span>
                    <span className="tabular-nums text-white/50">
                      {sets} series · {STATUS_LABEL[status]}
                    </span>
                  </div>
                  {dropset > 0 && (
                    <p className="text-[10px] text-white/35">
                      {breakdown[g]?.normal ?? 0} normales + {dropset} descendente{dropset === 1 ? "" : "s"} (×{DROPSET_VOLUME_MULTIPLIER} c/u en el total)
                    </p>
                  )}
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

      <section className="flex flex-col gap-3">
        <SectionTitle>Series al fallo esta semana</SectionTitle>
        {failureLoad.totalSets === 0 ? (
          <p className="text-xs text-white/40">Sin series completadas esta semana todavía.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-white/60">
              {failureLoad.failureSets} de {failureLoad.totalSets} series ({Math.round(failureLoad.ratio * 100)}%)
            </p>
            {failureLoad.highFatigue && (
              <p className="text-xs rounded-xl px-3 py-2" style={{ background: "#ef44441a", color: "#fca5a5" }}>
                Muchas series al fallo esta semana — señal de fatiga acumulada alta, considerá adelantar un deload.
              </p>
            )}
          </div>
        )}
      </section>

      {techniqueWarnings.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Técnica irregular</SectionTitle>
          {techniqueWarnings.map((w) => {
            const ex = allExercises.find((e) => e.id === w.exerciseId);
            return (
              <p key={w.exerciseId} className="text-xs rounded-xl px-3 py-2 bg-amber-400/10 text-amber-200">
                <b>{ex?.nombre ?? w.exerciseId}</b> viene con técnica irregular las últimas sesiones ({w.notedSets} notas, ej. &ldquo;{w.lastNote}&rdquo;).
              </p>
            );
          })}
        </section>
      )}
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
// Tarjeta 4: Progreso general — qué mejorar, con números concretos
// ---------------------------------------------------------------------------
const PRIORITY_STYLE: Record<Priority, { label: string; bg: string; fg: string }> = {
  alta: { label: "Prioridad alta", bg: "rgba(255,255,255,0.14)", fg: "#ffffff" },
  media: { label: "Prioridad media", bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.8)" },
  baja: { label: "Prioridad baja", bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.55)" },
};

function weekCounts(sessions: WorkoutSession[], weeklyPlan: ReturnType<typeof useGymStore.getState>["weeklyPlan"]) {
  const weekStart = mondayOf(new Date());
  const endDate = new Date(weekStart + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endISO = endDate.toISOString().slice(0, 10);
  const completed = sessions.filter((s) => s.completado && s.date.slice(0, 10) >= weekStart && s.date.slice(0, 10) < endISO).length;
  const planned = weeklyPlan.filter((d) => d.grupoMuscular !== "Descanso").length;
  const daysLeft = 7 - todayDayIndex();
  return { weekStart, completed, planned, daysLeft };
}

function ProgresoCard() {
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const sessions = useCoachSessions();
  const inProgress = useGymStore((s) => !!s.activeSession && s.activeSession.ejercicios.some((e) => e.sets.some((x) => x.completado)));
  const allExercises = useAllExercises();
  const level = experienceLevelFrom(gymProfile?.experiencia);
  const { weekStart, completed, planned, daysLeft } = weekCounts(sessions, weeklyPlan);

  const items = useMemo(
    () => adviseImprovements({ sessions, exercises: allExercises, level, weekStart, planned, completed, daysLeft }),
    [sessions, allExercises, level, weekStart, planned, completed, daysLeft],
  );

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="flex flex-col gap-2">
        <SectionTitle>Adherencia esta semana</SectionTitle>
        <p className="text-sm text-white/70">
          {completed} de {planned} sesiones planeadas
          {inProgress ? " · tienes un entrenamiento en curso con series ya anotadas" : ""}
        </p>
        <div className="h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full bg-white" style={{ width: `${planned > 0 ? Math.min(100, (completed / planned) * 100) : 0}%` }} />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionTitle>En qué mejorar</SectionTitle>
        {items.length === 0 ? (
          <p className="text-sm text-white/55">
            {sessions.some((s) => s.date.slice(0, 10) >= weekStart)
              ? "Esta semana no hay nada que corregir: volumen, frecuencia y fatiga están en orden."
              : "Todavía no hay series esta semana. Cuando entrenes te digo qué grupos subir o bajar y con qué ejercicios."}
          </p>
        ) : (
          items.map((it) => {
            const st = PRIORITY_STYLE[it.priority];
            return (
              <div key={it.id} className="rounded-2xl p-3.5 flex flex-col gap-1 bg-white/[0.05] border border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-white/40">{it.area}</span>
                  <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: st.bg, color: st.fg }}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">{it.title}</p>
                <p className="text-xs text-white/60 leading-relaxed">{it.detail}</p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 5: Diagnóstico — cruza calorías, agua, entrenamiento y peso
// ---------------------------------------------------------------------------
const AREA_LABEL: Record<Area, string> = {
  registro: "Registro",
  calorias: "Calorías",
  proteina: "Proteína",
  peso: "Peso",
  entrenamiento: "Entrenamiento",
  agua: "Agua",
};

function DiagnosticoCard() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const calorieGoalHistory = useGymStore((s) => s.calorieGoalHistory);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const measurements = useGymStore((s) => s.bodyMeasurementHistory);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const waterEntries = useGymStore((s) => s.waterEntries);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const weeklyPlan = useGymStore((s) => s.weeklyPlan);
  const sessions = useCoachSessions();
  const allExercises = useAllExercises();
  const perfil = useTargetProfile();
  const [applied, setApplied] = useState<string | null>(null);

  const result = useMemo(() => {
    const today = new Date();
    const dayKeys = Array.from({ length: 7 }, (_, k) => localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - k)));
    const foods = activeLoggedFoods(loggedFoods);
    const protByDay = new Map<string, number>();
    for (const f of foods) {
      const k = localDayKey(new Date(f.timestamp));
      if (dayKeys.includes(k)) protByDay.set(k, (protByDay.get(k) ?? 0) + (f.proteina || 0));
    }
    const loggedDaysLast7 = protByDay.size;
    const proteinAvgG = loggedDaysLast7 ? [...protByDay.values()].reduce((a, b) => a + b, 0) / loggedDaysLast7 : null;

    // Agua: los 7 días ANTERIORES a hoy (hoy todavía está en curso).
    const prev7 = dayKeys.slice(1);
    const waterByDay = new Map<string, number>();
    for (const e of waterEntries) {
      const k = localDayKey(new Date(e.timestamp));
      waterByDay.set(k, (waterByDay.get(k) ?? 0) + e.ml);
    }
    const last7Ml = prev7.map((k) => waterByDay.get(k) ?? 0);
    const trainedKeys = new Set(sessions.filter((s) => s.completado).map((s) => s.date.slice(0, 10)));
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const trainingDaysAvgMl = trainedKeys.size ? avg(prev7.filter((k) => trainedKeys.has(k)).map((k) => waterByDay.get(k) ?? 0)) : null;
    const restDaysAvgMl = avg(prev7.filter((k) => !trainedKeys.has(k)).map((k) => waterByDay.get(k) ?? 0));

    const plan = evaluatePlanAdherence({
      loggedFoods,
      calorieGoal,
      goalHistory: calorieGoalHistory ?? [],
      weightEntries,
      measurements,
      objetivo: gymProfile?.objetivoCalorico,
    });

    const level = experienceLevelFrom(gymProfile?.experiencia);
    const { weekStart, completed, planned, daysLeft } = weekCounts(sessions, weeklyPlan);
    const volume = weeklyMuscleVolume(sessions, allExercises, weekStart);
    const groups: MuscleGroup[] = ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps", "Cuadriceps", "Femoral", "Gluteos"];
    const lowGroups = groups.filter((g) => {
      const lm = volumeLandmarksFor(g, level);
      return lm && volumeStatus(volume[g] ?? 0, lm) === "bajo";
    });
    const anySetsThisWeek = Object.keys(volume).length > 0;

    return diagnoseAcrossModules({
      objetivo: gymProfile?.objetivoCalorico,
      entrena: !!perfil.entrena,
      pesoKg: perfil.pesoKg,
      calorieGoal,
      proteinGoal,
      plan,
      loggedDaysLast7,
      proteinAvgG,
      water: { goalMl: waterGoalMl, last7Ml, trainingDaysAvgMl, restDaysAvgMl },
      training: { planned, completed, daysLeft, lowGroups, anySetsThisWeek },
    });
  }, [loggedFoods, calorieGoal, proteinGoal, calorieGoalHistory, weightEntries, measurements, gymProfile, waterEntries, waterGoalMl, weeklyPlan, sessions, allExercises, perfil]);

  const SEV = {
    alta: { dot: "#ffffff", label: "Falla" },
    media: { dot: "rgba(255,255,255,0.6)", label: "Mejorar" },
    ok: { dot: "rgba(255,255,255,0.25)", label: "Bien" },
  } as const;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Dónde estás fallando</SectionTitle>
      <div className="rounded-3xl p-4 bg-white/[0.07] border border-white/15">
        <p className="text-sm font-semibold leading-relaxed">{result.headline}</p>
      </div>

      {result.findings.map((f) => (
        <div key={f.id} className="rounded-2xl p-3.5 flex flex-col gap-1.5 bg-white/[0.05] border border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-white/40">{AREA_LABEL[f.area]}</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/55">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEV[f.severity].dot }} />
              {SEV[f.severity].label}
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug">{f.title}</p>
          <p className="text-xs text-white/60 leading-relaxed">{f.detail}</p>
          {f.action &&
            (f.action.kind === "link" ? (
              <Link href={f.action.href!} className="self-start mt-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-white text-black">
                {f.action.label}
              </Link>
            ) : applied === f.id ? (
              <span className="self-start mt-1 text-xs text-white/60">Meta de agua actualizada a {f.action.ml} ml.</span>
            ) : (
              <button
                onClick={() => {
                  useGymStore.setState({ waterGoalMl: f.action!.ml });
                  setApplied(f.id);
                }}
                className="self-start mt-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-white text-black cursor-pointer"
              >
                {f.action.label}
              </button>
            ))}
        </div>
      ))}
      <p className="text-[10px] text-white/35 leading-relaxed">
        Cruza lo que anotas en Calorías, Agua, Entrenamiento y Peso. Es una guía basada en tus propios datos, no un diagnóstico médico: cuantos más
        días anotes, más confiable es.
      </p>
    </div>
  );
}
