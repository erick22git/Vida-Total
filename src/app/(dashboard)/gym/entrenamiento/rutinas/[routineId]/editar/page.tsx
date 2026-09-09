"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { ExercisePicker } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import type { RoutineExercise } from "@/lib/types";

export default function EditRoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = use(params);
  const router = useRouter();
  const routines = useGymStore((s) => s.routines);
  const updateRoutine = useGymStore((s) => s.updateRoutine);
  const routine = routines.find((r) => r.id === routineId);

  const [draft, setDraft] = useState<RoutineExercise[]>(routine?.ejercicios ?? []);
  const [emptyPickerOpen, setEmptyPickerOpen] = useState(false);

  if (!routine) {
    return (
      <div className="flex flex-col gap-6 items-center text-center py-16">
        <p className="text-white/60">Rutina no encontrada.</p>
        <GlassButton accentColor="var(--gym-2)" onClick={() => router.push("/gym/entrenamiento")}>
          Ir a Entrenamiento
        </GlassButton>
      </div>
    );
  }

  function handleSave() {
    if (!routine) return;
    updateRoutine(routine.id, { ejercicios: draft });
    router.push(`/gym/entrenamiento/rutinas/${routine.id}`);
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">Editar: {routine.nombre}</h1>
        </div>
        <GlassButton size="sm" accentColor="var(--gym-2)" onClick={handleSave}>
          Guardar
        </GlassButton>
      </header>

      {draft.length === 0 ? (
        <div className="flex flex-col gap-4 items-center text-center py-8">
          <p className="text-sm text-white/50">Esta rutina no tiene ejercicios.</p>
          <GlassButton accentColor="var(--gym-2)" onClick={() => setEmptyPickerOpen(true)}>
            Agregar ejercicios
          </GlassButton>
        </div>
      ) : (
        <ExerciseSessionBuilder draft={draft} onDraftChange={setDraft} />
      )}

      <GlassModal open={emptyPickerOpen} onClose={() => setEmptyPickerOpen(false)} title="Agregar ejercicios">
        <ExercisePicker
          multiple
          onConfirmSelection={(exs) => {
            setDraft(
              exs.map((e) => ({
                exerciseId: e.id,
                sets: [
                  { peso: 0, reps: 10, tipo: "normal" },
                  { peso: 0, reps: 10, tipo: "normal" },
                  { peso: 0, reps: 10, tipo: "normal" },
                ],
              })),
            );
            setEmptyPickerOpen(false);
          }}
        />
      </GlassModal>
    </div>
  );
}
