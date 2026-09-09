"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Dumbbell,
  Plus,
  BookOpen,
  Repeat,
  StickyNote,
  Clock,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { SessionSetRow } from "@/components/gym/session-set-row";
import { SessionExerciseCarousel } from "@/components/gym/session-exercise-carousel";
import { RestBar } from "@/components/gym/rest-bar";
import { RestDurationModal, formatRestDuration } from "@/components/gym/rest-duration-modal";
import { PillActionButton } from "@/components/gym/pill-action-button";
import { SessionTimer } from "@/components/gym/session-timer";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const activeSession = useGymStore((s) => s.activeSession);
  const activeExerciseIndex = useGymStore((s) => s.activeExerciseIndex);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const setActiveExerciseIndex = useGymStore((s) => s.setActiveExerciseIndex);
  const addSetToExercise = useGymStore((s) => s.addSetToExercise);
  const updateSet = useGymStore((s) => s.updateSet);
  const replaceExercise = useGymStore((s) => s.replaceExercise);
  const setExerciseNote = useGymStore((s) => s.setExerciseNote);
  const setExerciseRest = useGymStore((s) => s.setExerciseRest);
  const startRest = useGymStore((s) => s.startRest);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);

  const [collapsed, setCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [restConfigOpen, setRestConfigOpen] = useState(false);

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

  const total = activeSession.ejercicios.length;
  const currentLog = activeSession.ejercicios[activeExerciseIndex];
  const exercise = allExercises.find((e) => e.id === currentLog.exerciseId);
  const isLast = activeExerciseIndex === total - 1;
  const completedSets = currentLog.sets.filter((s) => s.completado).length;
  const soloReps = currentLog.sets[0]?.soloReps;
  const restSeconds = currentLog.restSeconds ?? 90;

  const totalSetsAll = activeSession.ejercicios.reduce((sum, e) => sum + e.sets.length, 0);
  const doneSetsAll = activeSession.ejercicios.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completado).length,
    0,
  );
  const overallPct = totalSetsAll > 0 ? Math.round((doneSetsAll / totalSetsAll) * 100) : 0;

  function handleSetChange(setId: string, patch: Parameters<typeof updateSet>[2]) {
    updateSet(currentLog.exerciseId, setId, patch);
    if (patch.completado) {
      startRest(currentLog.exerciseId, restSeconds);
      const isExerciseNowComplete = currentLog.sets.every((s) => (s.id === setId ? true : s.completado));
      if (isExerciseNowComplete && !isLast) {
        setTimeout(() => setActiveExerciseIndex(activeExerciseIndex + 1), 500);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <header className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronDown size={20} className={collapsed ? "-rotate-90 transition-transform" : "transition-transform"} />
        </button>
        <SessionTimer startedAt={sessionStartedAt} />
        <button
          onClick={() => router.push("/gym/entrenamiento/activo/resumen")}
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg, var(--gym), var(--gym-2))" }}
        >
          Terminar
        </button>
      </header>

      <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden -mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, var(--gym), var(--gym-2))" }}
        />
      </div>

      {!collapsed && (
        <>
          <SessionExerciseCarousel
            ejercicios={activeSession.ejercicios}
            allExercises={allExercises}
            activeIndex={activeExerciseIndex}
            onSelect={setActiveExerciseIndex}
          />

          {exercise && (
            <GlassCard accentColor="var(--gym)" glow className="flex flex-col gap-3">
              <div className="flex items-center justify-center w-full aspect-video rounded-2xl bg-white/[0.05] overflow-hidden">
                {exercise.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exercise.imagen} alt={exercise.nombre} className="w-full h-full object-cover" />
                ) : (
                  <Dumbbell size={48} className="text-white/20" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{exercise.nombre}</h2>
                <p className="text-xs text-white/45 mt-0.5">
                  {completedSets}/{currentLog.sets.length} series completadas
                </p>
              </div>
            </GlassCard>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <PillActionButton icon={BookOpen} title="Tutorial" onClick={() => exercise && router.push(`/gym/entrenamiento/${exercise.id}?tab=guia`)} />
            <PillActionButton icon={Repeat} title="Reemplazar" onClick={() => setPickerOpen(true)} />
            <PillActionButton icon={StickyNote} title="Notas" onClick={() => setNotesOpen(true)} active={!!currentLog.nota} />
            <PillActionButton icon={Clock} title="Descanso" badge={formatRestDuration(restSeconds)} onClick={() => setRestConfigOpen(true)} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold text-white/40 uppercase tracking-wide">
              <span className="w-8 text-center">Serie</span>
              <span className="text-center">{soloReps ? "" : "Kg"}</span>
              <span className="text-center">Reps</span>
              <span className="text-center">IA</span>
              <span className="w-9" />
            </div>
            {currentLog.sets.map((set, i) => (
              <SessionSetRow
                key={set.id}
                index={i}
                set={set}
                soloReps={soloReps}
                onChange={(patch) => handleSetChange(set.id, patch)}
              />
            ))}
            <button
              onClick={() => addSetToExercise(currentLog.exerciseId)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/30 transition-colors cursor-pointer"
            >
              <Plus size={15} /> Añadir serie
            </button>
          </div>

          <AnimatePresence>
            <RestBar key="rest-bar" />
          </AnimatePresence>
        </>
      )}

      <GlassModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Cambiar ejercicio">
        <ExercisePicker
          activeExerciseId={currentLog.exerciseId}
          onSelect={(ex) => {
            replaceExercise(currentLog.exerciseId, ex.id);
            setPickerOpen(false);
          }}
        />
      </GlassModal>

      <GlassModal open={notesOpen} onClose={() => setNotesOpen(false)} title="Nota del ejercicio">
        <div className="flex flex-col gap-4">
          <GlassInput
            placeholder="Agregar una nota..."
            defaultValue={currentLog.nota}
            onChange={(e) => setExerciseNote(currentLog.exerciseId, e.target.value)}
            autoFocus
          />
          <GlassButton accentColor="var(--gym-2)" onClick={() => setNotesOpen(false)}>
            Guardar
          </GlassButton>
        </div>
      </GlassModal>

      <RestDurationModal
        open={restConfigOpen}
        onClose={() => setRestConfigOpen(false)}
        value={restSeconds}
        onConfirm={(sec) => setExerciseRest(currentLog.exerciseId, sec)}
      />

      <button
        onClick={() => {
          if (confirm("¿Descartar el entrenamiento en curso?")) {
            cancelWorkout();
            router.push("/gym/entrenamiento");
          }
        }}
        className="text-center text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
      >
        Descartar entrenamiento
      </button>
    </div>
  );
}
