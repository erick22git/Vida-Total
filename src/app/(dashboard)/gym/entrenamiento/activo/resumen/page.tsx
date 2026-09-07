"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Image as ImageIcon, ToggleLeft, ToggleRight } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";

export default function WorkoutSummaryPage() {
  const router = useRouter();
  const activeSession = useGymStore((s) => s.activeSession);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const finishWorkout = useGymStore((s) => s.finishWorkout);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);
  const incrementRoutineCompleted = useGymStore((s) => s.incrementRoutineCompleted);

  const [nombre, setNombre] = useState(activeSession?.nombre ?? "Entrenamiento");
  const [descripcion, setDescripcion] = useState("");
  const [updateRoutineValues, setUpdateRoutineValues] = useState(true);
  const [durationSeconds] = useState(() =>
    sessionStartedAt ? Math.round((Date.now() - sessionStartedAt) / 1000) : 0,
  );

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

  const mins = Math.floor(durationSeconds / 60);
  const volume = activeSession.ejercicios.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completado).reduce((a, s) => a + s.peso * s.reps, 0),
    0,
  );
  const seriesCount = activeSession.ejercicios.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completado).length,
    0,
  );

  function handleFinish() {
    finishWorkout({ nombre: nombre.trim() || "Entrenamiento" });
    if (activeSession?.routineId) incrementRoutineCompleted(activeSession.routineId);
    router.push("/gym/entrenamiento/activo/racha");
  }

  function handleDiscard() {
    cancelWorkout();
    router.push("/gym/entrenamiento");
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">¡Entrenamiento completado!</h1>
      </header>

      <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-center font-semibold" />

      <GlassCard accentColor="var(--gym)" className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Duración" value={`${mins} min`} />
        <Stat label="Volumen" value={`${volume.toLocaleString()} kg`} />
        <Stat label="Series" value={`${seriesCount}`} />
      </GlassCard>

      <p className="text-center text-sm text-white/45">
        {format(new Date(), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
      </p>

      <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 py-8 text-white/40">
        <ImageIcon size={28} />
        <p className="text-sm text-center px-6">Añade una foto o video para ver tu progreso</p>
      </div>

      <GlassInput
        placeholder="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <button
        onClick={() => setUpdateRoutineValues((v) => !v)}
        className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.1] cursor-pointer"
      >
        <span className="text-sm text-white/80">Actualizar valores de la rutina</span>
        {updateRoutineValues ? (
          <ToggleRight size={26} className="text-[var(--gym-2)]" />
        ) : (
          <ToggleLeft size={26} className="text-white/30" />
        )}
      </button>

      <GlassButton accentColor="var(--gym-2)" size="lg" onClick={handleFinish}>
        Terminar entrenamiento
      </GlassButton>

      <button onClick={handleDiscard} className="text-center text-sm text-white/35 hover:text-white/60 cursor-pointer">
        Descartar entrenamiento
      </button>
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
