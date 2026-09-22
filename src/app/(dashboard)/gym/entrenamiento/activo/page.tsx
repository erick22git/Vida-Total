"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Plus,
  Layers,
  Repeat,
  StickyNote,
  Clock,
  Sparkles,
  Trash2,
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
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { DropsetWeightsModal } from "@/components/gym/dropset-weights-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { previaLabelFor } from "@/lib/gym-utils";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const activeSession = useGymStore((s) => s.activeSession);
  const sessions = useGymStore((s) => s.sessions);
  const activeExerciseIndex = useGymStore((s) => s.activeExerciseIndex);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const setActiveExerciseIndex = useGymStore((s) => s.setActiveExerciseIndex);
  const reorderActiveExercises = useGymStore((s) => s.reorderActiveExercises);
  const addSetToExercise = useGymStore((s) => s.addSetToExercise);
  const updateSet = useGymStore((s) => s.updateSet);
  const completeSet = useGymStore((s) => s.completeSet);
  const replaceExercise = useGymStore((s) => s.replaceExercise);
  const setExerciseNote = useGymStore((s) => s.setExerciseNote);
  const setExerciseRest = useGymStore((s) => s.setExerciseRest);
  const startRest = useGymStore((s) => s.startRest);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);
  const addExercisesToSession = useGymStore((s) => s.addExercisesToSession);
  const removeExerciseFromSession = useGymStore((s) => s.removeExerciseFromSession);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [restConfigOpen, setRestConfigOpen] = useState(false);
  const [dropsetTypeOpen, setDropsetTypeOpen] = useState(false);
  const [dropsetWeightsOpen, setDropsetWeightsOpen] = useState(false);
  const [aiComingSoonOpen, setAiComingSoonOpen] = useState(false);

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

  // Capturado en un local no-nulo: TypeScript no retiene el chequeo de
  // `activeSession` de arriba dentro de handleSetChange (closure anidada).
  const ejercicios = activeSession.ejercicios;
  const total = ejercicios.length;
  const currentLog = ejercicios[activeExerciseIndex];
  const exercise = allExercises.find((e) => e.id === currentLog.exerciseId);
  const completedSets = currentLog.sets.filter((s) => s.completado).length;
  const groupPartners = currentLog.grupo
    ? activeSession.ejercicios.filter((ex) => ex.grupo === currentLog.grupo && ex.exerciseId !== currentLog.exerciseId)
    : [];
  const soloReps = currentLog.sets[0]?.soloReps;
  const restSeconds = currentLog.restSeconds ?? 90;
  // "Previa": con cuánto peso x reps hiciste cada serie la última vez que
  // entrenaste este ejercicio (sessions viene ordenado del más reciente al
  // más viejo, así que el primer match ya es el último entrenamiento).
  const lastLog = sessions.find((sess) => sess.ejercicios.some((e) => e.exerciseId === currentLog.exerciseId))?.ejercicios.find(
    (e) => e.exerciseId === currentLog.exerciseId,
  );

  const totalSetsAll = activeSession.ejercicios.reduce((sum, e) => sum + e.sets.length, 0);
  const doneSetsAll = activeSession.ejercicios.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completado).length,
    0,
  );
  const overallPct = totalSetsAll > 0 ? Math.round((doneSetsAll / totalSetsAll) * 100) : 0;

  // Numeración de series: solo las de tipo "normal" cuentan (1, 2, 3...);
  // las de calentamiento/dropset/fallo muestran su letra (C/D/F) y no
  // interrumpen el conteo de las normales que vienen después.
  let normalCounter = 0;
  const normalNumbers = currentLog.sets.map((s) => ((s.tipo ?? "normal") === "normal" ? ++normalCounter : undefined));
  const firstUncheckedIndex = currentLog.sets.findIndex((s) => !s.completado);
  const firstUncheckedSet = firstUncheckedIndex === -1 ? undefined : currentLog.sets[firstUncheckedIndex];
  // Series "una por una": solo se muestran las ya completadas más la
  // siguiente pendiente — el resto aparece recién cuando le toca. Si ya no
  // queda ninguna pendiente, se muestran todas (y ahí sí tiene sentido el
  // botón de "Añadir serie").
  const visibleSetCount = firstUncheckedIndex === -1 ? currentLog.sets.length : firstUncheckedIndex + 1;
  const visibleSets = currentLog.sets.slice(0, visibleSetCount);

  function handleSetChange(setId: string, patch: Parameters<typeof updateSet>[2]) {
    if (!patch.completado) {
      updateSet(currentLog.exerciseId, setId, patch);
      return;
    }
    completeSet(currentLog.exerciseId, setId, patch);

    const setIndex = currentLog.sets.findIndex((s) => s.id === setId);
    // Superserie (Bloque agrupar): ejercicios con el mismo `grupo` se hacen
    // serie por serie, uno tras otro, sin descanso hasta terminar la ronda.
    // Sin `grupo`, el "grupo" es solo este ejercicio (mismo comportamiento
    // de siempre).
    const groupMembers = currentLog.grupo
      ? ejercicios.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.grupo === currentLog.grupo)
      : [{ ex: currentLog, i: activeExerciseIndex }];

    const nextPartner = groupMembers.find(
      ({ ex, i }) => i !== activeExerciseIndex && ex.sets[setIndex] && !ex.sets[setIndex].completado,
    );
    if (nextPartner) {
      setTimeout(() => setActiveExerciseIndex(nextPartner.i), 300);
      return;
    }

    // Ronda de la superserie completa (o ejercicio suelto): recién acá
    // corresponde descansar.
    startRest(currentLog.exerciseId, restSeconds);
    const groupFullyDone = groupMembers.every(({ ex, i }) =>
      ex.sets.every((s, si) => (i === activeExerciseIndex && si === setIndex ? true : s.completado)),
    );
    if (groupFullyDone) {
      const lastGroupIndex = Math.max(...groupMembers.map(({ i }) => i));
      if (lastGroupIndex < total - 1) {
        setTimeout(() => setActiveExerciseIndex(lastGroupIndex + 1), 500);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <header className="flex items-center justify-between gap-3 pt-2">
        <SessionTimer startedAt={sessionStartedAt} />
        <button
          onClick={() => router.push("/gym/entrenamiento/activo/resumen")}
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-white glass-specular-ring cursor-pointer"
          style={{ background: "rgba(255,255,255,0.12)" }}
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

      <SessionExerciseCarousel
        ejercicios={activeSession.ejercicios}
        allExercises={allExercises}
        activeIndex={activeExerciseIndex}
        onSelect={setActiveExerciseIndex}
        onReorder={reorderActiveExercises}
        onAdd={() => setAddPickerOpen(true)}
      />

      {exercise && (
        <GlassCard accentColor="var(--gym)" glow className="flex flex-col gap-3">
          <button
            onClick={() => router.push(`/gym/entrenamiento/${exercise.id}?tab=guia`)}
            className="flex items-center justify-center w-full aspect-video rounded-2xl bg-white/[0.05] glass-specular-ring overflow-hidden cursor-pointer"
            title="Ver tutorial del ejercicio"
          >
            {exercise.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={exercise.imagen} alt={exercise.nombre} className="w-full h-full object-cover" />
            ) : (
              <Dumbbell size={48} className="text-white/20" />
            )}
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white">{exercise.nombre}</h2>
            <p className="text-xs text-white/45 mt-0.5">
              {completedSets}/{currentLog.sets.length} series completadas
              {currentLog.agregadoEnSesion && " · agregado en esta sesión"}
            </p>
            {groupPartners.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--gym-2)" }}>
                Superserie con: {groupPartners.map((ex) => allExercises.find((e) => e.id === ex.exerciseId)?.nombre ?? "?").join(", ")}
              </p>
            )}
          </div>
        </GlassCard>
      )}

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <PillActionButton
          icon={Layers}
          title="Drop set"
          onClick={() => firstUncheckedSet && setDropsetTypeOpen(true)}
          className={!firstUncheckedSet ? "opacity-40 pointer-events-none" : ""}
        />
        <PillActionButton icon={Repeat} title="Reemplazar" onClick={() => setPickerOpen(true)} />
        <PillActionButton icon={StickyNote} title="Notas" onClick={() => setNotesOpen(true)} active={!!currentLog.nota} />
        <PillActionButton icon={Clock} title="Descanso" badge={formatRestDuration(restSeconds)} onClick={() => setRestConfigOpen(true)} />
        <PillActionButton icon={Sparkles} title="IA" onClick={() => setAiComingSoonOpen(true)} />
        <PillActionButton
          icon={Trash2}
          title="Eliminar"
          danger
          onClick={() => {
            if (confirm(`¿Sacar "${exercise?.nombre ?? "este ejercicio"}" del entrenamiento de hoy?`)) {
              removeExerciseFromSession(currentLog.exerciseId);
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto] gap-2 px-1 text-[11px] font-semibold text-white/40 uppercase tracking-wide">
          <span className="w-8 text-center">Serie</span>
          <span className="w-12 text-center">Previa</span>
          <span className="text-center">{soloReps ? "" : "Kg"}</span>
          <span className="text-center">Reps</span>
          <span className="w-9 text-center">Desc.</span>
          <span className="w-9" />
        </div>
        {visibleSets.map((set, i) => (
          <SessionSetRow
            key={set.id}
            index={i}
            normalNumber={normalNumbers[i]}
            set={set}
            soloReps={soloReps}
            previa={previaLabelFor(lastLog?.sets[i], soloReps)}
            restSeconds={restSeconds}
            onChange={(patch) => handleSetChange(set.id, patch)}
          />
        ))}
        {visibleSetCount === currentLog.sets.length && (
          <button
            onClick={() => addSetToExercise(currentLog.exerciseId)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/30 transition-colors cursor-pointer"
          >
            <Plus size={15} /> Añadir serie
          </button>
        )}
      </div>

      <AnimatePresence>
        <RestBar key="rest-bar" />
      </AnimatePresence>

      <GlassModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Cambiar ejercicio">
        <ExercisePicker
          activeExerciseId={currentLog.exerciseId}
          onSelect={(ex) => {
            replaceExercise(currentLog.exerciseId, ex.id);
            setPickerOpen(false);
          }}
        />
      </GlassModal>

      <GlassModal open={addPickerOpen} onClose={() => setAddPickerOpen(false)} title="Agregar ejercicios">
        <ExercisePicker
          multiple
          onConfirmSelection={(exs) => {
            addExercisesToSession(exs.map((e) => e.id));
            setAddPickerOpen(false);
          }}
        />
      </GlassModal>

      <SetTypeModal
        open={dropsetTypeOpen}
        onClose={() => setDropsetTypeOpen(false)}
        value={firstUncheckedSet?.tipo ?? "normal"}
        onSelect={(tipo) => {
          if (!firstUncheckedSet) return;
          updateSet(currentLog.exerciseId, firstUncheckedSet.id, { tipo });
          setDropsetTypeOpen(false);
          if (tipo === "descendente") setDropsetWeightsOpen(true);
        }}
      />
      <DropsetWeightsModal
        open={dropsetWeightsOpen}
        onClose={() => setDropsetWeightsOpen(false)}
        initialWeights={firstUncheckedSet?.pesosDescendentes ?? []}
        onSave={(weights) => {
          if (!firstUncheckedSet) return;
          updateSet(currentLog.exerciseId, firstUncheckedSet.id, { pesosDescendentes: weights, peso: weights[0] ?? 0 });
        }}
      />

      <GlassModal open={aiComingSoonOpen} onClose={() => setAiComingSoonOpen(false)} title="Escáner de técnica IA">
        <p className="text-sm text-white/60">
          Estamos preparando el escáner de movimiento con la cámara para revisar tu técnica desde distintos
          ángulos. Todavía no está disponible — pronto vas a poder activarlo desde acá.
        </p>
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
