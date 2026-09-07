"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RoutineSetPlan, SetType } from "@/lib/types";
import { SET_TYPE_META } from "@/components/gym/set-type";
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { useGymStore } from "@/lib/store/gymStore";

export function RoutineSetTable({
  sets,
  soloReps,
  onChange,
  exerciseId,
}: {
  sets: RoutineSetPlan[];
  soloReps?: boolean;
  onChange: (sets: RoutineSetPlan[]) => void;
  /** when provided, shows a "previa" hint column with the last logged values */
  exerciseId?: string;
}) {
  const [typeModalIndex, setTypeModalIndex] = useState<number | null>(null);
  const sessions = useGymStore((s) => s.sessions);
  const lastLog = exerciseId
    ? sessions.find((sess) => sess.ejercicios.some((e) => e.exerciseId === exerciseId))
        ?.ejercicios.find((e) => e.exerciseId === exerciseId)
    : undefined;

  function updateSet(i: number, patch: Partial<RoutineSetPlan>) {
    onChange(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSet(i: number) {
    onChange(sets.filter((_, idx) => idx !== i));
  }

  function addSet() {
    const last = sets[sets.length - 1];
    onChange([...sets, { peso: last?.peso ?? 0, reps: last?.reps ?? 10, tipo: "normal" }]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[auto_auto_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold text-white/40 uppercase tracking-wide">
        <span className="w-8">Serie</span>
        <span className="w-12">Previa</span>
        <span>{soloReps ? "" : "Kg"}</span>
        <span>Reps</span>
        <span className="w-7" />
      </div>
      {sets.map((s, i) => {
        const meta = SET_TYPE_META[s.tipo];
        const prevSet = lastLog?.sets[i];
        const previaLabel = prevSet
          ? soloReps
            ? `${prevSet.reps}`
            : `${prevSet.peso}x${prevSet.reps}`
          : "-";
        return (
          <div
            key={i}
            className="grid grid-cols-[auto_auto_1fr_1fr_auto] gap-2 items-center rounded-xl bg-white/[0.04] border border-white/[0.08] px-2 py-2"
          >
            <button
              onClick={() => setTypeModalIndex(i)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              style={{ background: `${meta.color}26`, color: meta.color, border: `1px solid ${meta.color}55` }}
            >
              {s.tipo === "normal" ? i + 1 : meta.short}
            </button>
            <span className="w-12 text-center text-[11px] text-white/35 tabular-nums">{previaLabel}</span>
            {!soloReps && (
              <input
                type="number"
                value={s.peso || ""}
                placeholder="0"
                onChange={(e) => updateSet(i, { peso: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 py-1.5 text-sm text-white text-center outline-none"
              />
            )}
            <input
              type="number"
              value={s.reps || ""}
              placeholder="0"
              onChange={(e) => updateSet(i, { reps: parseInt(e.target.value) || 0 })}
              className={`w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 py-1.5 text-sm text-white text-center outline-none ${soloReps ? "col-span-2" : ""}`}
            />
            <button
              onClick={() => removeSet(i)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-white/30 hover:text-red-400 cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
            {typeModalIndex === i && (
              <SetTypeModal
                open
                onClose={() => setTypeModalIndex(null)}
                value={s.tipo}
                onSelect={(tipo) => updateSet(i, { tipo })}
              />
            )}
          </div>
        );
      })}
      <button
        onClick={addSet}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2 text-xs font-medium text-white/55 hover:text-white/85 hover:border-white/30 transition-colors cursor-pointer mt-1"
      >
        <Plus size={13} /> Añadir serie
      </button>
    </div>
  );
}

export type { SetType };
