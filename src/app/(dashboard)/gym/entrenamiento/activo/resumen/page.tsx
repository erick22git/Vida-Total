"use client";

/**
 * Terminar entrenamiento. Es el ÚNICO lugar donde se puede descartar (con confirmación). Antes de guardar:
 *  - Si quedaron series sin hacer, pregunta por qué terminas ahora (como hacen Hevy/Symmetry: el motivo ayuda a
 *    leer el progreso — dolor y cansancio no se tratan igual que "se me acabó el tiempo") y guarda SOLO lo hecho.
 *  - Si pasaron más de 3 horas, casi seguro olvidaste terminarlo: ofrece corregir la duración (se estima con la
 *    hora de tu última serie) para no inflar tus estadísticas.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Image as ImageIcon, ToggleLeft, ToggleRight } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { useGymStore } from "@/lib/store/gymStore";
import { effectiveWeight, routineExercisesFromSession } from "@/lib/gym-utils";
import { cn } from "@/lib/utils";

const LONG_SESSION_SEC = 3 * 3600;

const REASONS_INCOMPLETE = [
  { key: "tiempo", label: "Se me acabó el tiempo" },
  { key: "cansancio", label: "Estaba muy cansado" },
  { key: "dolor", label: "Dolor o molestia" },
  { key: "equipo", label: "No había equipo" },
  { key: "plan", label: "Cambié de plan" },
  { key: "otro", label: "Otro" },
] as const;

export default function WorkoutSummaryPage() {
  const router = useRouter();
  const activeSession = useGymStore((s) => s.activeSession);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const routines = useGymStore((s) => s.routines);
  const finishWorkout = useGymStore((s) => s.finishWorkout);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);
  const incrementRoutineCompleted = useGymStore((s) => s.incrementRoutineCompleted);
  const updateRoutine = useGymStore((s) => s.updateRoutine);

  const [nombre, setNombre] = useState(activeSession?.nombre ?? "Entrenamiento");
  const [descripcion, setDescripcion] = useState("");
  const [updateRoutineValues, setUpdateRoutineValues] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [elapsedSeconds] = useState(() => (sessionStartedAt ? Math.round((Date.now() - sessionStartedAt) / 1000) : 0));

  // Hora de la última serie hecha: si el entrenamiento quedó abierto horas, de ahí sale la duración real estimada.
  const lastSetAt = useMemo(() => {
    let max = 0;
    for (const ex of activeSession?.ejercicios ?? []) for (const s of ex.sets) if (s.completado && s.completadoAt) max = Math.max(max, s.completadoAt);
    return max;
  }, [activeSession]);
  const estimatedSeconds = sessionStartedAt && lastSetAt > sessionStartedAt ? Math.round((lastSetAt - sessionStartedAt) / 1000) + 60 : 0;
  const tooLong = elapsedSeconds > LONG_SESSION_SEC;
  const [minutesText, setMinutesText] = useState(() => String(Math.max(1, Math.round((estimatedSeconds || 3600) / 60))));

  if (!activeSession) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-16">
        <p className="text-white/60">No hay ningún entrenamiento activo.</p>
        <GlassButton accentColor="var(--gym-2)" onClick={() => router.push("/gym/entrenamiento")}>
          Ir a Entrenamiento
        </GlassButton>
      </div>
    );
  }

  const planned = activeSession.ejercicios.reduce((n, e) => n + e.sets.filter((s) => s.tipo !== "calentamiento").length, 0);
  const done = activeSession.ejercicios.reduce((n, e) => n + e.sets.filter((s) => s.tipo !== "calentamiento" && s.completado).length, 0);
  const missing = Math.max(0, planned - done);
  const allDone = planned > 0 && missing === 0;
  const nothingDone = done === 0;

  const durationSeconds = tooLong ? Math.max(60, Math.round((parseFloat(minutesText) || 0) * 60)) : elapsedSeconds;
  const mins = Math.floor(durationSeconds / 60);
  const volume = activeSession.ejercicios.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completado).reduce((a, s) => a + effectiveWeight(s) * s.reps, 0),
    0,
  );
  const seriesCount = done;
  const needsReason = missing > 0 || tooLong;
  const canSave = !nothingDone && (!needsReason || reason !== null);

  function handleFinish() {
    if (!activeSession || !canSave) return;
    // Actualizar la rutina ANTES de terminar: después `finishWorkout` vacía `activeSession`.
    if (activeSession.routineId && updateRoutineValues) {
      const previous = routines.find((r) => r.id === activeSession.routineId)?.ejercicios ?? [];
      updateRoutine(activeSession.routineId, { ejercicios: routineExercisesFromSession(activeSession, previous) });
    }
    finishWorkout({
      nombre: nombre.trim() || "Entrenamiento",
      dropIncomplete: true,
      durationSeconds: tooLong ? durationSeconds : undefined,
      endReason: reason ?? undefined,
    });
    if (activeSession.routineId) incrementRoutineCompleted(activeSession.routineId);
    router.push("/gym/entrenamiento/activo/racha");
  }

  function handleDiscard() {
    cancelWorkout();
    router.push("/gym/entrenamiento");
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{allDone ? "¡Entrenamiento completado!" : "Terminar entrenamiento"}</h1>
        {missing > 0 && !nothingDone && (
          <p className="text-sm text-white/55">
            Hiciste {done} de {planned} series
          </p>
        )}
      </header>

      <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-center font-semibold" />

      <GlassCard accentColor="var(--gym)" className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Duración" value={`${mins} min`} />
        <Stat label="Volumen" value={`${volume.toLocaleString()} kg`} />
        <Stat label="Series" value={`${seriesCount}`} />
      </GlassCard>

      <p className="text-center text-sm text-white/45">{format(new Date(), "EEEE d 'de' MMMM, HH:mm", { locale: es })}</p>

      {nothingDone && (
        <div className="rounded-2xl bg-white/[0.06] p-4 text-sm text-white/70">
          No completaste ninguna serie, así que no hay nada que guardar. Puedes volver y tildar tus series, o descartar el entrenamiento.
        </div>
      )}

      {tooLong && !nothingDone && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4">
          <p className="text-sm font-semibold text-white">Este entrenamiento lleva más de 3 horas abierto</p>
          <p className="text-xs text-white/55">
            ¿Se te olvidó terminarlo? Dime cuánto duró de verdad para no inflar tus estadísticas
            {estimatedSeconds > 0 ? ` (tu última serie fue a los ${Math.round(estimatedSeconds / 60)} min).` : "."}
          </p>
          <div className="flex items-center gap-2">
            <GlassInput type="number" inputMode="numeric" value={minutesText} onChange={(e) => setMinutesText(e.target.value)} className="flex-1" />
            <span className="text-sm text-white/55">min</span>
          </div>
        </div>
      )}

      {needsReason && !nothingDone && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-white/[0.06] p-4">
          <p className="text-sm font-semibold text-white">
            {tooLong && missing === 0 ? "¿Por qué terminas ahora?" : `¿Por qué terminas sin hacer ${missing} ${missing === 1 ? "serie" : "series"}?`}
          </p>
          <div className="flex flex-wrap gap-2">
            {(tooLong ? [{ key: "olvide", label: "Olvidé terminarlo" }, ...REASONS_INCOMPLETE] : REASONS_INCOMPLETE).map((r) => (
              <button
                key={r.key}
                onClick={() => setReason(r.key)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm cursor-pointer border",
                  reason === r.key ? "border-white bg-white text-black font-semibold" : "border-white/15 bg-white/[0.05] text-white/80",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {missing > 0 && <p className="text-[11px] text-white/40">Se guardan solo las series que hiciste; las demás no cuentan para tus récords ni rangos.</p>}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 py-8 text-white/40">
        <ImageIcon size={28} />
        <p className="text-sm text-center px-6">Añade una foto o video para ver tu progreso</p>
      </div>

      <GlassInput placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

      {activeSession.routineId && (
        <button
          onClick={() => setUpdateRoutineValues((v) => !v)}
          className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/[0.04] glass-specular-ring cursor-pointer"
        >
          <div className="flex flex-col items-start text-left">
            <span className="text-sm text-white/80">Actualizar valores de la rutina</span>
            <span className="text-[11px] text-white/40">
              La rutina queda con los pesos y reps que hiciste hoy (solo series completadas). Los ejercicios que hoy no hiciste se quedan como estaban.
            </span>
          </div>
          {updateRoutineValues ? <ToggleRight size={26} className="text-white shrink-0" /> : <ToggleLeft size={26} className="text-white/30 shrink-0" />}
        </button>
      )}

      <GlassButton accentColor="rgba(255,255,255,0.9)" size="lg" className="!text-black" disabled={!canSave} onClick={handleFinish}>
        {needsReason && reason === null && !nothingDone ? "Elige un motivo para terminar" : "Terminar entrenamiento"}
      </GlassButton>

      <button onClick={() => setDiscardOpen(true)} className="text-center text-sm text-white/45 hover:text-white/70 cursor-pointer">
        Descartar entrenamiento
      </button>

      <ExpandSheet open={discardOpen} onClose={() => setDiscardOpen(false)} title="¿Descartar entrenamiento?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/65">
            Se pierde todo lo que anotaste en este entrenamiento ({done} {done === 1 ? "serie" : "series"} hechas). Esto no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDiscardOpen(false)} className="flex-1 rounded-full py-3 text-sm font-semibold text-white/80 bg-white/[0.08] cursor-pointer">
              Cancelar
            </button>
            <button onClick={handleDiscard} className="flex-1 rounded-full py-3 text-sm font-semibold text-white bg-red-500 cursor-pointer">
              Sí, descartar
            </button>
          </div>
        </div>
      </ExpandSheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}
