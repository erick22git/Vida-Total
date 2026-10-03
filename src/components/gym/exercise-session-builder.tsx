"use client";

import { useState } from "react";
import { Reorder, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Repeat,
  Trash2,
  Clock,
  PlayCircle,
  StickyNote,
  Hash,
  MoreVertical,
  Link2,
  Link2Off,
  Check,
  ListOrdered,
  Minus,
  Plus,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { RoutineSetTable } from "@/components/gym/routine-set-table";
import { RestDurationModal, formatRestDuration } from "@/components/gym/rest-duration-modal";
import { PillActionButton } from "@/components/gym/pill-action-button";
import { RestBar } from "@/components/gym/rest-bar";
import { ReorderableExerciseCircle } from "@/components/gym/session-exercise-carousel";
import { newRoutineExercises } from "@/lib/gym-utils";
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupSelection, setGroupSelection] = useState<string[]>([]);
  const [ladderOpen, setLadderOpen] = useState(false);
  const [ladderTarget, setLadderTarget] = useState<string>("");
  const [ladderStart, setLadderStart] = useState("1");
  const [ladderStep, setLadderStep] = useState("1");
  const [ladderMax, setLadderMax] = useState("8");

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

  function addExercises(ids: string[], agrupar = false) {
    const newOnes = newRoutineExercises(
      ids.filter((id) => !draft.some((de) => de.exerciseId === id)),
      agrupar,
    );
    onDraftChange([...draft, ...newOnes]);
    // Si se agrupó, se salta al primero del bloque para verlo de una.
    if (newOnes[0] && (agrupar || !activeId)) setActiveId(newOnes[0].exerciseId);
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

  // Bloque agrupar (superserie): dos o más ejercicios comparten `grupo` — en
  // el entrenamiento en vivo se hacen serie por serie, uno tras otro sin
  // descanso entre ellos, y recién descansan al terminar la ronda.
  const groupPartners = active?.grupo ? draft.filter((ex) => ex.grupo === active.grupo && ex.exerciseId !== active.exerciseId) : [];

  function openGroupPicker() {
    setMoreMenuOpen(false);
    setGroupSelection(groupPartners.map((ex) => ex.exerciseId));
    setGroupPickerOpen(true);
  }

  function confirmGroup() {
    if (!active || groupSelection.length === 0) {
      setGroupPickerOpen(false);
      return;
    }
    const grupoId = active.grupo ?? crypto.randomUUID();
    const memberIds = new Set([active.exerciseId, ...groupSelection]);
    onDraftChange(draft.map((ex) => (memberIds.has(ex.exerciseId) ? { ...ex, grupo: grupoId } : ex)));
    setGroupPickerOpen(false);
  }

  function ungroupActive() {
    setMoreMenuOpen(false);
    if (!active?.grupo) return;
    const grupoId = active.grupo;
    // Si al sacar al activo queda un solo miembro en el grupo, tampoco tiene
    // sentido dejarlo "agrupado" con nadie — se limpia también.
    const remaining = draft.filter((ex) => ex.grupo === grupoId && ex.exerciseId !== active.exerciseId);
    const idsToClear = new Set([active.exerciseId, ...(remaining.length === 1 ? [remaining[0].exerciseId] : [])]);
    onDraftChange(draft.map((ex) => (idsToClear.has(ex.exerciseId) ? { ...ex, grupo: undefined } : ex)));
  }

  // Bloque agrupado: una "serie" del bloque es una RONDA = una serie de cada ejercicio. Todos los
  // miembros tienen siempre la misma cantidad de series (rondas).
  const blockMembers = active?.grupo ? draft.filter((ex) => ex.grupo === active.grupo) : [];
  const rounds = blockMembers[0]?.sets.length ?? 0;

  function resizeSets(sets: RoutineExercise["sets"], n: number): RoutineExercise["sets"] {
    if (n <= sets.length) return sets.slice(0, n);
    const last = sets[sets.length - 1] ?? { peso: 0, reps: 10, tipo: "normal" as const };
    return [...sets, ...Array.from({ length: n - sets.length }, () => ({ ...last }))];
  }

  function setBlockRounds(n: number) {
    if (!active?.grupo) return;
    const clamped = Math.max(1, Math.min(30, n));
    onDraftChange(draft.map((ex) => (ex.grupo === active.grupo ? { ...ex, sets: resizeSets(ex.sets, clamped) } : ex)));
  }

  function openLadder() {
    setLadderTarget(active?.exerciseId ?? "");
    setLadderOpen(true);
  }

  // Escalera: las reps de un ejercicio del bloque suben ronda a ronda, p. ej. sentadillas 1, 2, ..., 8
  // mientras las zancadas se quedan en 2. Las rondas salen de inicio/sube/tope y se aplican a todo el bloque.
  function applyLadder() {
    const start = Math.max(1, parseInt(ladderStart, 10) || 1);
    const step = Math.max(1, parseInt(ladderStep, 10) || 1);
    const max = Math.max(start, parseInt(ladderMax, 10) || start);
    const n = Math.min(30, Math.floor((max - start) / step) + 1);
    onDraftChange(
      draft.map((ex) => {
        if (!active?.grupo || ex.grupo !== active.grupo) return ex;
        const sets = resizeSets(ex.sets, n);
        if (ex.exerciseId !== ladderTarget) return { ...ex, sets };
        return { ...ex, sets: sets.map((s, k) => ({ ...s, reps: start + step * k })) };
      }),
    );
    setLadderOpen(false);
  }

  function handleSetChecked() {
    setPlanRestEndsAt(Date.now() + (active?.restSeconds ?? 90) * 1000);
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
          return (
            <ReorderableExerciseCircle
              key={ex.exerciseId}
              value={ex}
              imagen={exData?.imagen}
              nombre={exData?.nombre}
              isActive={ex.exerciseId === active?.exerciseId}
              onSelect={() => selectExercise(ex.exerciseId)}
            />
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
            <div className="flex items-center justify-center w-full aspect-video rounded-2xl bg-white/[0.05] glass-specular-ring overflow-hidden">
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

          {blockMembers.length > 1 && (
            <div className="flex flex-col gap-2.5 rounded-2xl p-3.5 bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                  <Link2 size={13} style={{ color: "var(--gym-2)" }} /> Bloque agrupado
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/45">Rondas</span>
                  <button
                    onClick={() => setBlockRounds(rounds - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.07] text-white/70 cursor-pointer"
                    aria-label="Menos rondas"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{rounds}</span>
                  <button
                    onClick={() => setBlockRounds(rounds + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.07] text-white/70 cursor-pointer"
                    aria-label="Más rondas"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {blockMembers.map((ex, k) => {
                  const exData = allExercises.find((e) => e.id === ex.exerciseId);
                  const isActive = ex.exerciseId === active?.exerciseId;
                  return (
                    <button
                      key={ex.exerciseId}
                      onClick={() => selectExercise(ex.exerciseId)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left cursor-pointer transition-colors"
                      style={{ background: isActive ? "rgba(255,255,255,0.1)" : "transparent" }}
                    >
                      <span className="text-[11px] text-white/40 w-4">{k + 1}.</span>
                      <span className="flex-1 text-sm text-white/85 truncate">{exData?.nombre ?? "?"}</span>
                      <span className="text-[10px] text-white/40 tabular-nums">
                        {ex.soloReps ? "solo reps · " : ""}
                        {ex.sets.map((s) => s.reps).join("-")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={openLadder}
                className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white/80 bg-white/[0.07] hover:bg-white/[0.12] transition-colors cursor-pointer"
              >
                <ListOrdered size={14} /> Escalera de reps
              </button>
              <p className="text-[11px] text-white/35">
                Una serie del bloque = una ronda (una serie de cada ejercicio, en este orden). El descanso va al terminar la ronda.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 relative">
            {groupPartners.length > 0 ? (
              <p className="text-xs text-white/50 flex items-center gap-1.5">
                <Link2 size={13} style={{ color: "var(--gym-2)" }} />
                Agrupado con: {groupPartners.map((ex) => allExercises.find((e) => e.id === ex.exerciseId)?.nombre ?? "?").join(", ")}
              </p>
            ) : (
              <span />
            )}
            <button
              onClick={() => setMoreMenuOpen((o) => !o)}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-white/50 hover:text-white cursor-pointer shrink-0"
              style={{ background: "rgba(255,255,255,0.05)" }}
              title="Más opciones"
              aria-label="Más opciones"
            >
              <MoreVertical size={15} />
            </button>
            {moreMenuOpen && (
              <div
                className="absolute top-10 right-0 z-20 w-52 rounded-2xl glass-surface p-1.5 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={openGroupPicker}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85"
                >
                  <Link2 size={15} /> {groupPartners.length > 0 ? "Editar agrupación" : "Agrupar"}
                </button>
                {groupPartners.length > 0 && (
                  <button
                    onClick={ungroupActive}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10 text-white/85"
                  >
                    <Link2Off size={15} /> Desagrupar
                  </button>
                )}
              </div>
            )}
          </div>

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
          onConfirmGroup={(exs) => {
            addExercises(exs.map((e) => e.id), true);
            setAddPickerOpen(false);
          }}
        />
      </GlassModal>

      <GlassModal open={ladderOpen} onClose={() => setLadderOpen(false)} title="Escalera de reps">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-white/50">
            Las reps del ejercicio elegido suben ronda a ronda. Ej.: inicio 1, sube 1, tope 8 da 8 rondas con 1, 2, 3 ... 8
            reps. Los demás ejercicios del bloque conservan sus reps y se ajustan a la misma cantidad de rondas.
          </p>
          <div className="flex flex-col gap-1.5">
            {blockMembers.map((ex) => {
              const exData = allExercises.find((e) => e.id === ex.exerciseId);
              const isSel = ladderTarget === ex.exerciseId;
              return (
                <button
                  key={ex.exerciseId}
                  onClick={() => setLadderTarget(ex.exerciseId)}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer"
                  style={{ background: isSel ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)" }}
                >
                  <span className="flex-1 text-sm font-medium text-white/85 truncate">{exData?.nombre ?? "?"}</span>
                  {isSel && <Check size={16} />}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Inicio", v: ladderStart, set: setLadderStart },
              { label: "Sube", v: ladderStep, set: setLadderStep },
              { label: "Tope", v: ladderMax, set: setLadderMax },
            ].map((f) => (
              <label key={f.label} className="flex flex-col gap-1">
                <span className="text-[11px] text-white/50">{f.label}</span>
                <GlassInput type="number" inputMode="numeric" value={f.v} onChange={(e) => f.set(e.target.value)} />
              </label>
            ))}
          </div>
          <button
            onClick={applyLadder}
            className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer bg-white/[0.1] hover:bg-white/[0.16] transition-colors"
          >
            Aplicar escalera
          </button>
        </div>
      </GlassModal>

      <GlassModal open={replacePickerOpen} onClose={() => setReplacePickerOpen(false)} title="Reemplazar ejercicio">
        <ExercisePicker onSelect={(ex) => replaceActive(ex.id)} />
      </GlassModal>

      <GlassModal open={groupPickerOpen} onClose={() => setGroupPickerOpen(false)} title="Agrupar ejercicios">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-white/50">
            Elige con cuáles de este día hará superserie {activeExercise?.nombre} — se hacen uno tras otro, serie por
            serie, sin descanso entre ellos hasta terminar la ronda.
          </p>
          <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto">
            {draft
              .filter((ex) => ex.exerciseId !== active?.exerciseId)
              .map((ex) => {
                const exData = allExercises.find((e) => e.id === ex.exerciseId);
                const isSelected = groupSelection.includes(ex.exerciseId);
                return (
                  <button
                    key={ex.exerciseId}
                    onClick={() =>
                      setGroupSelection((sel) =>
                        sel.includes(ex.exerciseId) ? sel.filter((id) => id !== ex.exerciseId) : [...sel, ex.exerciseId],
                      )
                    }
                    className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors cursor-pointer"
                    style={{ background: isSelected ? "var(--gym-2)22" : "rgba(255,255,255,0.05)" }}
                  >
                    <span className="flex-1 text-sm font-medium text-white/85 truncate">{exData?.nombre ?? "?"}</span>
                    {isSelected && <Check size={16} style={{ color: "var(--gym-2)" }} />}
                  </button>
                );
              })}
            {draft.length <= 1 && <p className="text-sm text-white/40 py-4 text-center">Agrega otro ejercicio a este día primero.</p>}
          </div>
          <button
            onClick={confirmGroup}
            disabled={groupSelection.length === 0}
            className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer disabled:cursor-not-allowed transition-[box-shadow,background-color] duration-300"
            style={{
              background: groupSelection.length > 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
              boxShadow:
                groupSelection.length > 0
                  ? "0 0 22px 1px rgba(255,255,255,0.35), 0 10px 24px rgba(0,0,0,0.35)"
                  : "0 0 14px 1px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.35)",
            }}
          >
            Agrupar {groupSelection.length > 0 ? `(${groupSelection.length + 1})` : ""}
          </button>
        </div>
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
