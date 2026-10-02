"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { WorkoutSet } from "@/lib/types";
import { SET_TYPE_META } from "@/components/gym/set-type";
import { SetTypeModal } from "@/components/gym/set-type-modal";
import { NumericKeypad } from "@/components/gym/numeric-keypad";
import { dropsOf, initialDropsetPatch, DROP_REPS_REF, refDropWeight } from "@/lib/gym-utils";

function formatSeconds(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.round(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

const PURPLE = "#a855f7";
const VALUE_CELL = "rounded-lg bg-white/[0.05] glass-specular-ring text-white text-center cursor-pointer";

/** Valor con "referencia": si todavía no hay un número propio se muestra atenuado lo que se va a
 * registrar al tildar; apenas se toca, el teclado abre vacío y reemplaza la referencia. */
function ValueText({ value, reference }: { value: number; reference?: number }) {
  if (value) return <>{value}</>;
  if (reference) return <span className="text-white/35">{reference}</span>;
  return <>0</>;
}

export function SessionSetRow({
  index,
  normalNumber,
  set,
  soloReps,
  onChange,
  previa,
  restSeconds,
  pesoRef,
  repsRef,
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
  /** Peso de referencia (misma serie la última vez, o la serie anterior de hoy): si `set.peso`
   * está en 0 se muestra atenuado y es el que se registra al tildar. */
  pesoRef?: number;
  /** Repeticiones de referencia, igual que `pesoRef`. */
  repsRef?: number;
}) {
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [kgKeypadOpen, setKgKeypadOpen] = useState(false);
  const [repsKeypadOpen, setRepsKeypadOpen] = useState(false);
  const meta = SET_TYPE_META[set.tipo ?? "normal"];
  const isDropset = set.tipo === "descendente";
  const cumplioDescanso =
    set.descansoTomado !== undefined && restSeconds !== undefined
      ? set.descansoTomado >= restSeconds
      : undefined;

  const pesoEf = set.peso || pesoRef || 0;
  const repsEf = set.reps || repsRef || 0;
  const drops = isDropset ? dropsOf(set) : [];

  // Pesos de referencia de cada bajada: cada una parte de la anterior (o del peso principal).
  const dropWeightRefs: number[] = [];
  drops.reduce((prev, d) => {
    const ref = refDropWeight(prev);
    dropWeightRefs.push(ref);
    return d.peso || ref;
  }, pesoEf);

  function writeDrops(next: { peso: number; reps: number }[], mainPeso = set.peso) {
    onChange({
      pesosDescendentes: [mainPeso, ...next.map((d) => d.peso)],
      repsDescendentes: next.map((d) => d.reps),
    });
  }

  function toggleComplete() {
    if (set.completado) {
      onChange({ completado: false });
      return;
    }
    // Al tildar se registra lo que se ve: lo escrito, o la referencia atenuada si no se tocó.
    const patch: Partial<WorkoutSet> = { completado: true, peso: soloReps ? set.peso : pesoEf, reps: repsEf };
    if (isDropset) {
      const committed = drops.map((d, k) => ({ peso: d.peso || dropWeightRefs[k] || 0, reps: d.reps || DROP_REPS_REF }));
      patch.pesosDescendentes = [patch.peso ?? 0, ...committed.map((d) => d.peso)];
      patch.repsDescendentes = committed.map((d) => d.reps);
    }
    onChange(patch);
  }

  return (
    <div className="flex flex-col gap-1">
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
          {(set.tipo ?? "normal") === "normal" || isDropset ? (normalNumber ?? index + 1) : meta.short}
        </button>

        <span className="w-12 text-center text-[11px] text-white/35 tabular-nums">{previa ?? "-"}</span>

        {!soloReps ? (
          <button onClick={() => setKgKeypadOpen(true)} className={`${VALUE_CELL} py-1.5 text-sm font-semibold`}>
            <ValueText value={set.peso} reference={pesoRef} />
          </button>
        ) : (
          <span className="text-center text-xs text-white/25">—</span>
        )}

        <button onClick={() => setRepsKeypadOpen(true)} className={`${VALUE_CELL} py-1.5 text-sm font-semibold`}>
          <ValueText value={set.reps} reference={repsRef} />
        </button>

        {/* Registra si el descanso tomado antes de esta serie cumplió, no cumplió, o superó el
        tiempo configurado. Vacío en la primera serie del ejercicio (no hay descanso previo). */}
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
          onClick={toggleComplete}
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-90"
          style={{
            background: set.completado ? "#3b82f6" : "rgba(255,255,255,0.06)",
            border: `1px solid ${set.completado ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
            boxShadow: set.completado ? "0 2px 8px rgba(59,130,246,0.45)" : "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          <Check size={16} className={set.completado ? "text-white" : "text-white/30"} />
        </button>
      </div>

      {isDropset && (
        <>
          {drops.map((d, k) => (
            <DropRow
              key={k}
              position={k + 1}
              peso={d.peso}
              reps={d.reps}
              pesoRef={dropWeightRefs[k]}
              soloReps={soloReps}
              completado={set.completado}
              onPeso={(v) => writeDrops(drops.map((x, i) => (i === k ? { ...x, peso: v } : x)))}
              onReps={(v) => writeDrops(drops.map((x, i) => (i === k ? { ...x, reps: v } : x)))}
              onRemove={() => writeDrops(drops.filter((_, i) => i !== k))}
            />
          ))}
          {!set.completado && (
            <button
              onClick={() => writeDrops([...drops, { peso: 0, reps: 0 }])}
              className="ml-10 self-start flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer"
              style={{ color: PURPLE, background: `${PURPLE}14` }}
            >
              <Plus size={12} /> bajada
            </button>
          )}
        </>
      )}

      <SetTypeModal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        value={set.tipo ?? "normal"}
        onSelect={(tipo) => onChange(tipo === "descendente" ? { tipo, ...initialDropsetPatch(set) } : { tipo })}
      />
      <NumericKeypad
        open={kgKeypadOpen}
        onClose={() => setKgKeypadOpen(false)}
        label={`Serie ${index + 1} · Peso (kg)`}
        initialValue={set.peso}
        step={2.5}
        accentColor="var(--gym)"
        banner="Registra el peso total incluyendo la barra."
        onNext={(v) =>
          onChange(
            isDropset && set.pesosDescendentes
              ? { peso: v, pesosDescendentes: [v, ...set.pesosDescendentes.slice(1)] }
              : { peso: v },
          )
        }
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

/** Bajada de un dropset: fila compacta (sin columna de tiempo ni check propio) que cuelga de la
 * serie principal y se tilda junto con ella. */
function DropRow({
  position,
  peso,
  reps,
  pesoRef,
  soloReps,
  completado,
  onPeso,
  onReps,
  onRemove,
}: {
  position: number;
  peso: number;
  reps: number;
  pesoRef: number;
  soloReps?: boolean;
  completado: boolean;
  onPeso: (v: number) => void;
  onReps: (v: number) => void;
  onRemove: () => void;
}) {
  const [kgOpen, setKgOpen] = useState(false);
  const [repsOpen, setRepsOpen] = useState(false);
  return (
    <div
      className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto] gap-2 items-center rounded-xl px-2.5 py-1.5 ml-3"
      style={{ background: `${PURPLE}12`, border: `1px solid ${PURPLE}33` }}
    >
      <span className="w-8 text-center text-[10px] font-bold" style={{ color: PURPLE }}>
        ↳ {position}
      </span>
      <span className="w-12" />
      {!soloReps ? (
        <button onClick={() => setKgOpen(true)} className={`${VALUE_CELL} py-1 text-xs font-semibold`}>
          <ValueText value={peso} reference={pesoRef} />
        </button>
      ) : (
        <span className="text-center text-xs text-white/25">—</span>
      )}
      <button onClick={() => setRepsOpen(true)} className={`${VALUE_CELL} py-1 text-xs font-semibold`}>
        <ValueText value={reps} reference={DROP_REPS_REF} />
      </button>
      <span className="w-9" />
      {completado ? (
        <span className="w-9" />
      ) : (
        <button onClick={onRemove} aria-label="Quitar bajada" className="w-9 flex items-center justify-center text-white/35 cursor-pointer">
          <X size={14} />
        </button>
      )}

      <NumericKeypad
        open={kgOpen}
        onClose={() => setKgOpen(false)}
        label={`Bajada ${position} · Peso (kg)`}
        initialValue={peso}
        step={2.5}
        accentColor="var(--gym)"
        banner="Peso de esta bajada. Si no escribís nada, se usa el de referencia."
        onNext={onPeso}
      />
      <NumericKeypad
        open={repsOpen}
        onClose={() => setRepsOpen(false)}
        label={`Bajada ${position} · Repeticiones`}
        initialValue={reps}
        step={1}
        accentColor="var(--gym-2)"
        banner={`Repeticiones de esta bajada. Si no escribís nada, se usan ${DROP_REPS_REF}.`}
        onNext={onReps}
      />
    </div>
  );
}
