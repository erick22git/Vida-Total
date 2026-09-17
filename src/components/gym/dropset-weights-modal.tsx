"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";

/** Bloque 15: un dropset baja de peso varias veces sin descanso dentro de la
 * misma serie — este modal reemplaza al NumericKeypad de peso único cuando
 * `set.tipo === "descendente"`, dejando registrar el peso de cada bajada
 * por separado en vez de un solo número. */
export function DropsetWeightsModal({
  open,
  onClose,
  initialWeights,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialWeights: number[];
  onSave: (weights: number[]) => void;
}) {
  const [weights, setWeights] = useState<string[]>(() =>
    initialWeights.length ? initialWeights.map(String) : ["", ""],
  );
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setWeights(initialWeights.length ? initialWeights.map(String) : ["", ""]);
  }

  function updateAt(i: number, v: string) {
    setWeights((w) => w.map((x, idx) => (idx === i ? v : x)));
  }

  function addRow() {
    setWeights((w) => [...w, ""]);
  }

  function removeRow(i: number) {
    setWeights((w) => (w.length > 1 ? w.filter((_, idx) => idx !== i) : w));
  }

  function save() {
    const parsed = weights.map((w) => parseFloat(w) || 0);
    onSave(parsed);
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Pesos del dropset">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/50">Registra el peso de cada bajada, en orden (de más a menos peso).</p>
        <div className="flex flex-col gap-2">
          {weights.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-16 shrink-0">Bajada {i + 1}</span>
              <GlassInput
                type="number"
                inputMode="decimal"
                value={w}
                onChange={(e) => updateAt(i, e.target.value)}
                placeholder="kg"
                className="flex-1"
              />
              {weights.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="text-white/30 hover:text-red-400 cursor-pointer shrink-0"
                  aria-label="Quitar bajada"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm font-medium text-white/60 hover:text-white/85 hover:border-white/30 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Agregar bajada
        </button>
        <GlassButton accentColor="#a855f7" size="lg" onClick={save}>
          Guardar
        </GlassButton>
      </div>
    </GlassModal>
  );
}
