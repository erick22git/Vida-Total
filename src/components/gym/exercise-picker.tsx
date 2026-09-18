"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Plus, Info, Check } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { ExerciseCard } from "@/components/gym/exercise-card";
import { FilterModal } from "@/components/gym/filter-modal";
import { CreateExerciseModal } from "@/components/gym/create-exercise-modal";
import { MUSCLE_FILTER_OPTIONS, MUSCLE_GROUP_COMPOSITES, EQUIPMENT_LIST } from "@/lib/data/gym-meta";
import exercisesData from "@/lib/data/exercises.json";
import type { Exercise } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";

const exercises = exercisesData as Exercise[];

export function useAllExercises(): Exercise[] {
  const custom = useGymStore((s) => s.customExercises);
  return useMemo(() => [...exercises, ...custom], [custom]);
}

export function ExercisePicker({
  onSelect,
  onConfirmSelection,
  multiple = false,
  activeExerciseId,
  onInfo,
  confirmButtonClassName,
}: {
  /** single-select mode: fired immediately on tap */
  onSelect?: (exercise: Exercise) => void;
  /** multi-select mode: fired when the user taps "Agregar N ejercicio(s)" */
  onConfirmSelection?: (exercises: Exercise[]) => void;
  multiple?: boolean;
  activeExerciseId?: string;
  onInfo?: (exercise: Exercise) => void;
  /** Clases extra para el wrapper `sticky` del botón de confirmar (p.ej.
   * "z-30" cuando este picker se usa inline en una página, para quedar
   * por encima de otro contenido con z-index propio). El BottomNav móvil
   * ya no necesita clearance extra aquí: es `pointer-events-none` salvo
   * por la burbuja en sí, que además vive semi-oculta contra el borde
   * izquierdo (ver bottom-nav.tsx) — nunca tapa ni bloquea este botón. */
  confirmButtonClassName?: string;
}) {
  const allExercises = useAllExercises();
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
  const [equipFilter, setEquipFilter] = useState<string[]>([]);
  const [muscleModalOpen, setMuscleModalOpen] = useState(false);
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return allExercises.filter((ex) => {
      const matchesMuscle =
        muscleFilter.length === 0 ||
        muscleFilter.some((f) => (MUSCLE_GROUP_COMPOSITES[f] ?? [f]).includes(ex.categoria));
      const matchesEquip = equipFilter.length === 0 || equipFilter.includes(ex.equipo);
      const matchesQuery = ex.nombre.toLowerCase().includes(query.trim().toLowerCase());
      return matchesMuscle && matchesEquip && matchesQuery;
    });
  }, [allExercises, muscleFilter, equipFilter, query]);

  function handleCardClick(ex: Exercise) {
    // Bloque 14: feedback háptico breve al asignar/agregar un ejercicio —
    // no todos los navegadores/dispositivos soportan Vibration API, de ahí
    // el optional chaining.
    navigator.vibrate?.(15);
    if (multiple) {
      setSelected((s) => (s.includes(ex.id) ? s.filter((id) => id !== ex.id) : [...s, ex.id]));
    } else {
      onSelect?.(ex);
    }
  }

  function toggle(list: string[], setList: (v: string[]) => void, value: string | null) {
    if (value === null) {
      setList([]);
      return;
    }
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassInput
        icon={<Search size={16} />}
        placeholder="Buscar ejercicio..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2">
        <FilterButton
          label="Músculos"
          count={muscleFilter.length}
          onClick={() => setMuscleModalOpen(true)}
        />
        <FilterButton
          label="Equipamiento"
          count={equipFilter.length}
          onClick={() => setEquipModalOpen(true)}
        />
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-1 ${multiple ? "max-h-[48vh]" : "max-h-[55vh]"}`}>
        {filtered.map((ex) => {
          const isSelectedForAdd = multiple && selected.includes(ex.id);
          return (
          <div key={ex.id} className="relative">
            <ExerciseCard
              exercise={ex}
              active={multiple ? isSelectedForAdd : ex.id === activeExerciseId}
              activeColor={multiple ? "rgba(255,255,255,0.9)" : undefined}
              onClick={() => handleCardClick(ex)}
            />
            {isSelectedForAdd && (
              <span
                className="absolute top-2 left-2 flex items-center justify-center w-5 h-5 rounded-full text-black"
                style={{ background: "white", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }}
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            {onInfo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInfo(ex);
                }}
                className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-black/50 backdrop-blur-md text-white/80 cursor-pointer"
              >
                <Info size={12} />
              </button>
            )}
          </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-white/40 text-center py-8">
            No se encontraron ejercicios.
          </p>
        )}
      </div>

      <button
        onClick={() => setCreateOpen(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm font-medium text-white/60 hover:text-white/85 hover:border-white/30 transition-colors cursor-pointer"
      >
        <Plus size={15} /> Crear Ejercicio
      </button>

      {multiple && (
        <div className={cn("sticky bottom-0 pt-1", confirmButtonClassName)}>
          {/* Transparente siempre — filtro negro suave mientras no elegiste
          ningún ejercicio (deshabilitado), cambia una sola vez a un brillo
          blanco suave apenas seleccionás el primero. Sin flash repetido:
          antes destellaba en cada toque y terminaba pareciendo que
          parpadeaba. */}
          <button
            onClick={() => {
              const chosen = allExercises.filter((e) => selected.includes(e.id));
              onConfirmSelection?.(chosen);
              setSelected([]);
            }}
            disabled={selected.length === 0}
            className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer disabled:cursor-not-allowed transition-[box-shadow,background-color] duration-300"
            style={{
              background: selected.length > 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
              boxShadow:
                selected.length > 0
                  ? "0 0 22px 1px rgba(255,255,255,0.35), 0 10px 24px rgba(0,0,0,0.35)"
                  : "0 0 14px 1px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.35)",
            }}
          >
            Agregar {selected.length} ejercicio{selected.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      <FilterModal
        open={muscleModalOpen}
        onClose={() => setMuscleModalOpen(false)}
        title="Filtrar por músculo"
        allLabel="Todos los músculos"
        options={MUSCLE_FILTER_OPTIONS}
        selected={muscleFilter}
        onToggle={(v) => toggle(muscleFilter, setMuscleFilter, v)}
        accentColor="var(--gym)"
      />
      <FilterModal
        open={equipModalOpen}
        onClose={() => setEquipModalOpen(false)}
        title="Filtrar por equipamiento"
        allLabel="Todo el equipamiento"
        options={EQUIPMENT_LIST.map((eq) => ({ value: eq, label: eq, icon: "Dumbbell" }))}
        selected={equipFilter}
        onToggle={(v) => toggle(equipFilter, setEquipFilter, v)}
        accentColor="var(--gym-2)"
      />
      <CreateExerciseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(ex) => {
          if (multiple) setSelected((s) => [...s, ex.id]);
          else onSelect?.(ex);
        }}
      />
    </div>
  );
}

function FilterButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-xs md:text-sm font-medium border cursor-pointer transition-colors"
      style={{
        background: count > 0 ? "var(--gym)22" : "rgba(255,255,255,0.05)",
        borderColor: count > 0 ? "var(--gym)" : "rgba(255,255,255,0.12)",
        color: count > 0 ? "white" : "rgba(255,255,255,0.65)",
      }}
    >
      <SlidersHorizontal size={13} />
      {label}
      {count > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{count}</span>}
    </button>
  );
}

export { exercises };
