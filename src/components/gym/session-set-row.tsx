"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { WorkoutSet } from "@/lib/types";
import { SET_TYPE_META } from "@/components/gym/set-type";
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { NumericKeypad } from "@/components/gym/numeric-keypad";
import { DropsetWeightsModal } from "@/components/gym/dropset-weights-modal";

function formatSeconds(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.round(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SessionSetRow({
  index,
  normalNumber,
  set,
  soloReps,
  onChange,
  previa,
  restSeconds,
}: {
  index: number;
  /** Número de serie a mostrar cuando `tipo === "normal"` — cuenta solo las
   * series normales, ignorando las de calentamiento (que muestran "C" en
   * vez de un número). `undefined` cuando esta fila no es una serie normal. */
  normalNumber?: number;
  set: WorkoutSet;
  soloReps?: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  /** Con cuánto peso x reps hiciste esta MISMA serie (por posición) la
   * última vez que entrenaste este ejercicio — "-" si no hay historial. */
  previa?: string;
  /** Descanso configurado para el ejercicio (segundos) — se compara contra
   * `set.descansoTomado` para mostrar si se cumplió o no. */
  restSeconds?: number;
}) {
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [kgKeypadOpen, setKgKeypadOpen] = useState(false);
  const [repsKeypadOpen, setRepsKeypadOpen] = useState(false);
  const [dropsetModalOpen, setDropsetModalOpen] = useState(false);
  const meta = SET_TYPE_META[set.tipo ?? "normal"];
  const isDropset = set.tipo === "descendente";
  const cumplioDescanso =
    set.descansoTomado !== undefined && restSeconds !== undefined
      ? set.descansoTomado >= restSeconds
      : undefined;

  return (
    <div
      className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto] gap-2 items-center rounded-2xl px-2.5 py-2.5 transition-colors"
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
        {(set.tipo ?? "normal") === "normal" ? (normalNumber ?? index + 1) : meta.short}
      </button>

      <span className="w-12 text-center text-[11px] text-white/35 tabular-nums">{previa ?? "-"}</span>

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

      {/* Reemplaza el antiguo botón "IA" (placeholder sin acción): acá se
      registra si el descanso tomado antes de esta serie cumplió, no cumplió,
      o superó el tiempo configurado. Vacío en la primera serie del ejercicio
      (no hay descanso previo que medir). */}
      <span
        className="flex items-center justify-center text-[10px] font-semibold tabular-nums"
        title={
          cumplioDescanso === undefined
            ? undefined
            : `Descansaste ${formatSeconds(set.descansoTomado!)} de ${formatSeconds(restSeconds!)} configurados`
        }
        style={{ color: cumplioDescanso === undefined ? "rgba(255,255,255,0.2)" : cumplioDescanso ? "#4ade80" : "#f59e0b" }}
      >
        {cumplioDescanso === undefined ? "-" : formatSeconds(set.descansoTomado!)}
      </span>

      <button
        onClick={() => onChange({ completado: !set.completado })}
        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-90"
        style={{
          background: set.completado ? "#3b82f6" : "rgba(255,255,255,0.06)",
          border: `1px solid ${set.completado ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
          boxShadow: set.completado ? "0 2px 8px rgba(59,130,246,0.45)" : "0 1px 3px rgba(0,0,0,0.3)",
        }}
      >
        <Check size={16} className={set.completado ? "text-white" : "text-white/30"} />
      </button>

      <SetTypeModal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        value={set.tipo ?? "normal"}
        onSelect={(tipo) => {
          onChange({ tipo });
          if (tipo === "descendente") setDropsetModalOpen(true);
        }}
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
