"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import type { RoutineExercise } from "@/lib/types";

export default function NewRoutinePage() {
  const router = useRouter();
  const routinesCount = useGymStore((s) => s.routines.length);
  const doSaveRoutine = useGymStore((s) => s.saveRoutine);

  const [draft, setDraft] = useState<RoutineExercise[]>([]);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [routineName, setRoutineName] = useState(`Nueva rutina #${routinesCount + 1}`);

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
        <ExercisePicker
          multiple
          confirmButtonClassName="bottom-20 md:bottom-0 z-30"
          onConfirmSelection={(exs) => addExercises(exs.map((e) => e.id))}
        />
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

      <ExerciseSessionBuilder draft={draft} onDraftChange={setDraft} />

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
