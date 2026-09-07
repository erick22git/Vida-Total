"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, Repeat, Trash2, StickyNote } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { RoutineSetTable } from "@/components/gym/routine-set-table";
import { useGymStore } from "@/lib/store/gymStore";
import type { RoutineExercise } from "@/lib/types";

export default function NewRoutinePage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const saveRoutine = useGymStore((s) => s.routines.length);
  const doSaveRoutine = useGymStore((s) => s.saveRoutine);

  const [draft, setDraft] = useState<RoutineExercise[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [routineName, setRoutineName] = useState(`Nueva rutina #${saveRoutine + 1}`);

  const active = draft[activeIndex];
  const activeExercise = active ? allExercises.find((e) => e.id === active.exerciseId) : undefined;

  function addExercises(ids: string[]) {
    setDraft((d) => [
      ...d,
      ...ids
        .filter((id) => !d.some((de) => de.exerciseId === id))
        .map<RoutineExercise>((id) => ({
          exerciseId: id,
          sets: [
            { peso: 0, reps: 10, tipo: "normal" },
            { peso: 0, reps: 10, tipo: "normal" },
            { peso: 0, reps: 10, tipo: "normal" },
          ],
        })),
    ]);
  }

  function removeActive() {
    setDraft((d) => d.filter((_, i) => i !== activeIndex));
    setActiveIndex((i) => Math.max(0, i - 1));
  }

  function toggleSoloReps() {
    setDraft((d) => d.map((ex, i) => (i === activeIndex ? { ...ex, soloReps: !ex.soloReps } : ex)));
  }

  function updateActiveSets(sets: RoutineExercise["sets"]) {
    setDraft((d) => d.map((ex, i) => (i === activeIndex ? { ...ex, sets } : ex)));
  }

  function updateActiveNote(nota: string) {
    setDraft((d) => d.map((ex, i) => (i === activeIndex ? { ...ex, nota } : ex)));
  }

  function handleSave() {
    if (!routineName.trim() || draft.length === 0) return;
    const routine = doSaveRoutine(routineName.trim(), draft);
    router.push(`/gym/entrenamiento/rutinas/${routine.id}`);
  }

  if (draft.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center gap-3 pt-2">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Nueva rutina</h1>
        </header>
        <p className="text-sm text-white/50 -mt-3">Selecciona los ejercicios para tu rutina.</p>
        <ExercisePicker multiple onConfirmSelection={(exs) => addExercises(exs.map((e) => e.id))} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Nueva rutina</h1>
        </div>
        <GlassButton size="sm" accentColor="var(--gym-2)" onClick={() => setNameModalOpen(true)}>
          Guardar
        </GlassButton>
      </header>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {draft.map((ex, i) => {
          const exData = allExercises.find((e) => e.id === ex.exerciseId);
          return (
            <button
              key={ex.exerciseId}
              onClick={() => setActiveIndex(i)}
              className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06]"
                style={{
                  border: i === activeIndex ? "2px solid var(--gym-2)" : "2px solid transparent",
                  boxShadow: i === activeIndex ? "0 0 16px var(--gym-2)66" : undefined,
                }}
              >
                {exData?.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exData.imagen} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Dumbbell size={20} className="text-white/40" />
                )}
              </div>
              <span className="text-[10px] text-white/50 max-w-14 truncate">{exData?.nombre}</span>
            </button>
          );
        })}
        <button
          onClick={() => setPickerOpen(true)}
          className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center bg-white/[0.05] border border-dashed border-white/20 text-white/50 text-2xl cursor-pointer"
        >
          +
        </button>
      </div>

      {activeExercise && active && (
        <>
          <GlassCard accentColor="var(--gym)" glow className="flex flex-col gap-3">
            <div className="flex items-center justify-center w-full aspect-video rounded-2xl bg-white/[0.05] overflow-hidden">
              {activeExercise.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeExercise.imagen} alt={activeExercise.nombre} className="w-full h-full object-cover" />
              ) : (
                <Dumbbell size={44} className="text-white/20" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-white">{activeExercise.nombre}</h2>
          </GlassCard>

          <div className="flex gap-2">
            <ActionButton icon={Repeat} label="Reemplazar" onClick={() => setPickerOpen(true)} />
            <ActionButton icon={Trash2} label="Borrar" onClick={removeActive} danger />
            <ActionButton
              icon={StickyNote}
              label={active.soloReps ? "Con peso" : "Reps"}
              onClick={toggleSoloReps}
              active={active.soloReps}
            />
          </div>

          <GlassInput
            placeholder="Agregar una nota..."
            value={active.nota ?? ""}
            onChange={(e) => updateActiveNote(e.target.value)}
          />

          <RoutineSetTable
            sets={active.sets}
            soloReps={active.soloReps}
            onChange={updateActiveSets}
            exerciseId={active.exerciseId}
          />
        </>
      )}

      <GlassModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Agregar ejercicios">
        <ExercisePicker
          multiple
          onConfirmSelection={(exs) => {
            addExercises(exs.map((e) => e.id));
            setPickerOpen(false);
          }}
        />
      </GlassModal>

      <GlassModal open={nameModalOpen} onClose={() => setNameModalOpen(false)} title="Guardar rutina">
        <div className="flex flex-col gap-4">
          <GlassInput
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            placeholder="Nombre de la rutina"
            autoFocus
          />
          <GlassButton accentColor="var(--gym-2)" size="lg" onClick={handleSave}>
            Guardar rutina
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-medium cursor-pointer transition-colors"
      style={{
        background: active ? "var(--gym)22" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "var(--gym)" : "rgba(255,255,255,0.12)"}`,
        color: danger ? "#f87171" : active ? "white" : "rgba(255,255,255,0.65)",
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
