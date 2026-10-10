"use client";

import { useEffect, useRef, useState } from "react";
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
  Hash,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { GlassInput } from "@/components/glass/glass-input";
import { SessionSetRow } from "@/components/gym/session-set-row";
import { SessionExerciseCarousel } from "@/components/gym/session-exercise-carousel";
import { RestBar } from "@/components/gym/rest-bar";
import { TransitionBar } from "@/components/gym/transition-bar";
import { RestDurationModal, formatRestDuration } from "@/components/gym/rest-duration-modal";
import { PillActionButton } from "@/components/gym/pill-action-button";
import { SessionTimer } from "@/components/gym/session-timer";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { blockRoundCount, initialDropsetPatch, nextAfterSet, previaLabelFor } from "@/lib/gym-utils";
import { unlockAudio } from "@/lib/sound/sound-engine";
import { RankIcon } from "@/components/gym/rank-icon";
import { useRankProfile } from "@/lib/gym/use-rank";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const activeSession = useGymStore((s) => s.activeSession);
  const { profile: rankProfile } = useRankProfile();
  const sessions = useGymStore((s) => s.sessions);
  const activeExerciseIndex = useGymStore((s) => s.activeExerciseIndex);
  const sessionStartedAt = useGymStore((s) => s.sessionStartedAt);
  const setActiveExerciseIndex = useGymStore((s) => s.setActiveExerciseIndex);
  const reorderActiveExercises = useGymStore((s) => s.reorderActiveExercises);
  const addSetToExercise = useGymStore((s) => s.addSetToExercise);
  const setExerciseSoloReps = useGymStore((s) => s.setExerciseSoloReps);
  const removeSet = useGymStore((s) => s.removeSet);
  const updateSet = useGymStore((s) => s.updateSet);
  const completeSet = useGymStore((s) => s.completeSet);
  const replaceExercise = useGymStore((s) => s.replaceExercise);
  const setExerciseNote = useGymStore((s) => s.setExerciseNote);
  const setExerciseRest = useGymStore((s) => s.setExerciseRest);
  const startRest = useGymStore((s) => s.startRest);
  const startTransition = useGymStore((s) => s.startTransition);
  const cancelWorkout = useGymStore((s) => s.cancelWorkout);
  const addExercisesToSession = useGymStore((s) => s.addExercisesToSession);
  const removeExerciseFromSession = useGymStore((s) => s.removeExerciseFromSession);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [restConfigOpen, setRestConfigOpen] = useState(false);
  const [dropsetTypeOpen, setDropsetTypeOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"remove" | "discard" | null>(null);
  const [aiComingSoonOpen, setAiComingSoonOpen] = useState(false);

  // Al completar la última serie pendiente de todo el entrenamiento, pasa solo a la pantalla de
  // confirmar/terminar — antes había que acordarse de tocar "Terminar" a mano. El ref evita que se
  // dispare de nuevo si el usuario vuelve atrás y destilda una serie (quedaría re-completo otra vez).
  const autoFinishedRef = useRef(false);
  useEffect(() => {
    if (!activeSession) return;
    const total = activeSession.ejercicios.reduce((sum, e) => sum + e.sets.filter((s) => s.tipo !== "calentamiento").length, 0);
    const done = activeSession.ejercicios.reduce((sum, e) => sum + e.sets.filter((s) => s.tipo !== "calentamiento" && s.completado).length, 0);
    if (total > 0 && done === total && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      const id = setTimeout(() => router.push("/gym/entrenamiento/activo/resumen"), 500);
      return () => clearTimeout(id);
    }
  }, [activeSession, router]);

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
  // Las series de calentamiento no cuentan como series de trabajo (ni en "x/y" ni en el avance).
  const workingSets = currentLog.sets.filter((s) => s.tipo !== "calentamiento");
  const completedSets = workingSets.filter((s) => s.completado).length;
  const groupPartners = currentLog.grupo
    ? activeSession.ejercicios.filter((ex) => ex.grupo === currentLog.grupo && ex.exerciseId !== currentLog.exerciseId)
    : [];
  const soloReps = currentLog.sets[0]?.soloReps;
  const restSeconds = currentLog.restSeconds ?? 90;
  // "Previa": con cuánto peso x reps hiciste cada serie la última vez que
  // entrenaste este ejercicio (sessions viene ordenado del más reciente al
  // más viejo, así que el primer match ya es el último entrenamiento).
  const lastLogOf = (exerciseId: string) =>
    sessions.find((sess) => sess.ejercicios.some((e) => e.exerciseId === exerciseId))?.ejercicios.find(
      (e) => e.exerciseId === exerciseId,
    );
  const lastLog = lastLogOf(currentLog.exerciseId);

  const totalSetsAll = activeSession.ejercicios.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.tipo !== "calentamiento").length,
    0,
  );
  const doneSetsAll = activeSession.ejercicios.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.tipo !== "calentamiento" && s.completado).length,
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

  // Bloque agrupado: una "serie" del bloque es una ronda, con una serie de cada ejercicio (en orden).
  const blockMembers = currentLog.grupo
    ? ejercicios.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.grupo === currentLog.grupo)
    : [];
  const isBlock = blockMembers.length > 1;
  const pendingRounds = blockMembers.map(({ ex }) => ex.sets.findIndex((s) => !s.completado)).filter((r) => r >= 0);
  const roundIdx = pendingRounds.length > 0 ? Math.min(...pendingRounds) : -1;
  const maxRounds = blockRoundCount(blockMembers.map(({ ex }) => ex));
  const isCompound = blockMembers.some(({ ex }) => ex.serieUnica);
  const visibleRounds = roundIdx === -1 ? maxRounds : roundIdx + 1;

  function handleSetChange(logIndex: number, setId: string, patch: Parameters<typeof updateSet>[2]) {
    const log = ejercicios[logIndex];
    if (!patch.completado) {
      updateSet(log.exerciseId, setId, patch);
      return;
    }
    // El tilde es un gesto del usuario: habilita el audio para el aviso de fin de descanso.
    unlockAudio();
    completeSet(log.exerciseId, setId, patch);

    const setIndex = log.sets.findIndex((s) => s.id === setId);
    // Superserie / serie compuesta: ejercicios con el mismo `grupo` se hacen uno tras otro. Sin `grupo`, el
    // "grupo" es solo este ejercicio (comportamiento de siempre). La lógica del orden vive en `nextAfterSet`.
    const groupMembers = log.grupo
      ? ejercicios.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.grupo === log.grupo)
      : [{ ex: log, i: logIndex }];
    const serieUnica = groupMembers.some(({ ex }) => ex.serieUnica);
    const next = nextAfterSet(
      groupMembers.map(({ ex, i }) => ({ i, sets: ex.sets })),
      logIndex,
      setIndex,
      serieUnica,
    );

    if (next.kind === "partner") {
      // Al tocarle al siguiente ejercicio del bloque cambia la foto del hero.
      setTimeout(() => setActiveExerciseIndex(next.index), 300);
      return;
    }

    if (next.kind === "round") {
      // Con "toda la serie compuesta es 1 serie" no se descansa entre rondas.
      if (next.rest) startRest(log.exerciseId, log.restSeconds ?? 90);
      if (groupMembers.length > 1) setTimeout(() => setActiveExerciseIndex(next.index), 300);
      return;
    }

    // Bloque (o ejercicio suelto) terminado: recién acá se descansa y se pasa al que sigue.
    startRest(log.exerciseId, log.restSeconds ?? 90);
    const lastGroupIndex = Math.max(...groupMembers.map(({ i }) => i));
    if (lastGroupIndex < total - 1) {
      setTimeout(() => {
        setActiveExerciseIndex(lastGroupIndex + 1);
        startTransition();
      }, 500);
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
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              {exercise.nombre}
              {/* Tu rango en este ejercicio (sin rango = sin ícono) */}
              {rankProfile?.byExercise[exercise.id] && (
                <RankIcon
                  tierKey={rankProfile.byExercise[exercise.id].rank.tier.key}
                  level={rankProfile.byExercise[exercise.id].rank.level}
                  size={26}
                />
              )}
            </h2>
            <p className="text-xs text-white/45 mt-0.5">
              {isBlock && isCompound
                ? roundIdx === -1
                  ? `Serie compuesta completa (${maxRounds} rondas)`
                  : `Serie compuesta: ronda ${Math.min(roundIdx + 1, maxRounds)} de ${maxRounds}`
                : `${completedSets}/${workingSets.length} series completadas`}
              {currentLog.agregadoEnSesion && " · agregado en esta sesión"}
            </p>
            {groupPartners.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--gym-2)" }}>
                {isCompound ? "Serie compuesta con" : "Superserie con"}: {groupPartners.map((ex) => allExercises.find((e) => e.id === ex.exerciseId)?.nombre ?? "?").join(", ")}
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
        <PillActionButton
          icon={Hash}
          title={soloReps ? "Sin peso" : "Con peso"}
          active={!!soloReps}
          onClick={() => setExerciseSoloReps(currentLog.exerciseId, !soloReps)}
        />
        <PillActionButton icon={Repeat} title="Reemplazar" onClick={() => setPickerOpen(true)} />
        <PillActionButton icon={StickyNote} title="Notas" onClick={() => setNotesOpen(true)} active={!!currentLog.nota} />
        <PillActionButton icon={Clock} title="Descanso" badge={formatRestDuration(restSeconds)} onClick={() => setRestConfigOpen(true)} />
        <PillActionButton icon={Sparkles} title="IA" onClick={() => setAiComingSoonOpen(true)} />
        <PillActionButton
          icon={Trash2}
          title="Eliminar"
          danger
          onClick={() => setConfirmAction("remove")}
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
        {isBlock &&
          Array.from({ length: visibleRounds }, (_, r) => (
            <div key={r} className="flex flex-col gap-1.5">
              {blockMembers.map(({ ex, i: logIdx }) => {
                const set = ex.sets[r];
                if (!set) return null;
                const exData = allExercises.find((e) => e.id === ex.exerciseId);
                const memberLast = lastLogOf(ex.exerciseId);
                const memberSoloReps = ex.sets[0]?.soloReps;
                const normalNo = ex.sets.slice(0, r + 1).filter((s) => (s.tipo ?? "normal") === "normal").length;
                return (
                  <div key={ex.exerciseId} className="flex flex-col gap-1">
                    <button
                      onClick={() => setActiveExerciseIndex(logIdx)}
                      className="flex items-center gap-2 px-1 text-left cursor-pointer"
                    >
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: logIdx === activeExerciseIndex ? "white" : "rgba(255,255,255,0.55)" }}
                      >
                        {exData?.nombre ?? "Ejercicio"}
                      </span>
                    </button>
                    <SessionSetRow
                      index={r}
                      normalNumber={(set.tipo ?? "normal") === "normal" ? normalNo : undefined}
                      set={set}
                      soloReps={memberSoloReps}
                      previa={previaLabelFor(memberLast?.sets[r], memberSoloReps)}
                      pesoRef={(r > 0 ? ex.sets[r - 1].peso : 0) || memberLast?.sets[r]?.peso || undefined}
                      repsRef={(r > 0 ? ex.sets[r - 1].reps : 0) || memberLast?.sets[r]?.reps || undefined}
                      restSeconds={ex.restSeconds ?? 90}
                      onChange={(patch) => handleSetChange(logIdx, set.id, patch)}
                      onDelete={ex.sets.length > 1 ? () => removeSet(ex.exerciseId, set.id) : undefined}
                    />
                    <div className="h-px bg-white/10 mx-1 mt-0.5" />
                  </div>
                );
              })}
            </div>
          ))}
        {isBlock && roundIdx === -1 && (
          <button
            onClick={() => blockMembers.forEach(({ ex }) => addSetToExercise(ex.exerciseId))}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/30 transition-colors cursor-pointer"
          >
            <Plus size={15} /> Añadir ronda
          </button>
        )}
        {!isBlock && visibleSets.map((set, i) => (
          <SessionSetRow
            key={set.id}
            index={i}
            normalNumber={normalNumbers[i]}
            set={set}
            soloReps={soloReps}
            previa={previaLabelFor(lastLog?.sets[i], soloReps)}
            pesoRef={(i > 0 ? currentLog.sets[i - 1].peso : 0) || lastLog?.sets[i]?.peso || undefined}
            repsRef={(i > 0 ? currentLog.sets[i - 1].reps : 0) || lastLog?.sets[i]?.reps || undefined}
            restSeconds={restSeconds}
            onChange={(patch) => handleSetChange(activeExerciseIndex, set.id, patch)}
            onDelete={currentLog.sets.length > 1 ? () => removeSet(currentLog.exerciseId, set.id) : undefined}
          />
        ))}
        {!isBlock && visibleSetCount === currentLog.sets.length && (
          <button
            onClick={() => addSetToExercise(currentLog.exerciseId)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/30 transition-colors cursor-pointer"
          >
            <Plus size={15} /> Añadir serie
          </button>
        )}
      </div>

      <AnimatePresence>
        <TransitionBar key="transition-bar" />
        <RestBar key="rest-bar" />
      </AnimatePresence>

      <ExpandSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Cambiar ejercicio">
        <ExercisePicker
          activeExerciseId={currentLog.exerciseId}
          onSelect={(ex) => {
            replaceExercise(currentLog.exerciseId, ex.id);
            setPickerOpen(false);
          }}
        />
      </ExpandSheet>

      <ExpandSheet open={addPickerOpen} onClose={() => setAddPickerOpen(false)} title="Agregar ejercicios">
        <ExercisePicker
          multiple
          onConfirmSelection={(exs) => {
            addExercisesToSession(exs.map((e) => e.id));
            setAddPickerOpen(false);
          }}
          onConfirmGroup={(exs) => {
            addExercisesToSession(exs.map((e) => e.id), true);
            setAddPickerOpen(false);
          }}
        />
      </ExpandSheet>

      <SetTypeModal
        open={dropsetTypeOpen}
        onClose={() => setDropsetTypeOpen(false)}
        value={firstUncheckedSet?.tipo ?? "normal"}
        onSelect={(tipo) => {
          if (!firstUncheckedSet) return;
          // Dropset: ya no abre ningún modal — la bajada aparece debajo de la misma serie.
          updateSet(
            currentLog.exerciseId,
            firstUncheckedSet.id,
            tipo === "descendente" ? { tipo, ...initialDropsetPatch(firstUncheckedSet) } : { tipo },
          );
          setDropsetTypeOpen(false);
        }}
      />

      <ExpandSheet
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "discard" ? "Descartar entrenamiento" : "Sacar ejercicio de hoy"}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/65">
            {confirmAction === "discard"
              ? "Se pierde lo que anotaste en este entrenamiento. Esto no se puede deshacer."
              : `"${exercise?.nombre ?? "Este ejercicio"}" se saca solo del entrenamiento de hoy; tu rutina no cambia.`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmAction(null)}
              className="flex-1 rounded-full py-3 text-sm font-semibold text-white/80 bg-white/[0.08] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (confirmAction === "discard") {
                  cancelWorkout();
                  router.push("/gym/entrenamiento");
                } else {
                  removeExerciseFromSession(currentLog.exerciseId);
                }
                setConfirmAction(null);
              }}
              className="flex-1 rounded-full py-3 text-sm font-semibold text-white bg-red-500 cursor-pointer"
            >
              {confirmAction === "discard" ? "Descartar" : "Sacar"}
            </button>
          </div>
        </div>
      </ExpandSheet>

      <ExpandSheet open={aiComingSoonOpen} onClose={() => setAiComingSoonOpen(false)} title="Escáner de técnica IA">
        <p className="text-sm text-white/60">
          Estamos preparando el escáner de movimiento con la cámara para revisar tu técnica desde distintos
          ángulos. Todavía no está disponible — pronto vas a poder activarlo desde acá.
        </p>
      </ExpandSheet>

      <ExpandSheet open={notesOpen} onClose={() => setNotesOpen(false)} title="Nota del ejercicio">
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
      </ExpandSheet>

      <RestDurationModal
        open={restConfigOpen}
        onClose={() => setRestConfigOpen(false)}
        value={restSeconds}
        onConfirm={(sec) => setExerciseRest(currentLog.exerciseId, sec)}
      />

      <button
        onClick={() => setConfirmAction("discard")}
        className="text-center text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
      >
        Descartar entrenamiento
      </button>
    </div>
  );
}
