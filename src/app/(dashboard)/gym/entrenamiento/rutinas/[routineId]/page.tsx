"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Dumbbell,
  Sparkles,
  Share2,
  MoreVertical,
  ArrowLeftRight,
  Play,
  Pencil,
  ListChecks,
  Trash2,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";
import { MUSCLE_COLOR } from "@/lib/data/gym-meta";
import { getMuscleDistribution } from "@/lib/gym-utils";

export default function RoutineDetailPage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = use(params);
  const router = useRouter();
  const allExercises = useAllExercises();
  const routines = useGymStore((s) => s.routines);
  const deleteRoutine = useGymStore((s) => s.deleteRoutine);
  const updateRoutine = useGymStore((s) => s.updateRoutine);
  const startWorkoutFromRoutine = useGymStore((s) => s.startWorkoutFromRoutine);

  const routine = routines.find((r) => r.id === routineId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(routine?.nombre ?? "");
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);

  function replaceExerciseInRoutine(oldId: string, newId: string) {
    if (!routine || oldId === newId) {
      setReplacingExerciseId(null);
      return;
    }
    updateRoutine(routine.id, {
      ejercicios: routine.ejercicios.map((rex) =>
        rex.exerciseId === oldId ? { ...rex, exerciseId: newId } : rex,
      ),
    });
    setReplacingExerciseId(null);
  }

  const distribution = useMemo(() => {
    if (!routine) return [];
    return getMuscleDistribution(routine.ejercicios, allExercises);
  }, [routine, allExercises]);

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

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{routine.nombre}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <button
            title="Adaptar con IA"
            aria-label="Adaptar con IA"
            className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer shrink-0"
            style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", boxShadow: "0 0 16px #a855f755" }}
          >
            <Sparkles size={16} className="text-white" />
          </button>
          <button className="text-white/50 hover:text-white p-1.5 cursor-pointer">
            <Share2 size={18} />
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} className="text-white/50 hover:text-white p-1.5 cursor-pointer">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute top-10 right-0 z-20 w-52 rounded-2xl glass-surface p-1.5 flex flex-col">
              <MenuItem icon={Pencil} label="Cambiar nombre" onClick={() => { setMenuOpen(false); setRenameOpen(true); }} />
              <MenuItem
                icon={ListChecks}
                label="Editar rutina"
                onClick={() => { setMenuOpen(false); router.push(`/gym/entrenamiento/rutinas/${routine.id}/editar`); }}
              />
              <MenuItem
                icon={Trash2}
                label="Eliminar rutina"
                danger
                onClick={() => { setMenuOpen(false); deleteRoutine(routine.id); router.push("/gym/entrenamiento"); }}
              />
            </div>
          )}
        </div>
      </header>

      {distribution.length > 0 && (
        <GlassCard accentColor="var(--gym)" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-white/80">Distribución Muscular</p>
          <div className="flex flex-wrap gap-2">
            {distribution.map((d) => {
              const color = MUSCLE_COLOR[d.categoria] ?? "var(--gym)";
              return (
                <span
                  key={d.categoria}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ background: `${color}1f`, border: `1px solid ${color}55`, color }}
                >
                  <Dumbbell size={12} /> {d.categoria} · {d.pct}%
                </span>
              );
            })}
          </div>
        </GlassCard>
      )}

      <div className="flex flex-col gap-2.5">
        {routine.ejercicios.map((rex) => {
          const ex = allExercises.find((e) => e.id === rex.exerciseId);
          if (!ex) return null;
          const repsRange = rex.sets.map((s) => s.reps).join("/");
          return (
            <GlassCard
              key={rex.exerciseId}
              padding="sm"
              onClick={() => router.push(`/gym/entrenamiento/${ex.id}`)}
              className="flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.06] glass-specular-ring flex items-center justify-center shrink-0">
                {ex.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ex.imagen} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Dumbbell size={18} className="text-white/30" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{ex.nombre}</p>
                <p className="text-xs text-white/45">
                  {rex.sets.length} series x {repsRange} reps
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReplacingExerciseId(ex.id);
                }}
                className="text-white/40 hover:text-white shrink-0 p-1.5 cursor-pointer"
                title="Sustituir ejercicio"
                aria-label="Sustituir ejercicio"
              >
                <ArrowLeftRight size={16} />
              </button>
            </GlassCard>
          );
        })}
      </div>

      <GlassButton
        accentColor="var(--gym-2)"
        size="lg"
        className="w-full"
        onClick={() => {
          startWorkoutFromRoutine(routine);
          router.push("/gym/entrenamiento/activo");
        }}
      >
        <Play size={18} /> Empezar Entrenamiento
      </GlassButton>

      <GlassModal open={renameOpen} onClose={() => setRenameOpen(false)} title="Cambiar nombre">
        <div className="flex flex-col gap-4">
          <GlassInput value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <GlassButton
            accentColor="var(--gym-2)"
            size="lg"
            onClick={() => {
              if (newName.trim()) updateRoutine(routine.id, { nombre: newName.trim() });
              setRenameOpen(false);
            }}
          >
            Guardar
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal
        open={replacingExerciseId !== null}
        onClose={() => setReplacingExerciseId(null)}
        title="Sustituir ejercicio"
      >
        <ExercisePicker
          onSelect={(ex) => {
            if (replacingExerciseId) replaceExerciseInRoutine(replacingExerciseId, ex.id);
          }}
        />
      </GlassModal>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-white/10"
      style={{ color: danger ? "#f87171" : "rgba(255,255,255,0.85)" }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
