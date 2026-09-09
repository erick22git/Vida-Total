"use client";

import { useRef, useState } from "react";
import { Reorder, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Dumbbell, Repeat, Trash2, Clock, PlayCircle, StickyNote, Hash } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { RoutineSetTable } from "@/components/gym/routine-set-table";
import { RestDurationModal, formatRestDuration } from "@/components/gym/rest-duration-modal";
import { PillActionButton } from "@/components/gym/pill-action-button";
import { RestBar } from "@/components/gym/rest-bar";
import { cn } from "@/lib/utils";
import type { RoutineExercise } from "@/lib/types";

/**
 * Shared "carousel + hero image + compact action row + set table" editor for
 * a list of RoutineExercise entries. Powers "Nueva rutina", "Editar rutina",
 * and editing a single day inside a training plan (Planificaciones) — same
 * pattern, same code, so all three stay visually and behaviorally in sync
 * with the active-workout screen (`gym/entrenamiento/activo`).
 */
export function ExerciseSessionBuilder({
  draft,
  onDraftChange,
  addButtonLabel = "Agregar ejercicios",
}: {
  draft: RoutineExercise[];
  onDraftChange: (next: RoutineExercise[]) => void;
  addButtonLabel?: string;
}) {
  const router = useRouter();
  const allExercises = useAllExercises();

  const [activeId, setActiveId] = useState<string | null>(draft[0]?.exerciseId ?? null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Planning-only rest preview: this screen has no live session, so the
  // "descanso" bar shown after checking a set is a local, informative
  // countdown rather than one tied to the real workout store.
  const [planRestEndsAt, setPlanRestEndsAt] = useState<number | null>(null);

  const safeIndex = Math.max(
    0,
    draft.findIndex((ex) => ex.exerciseId === activeId),
  );
  const active = draft[safeIndex] ?? draft[0];
  const activeExercise = active ? allExercises.find((e) => e.id === active.exerciseId) : undefined;

  function selectExercise(id: string) {
    setActiveId(id);
    setPlanRestEndsAt(null);
  }

  function addExercises(ids: string[]) {
    const newOnes = ids
      .filter((id) => !draft.some((de) => de.exerciseId === id))
      .map<RoutineExercise>((id) => ({
        exerciseId: id,
        sets: [
          { peso: 0, reps: 10, tipo: "normal" },
          { peso: 0, reps: 10, tipo: "normal" },
          { peso: 0, reps: 10, tipo: "normal" },
        ],
      }));
    onDraftChange([...draft, ...newOnes]);
    if (!activeId && newOnes[0]) setActiveId(newOnes[0].exerciseId);
  }

  function replaceActive(newId: string) {
    onDraftChange(draft.map((ex, i) => (i === safeIndex ? { ...ex, exerciseId: newId } : ex)));
    setActiveId(newId);
    setReplacePickerOpen(false);
  }

  function removeActive() {
    const next = draft.filter((_, i) => i !== safeIndex);
    onDraftChange(next);
    setActiveId(next[Math.min(safeIndex, next.length - 1)]?.exerciseId ?? null);
    setPlanRestEndsAt(null);
  }

  function toggleSoloReps() {
    onDraftChange(draft.map((ex, i) => (i === safeIndex ? { ...ex, soloReps: !ex.soloReps } : ex)));
  }

  function updateActiveNote(nota: string) {
    onDraftChange(draft.map((ex, i) => (i === safeIndex ? { ...ex, nota } : ex)));
  }

  function updateActiveRest(seconds: number) {
    onDraftChange(draft.map((ex, i) => (i === safeIndex ? { ...ex, restSeconds: seconds } : ex)));
  }

  function updateActiveSets(sets: RoutineExercise["sets"]) {
    onDraftChange(draft.map((ex, i) => (i === safeIndex ? { ...ex, sets } : ex)));
  }

  function handleSetChecked() {
    setPlanRestEndsAt(Date.now() + (active?.restSeconds ?? 90) * 1000);
  }

  function startLongPress(id: string) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMovingId(id);
    }, 450);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleCircleClick(id: string) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (movingId) {
      setMovingId(null);
      return;
    }
    selectExercise(id);
  }

  if (draft.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <Reorder.Group
        axis="x"
        values={draft}
        onReorder={onDraftChange}
        className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1"
      >
        {draft.map((ex) => {
          const exData = allExercises.find((e) => e.id === ex.exerciseId);
          const isMoving = movingId === ex.exerciseId;
          return (
            <Reorder.Item
              key={ex.exerciseId}
              value={ex}
              dragListener={isMoving}
              onPointerDown={() => startLongPress(ex.exerciseId)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onClick={() => handleCircleClick(ex.exerciseId)}
              className={cn(
                "shrink-0 flex flex-col items-center gap-1 cursor-pointer select-none",
                isMoving && "cursor-grabbing",
              )}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06] transition-transform"
                style={{
                  border: ex.exerciseId === active?.exerciseId ? "2px solid var(--gym-2)" : "2px solid transparent",
                  boxShadow: isMoving
                    ? "0 0 0 3px var(--gym-2)66"
                    : ex.exerciseId === active?.exerciseId
                      ? "0 0 16px var(--gym-2)66"
                      : undefined,
                  transform: isMoving ? "scale(1.08)" : undefined,
                }}
              >
                {exData?.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exData.imagen} alt="" className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  <Dumbbell size={20} className="text-white/40" />
                )}
              </div>
              <span className="text-[10px] text-white/50 max-w-14 truncate">{exData?.nombre}</span>
            </Reorder.Item>
          );
        })}
        <button
          onClick={() => setAddPickerOpen(true)}
          className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center bg-white/[0.05] border border-dashed border-white/20 text-white/50 text-2xl cursor-pointer"
        >
          +
        </button>
      </Reorder.Group>

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

          <div className="flex items-center gap-2 flex-wrap">
            <PillActionButton
              icon={PlayCircle}
              title="Tutorial"
              onClick={() => router.push(`/gym/entrenamiento/${activeExercise.id}?tab=guia`)}
            />
            <PillActionButton icon={Repeat} title="Reemplazar" onClick={() => setReplacePickerOpen(true)} />
            <PillActionButton
              icon={Clock}
              title="Descanso"
              badge={formatRestDuration(active.restSeconds ?? 90)}
              onClick={() => setRestModalOpen(true)}
            />
            <PillActionButton
              icon={Hash}
              title={active.soloReps ? "Solo reps" : "Con peso"}
              active={active.soloReps}
              onClick={toggleSoloReps}
            />
            <PillActionButton
              icon={StickyNote}
              title="Nota"
              active={!!active.nota}
              onClick={() => setNoteOpen((o) => !o)}
            />
            <PillActionButton icon={Trash2} title="Borrar" onClick={removeActive} danger className="ml-auto" />
          </div>

          {noteOpen && (
            <GlassInput
              placeholder="Agregar una nota..."
              value={active.nota ?? ""}
              onChange={(e) => updateActiveNote(e.target.value)}
              autoFocus
            />
          )}

          <RoutineSetTable
            sets={active.sets}
            soloReps={active.soloReps}
            onChange={updateActiveSets}
            exerciseId={active.exerciseId}
            onSetChecked={handleSetChecked}
          />

          <AnimatePresence>
            {planRestEndsAt && (
              <RestBar
                key="plan-rest-bar"
                restEndsAt={planRestEndsAt}
                onAdjust={(delta) => setPlanRestEndsAt((prev) => (prev ? Math.max(Date.now(), prev + delta * 1000) : prev))}
                onSkip={() => setPlanRestEndsAt(null)}
              />
            )}
          </AnimatePresence>
        </>
      )}

      <GlassModal open={addPickerOpen} onClose={() => setAddPickerOpen(false)} title={addButtonLabel}>
        <ExercisePicker
          multiple
          onConfirmSelection={(exs) => {
            addExercises(exs.map((e) => e.id));
            setAddPickerOpen(false);
          }}
        />
      </GlassModal>

      <GlassModal open={replacePickerOpen} onClose={() => setReplacePickerOpen(false)} title="Reemplazar ejercicio">
        <ExercisePicker onSelect={(ex) => replaceActive(ex.id)} />
      </GlassModal>

      {active && (
        <RestDurationModal
          open={restModalOpen}
          onClose={() => setRestModalOpen(false)}
          value={active.restSeconds ?? 90}
          onConfirm={updateActiveRest}
        />
      )}
    </div>
  );
}
