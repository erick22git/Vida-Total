"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { WorkoutSet } from "@/lib/types";
import { SET_TYPE_META } from "@/components/gym/set-type";
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { NumericKeypad } from "@/components/gym/numeric-keypad";
import { DropsetWeightsModal } from "@/components/gym/dropset-weights-modal";

export function SessionSetRow({
  index,
  set,
  soloReps,
  onChange,
}: {
  index: number;
  set: WorkoutSet;
  soloReps?: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
}) {
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [kgKeypadOpen, setKgKeypadOpen] = useState(false);
  const [repsKeypadOpen, setRepsKeypadOpen] = useState(false);
  const [dropsetModalOpen, setDropsetModalOpen] = useState(false);
  const meta = SET_TYPE_META[set.tipo ?? "normal"];
  const isDropset = set.tipo === "descendente";

  return (
    <div
      className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center rounded-2xl px-2.5 py-2.5 transition-colors"
      style={{
        background: set.completado ? "#3b82f61f" : "rgba(255,255,255,0.04)",
        border: `1px solid ${set.completado ? "#3b82f666" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <button
        onClick={() => setTypeModalOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
        style={{ background: `${meta.color}26`, color: meta.color, border: `1px solid ${meta.color}55` }}
      >
        {(set.tipo ?? "normal") === "normal" ? index + 1 : meta.short}
      </button>

      {!soloReps ? (
        isDropset ? (
          <button
            onClick={() => setDropsetModalOpen(true)}
            className="rounded-lg bg-white/[0.05] glass-specular-ring py-1.5 text-[11px] font-semibold text-white text-center cursor-pointer truncate px-1"
            title="Pesos de cada bajada del dropset"
          >
            {set.pesosDescendentes && set.pesosDescendentes.length > 0
              ? set.pesosDescendentes.join(" · ")
              : "Configurar"}
          </button>
        ) : (
          <button
            onClick={() => setKgKeypadOpen(true)}
            className="rounded-lg bg-white/[0.05] glass-specular-ring py-1.5 text-sm font-semibold text-white text-center cursor-pointer"
          >
            {set.peso || 0}
          </button>
        )
      ) : (
        <span className="text-center text-xs text-white/25">—</span>
      )}

      <button
        onClick={() => setRepsKeypadOpen(true)}
        className="rounded-lg bg-white/[0.05] glass-specular-ring py-1.5 text-sm font-semibold text-white text-center cursor-pointer"
      >
        {set.reps || 0}
      </button>

      <button className="flex items-center justify-center text-white/25 cursor-pointer" title="Sugerencia IA">
        <Sparkles size={14} />
      </button>

      <button
        onClick={() => onChange({ completado: !set.completado })}
        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors cursor-pointer"
        style={{
          background: set.completado ? "#3b82f6" : "rgba(255,255,255,0.06)",
          border: `1px solid ${set.completado ? "#3b82f6" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <Check size={16} className={set.completado ? "text-white" : "text-white/30"} />
      </button>

      <SetTypeModal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        value={set.tipo ?? "normal"}
        onSelect={(tipo) => onChange({ tipo })}
      />
      <DropsetWeightsModal
        open={dropsetModalOpen}
        onClose={() => setDropsetModalOpen(false)}
        initialWeights={set.pesosDescendentes ?? []}
        onSave={(weights) => onChange({ pesosDescendentes: weights, peso: weights[0] ?? 0 })}
      />
      <NumericKeypad
        open={kgKeypadOpen}
        onClose={() => setKgKeypadOpen(false)}
        label={`Serie ${index + 1} · Peso (kg)`}
        initialValue={set.peso}
        step={2.5}
        accentColor="var(--gym)"
        banner="Registra el peso total incluyendo la barra."
        onNext={(v) => onChange({ peso: v })}
      />
      <NumericKeypad
        open={repsKeypadOpen}
        onClose={() => setRepsKeypadOpen(false)}
        label={`Serie ${index + 1} · Repeticiones`}
        initialValue={set.reps}
        step={1}
        accentColor="var(--gym-2)"
        banner="Registra el total de repeticiones hechas."
        onNext={(v) => onChange({ reps: v })}
      />
    </div>
  );
}
