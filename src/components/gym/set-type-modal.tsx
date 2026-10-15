"use client";

import { Check } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import type { SetType } from "@/lib/types";
import { SET_TYPE_META, SET_TYPES } from "@/components/gym/set-type";

/** Chip rápido: solo prellena el texto de `notas`, no es un campo booleano aparte — el usuario puede
 * seguir editando el texto libremente después de tocarlo. Exportada para que la Fase E del
 * roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md) pueda sugerir el mismo texto en
 * vez de duplicar el literal en otro archivo. */
export const MALA_TECNICA = "Mala técnica";

/** Opciones rápidas de RIR ("reps in reserve", cuánto margen quedó antes del fallo) — autorregulación
 * con validez publicada (Helms et al. 2016), ya usada por `progressive-overload.ts` para sugerir el
 * peso de la próxima sesión. `4` representa "4 o más" (mucho margen), no un tope exacto. */
const RIR_OPTIONS = [0, 1, 2, 3, 4] as const;

export function SetTypeModal({
  open,
  onClose,
  value,
  onSelect,
  notas,
  onNotasChange,
  rir,
  onRirChange,
}: {
  open: boolean;
  onClose: () => void;
  value: SetType;
  onSelect: (type: SetType) => void;
  /** Nota corta de la serie (Fase 2) — opcional: si no se pasa, no se muestra la sección de notas. */
  notas?: string;
  onNotasChange?: (notas: string) => void;
  /** RIR de la serie — opcional: si no se pasa, no se muestra el selector. */
  rir?: number;
  onRirChange?: (rir: number | undefined) => void;
}) {
  return (
    <ExpandSheet open={open} onClose={onClose} title="Seleccionar Tipo de Serie">
      <div className="flex flex-col gap-2">
        {SET_TYPES.map((type) => {
          const meta = SET_TYPE_META[type];
          const active = value === type;
          return (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer"
              style={{
                background: active ? `${meta.color}1f` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? meta.color : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0"
                style={{ background: `${meta.color}33`, color: meta.color, border: `1px solid ${meta.color}66` }}
              >
                {meta.short}
              </span>
              <span className="flex-1 text-sm font-medium text-white">{meta.label}</span>
              {active && <Check size={16} style={{ color: meta.color }} />}
            </button>
          );
        })}
      </div>

      {onRirChange && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">RIR (reps que te quedaron en reserva)</span>
          <div className="flex gap-1.5">
            {RIR_OPTIONS.map((opt) => {
              const active = rir === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onRirChange(active ? undefined : opt)}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold cursor-pointer transition-colors"
                  style={{
                    background: active ? "#fff" : "rgba(255,255,255,0.06)",
                    color: active ? "#000" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {opt === 4 ? "4+" : opt}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-white/35">0 = al fallo, no podías hacer ni una más. Esto activa la sugerencia de peso del Coach.</p>
        </div>
      )}

      {onNotasChange && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Nota de la serie</span>
          <button
            onClick={() => onNotasChange((notas ?? "").trim() === MALA_TECNICA ? "" : MALA_TECNICA)}
            className="self-start rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: (notas ?? "").trim() === MALA_TECNICA ? "#ef44441f" : "rgba(255,255,255,0.06)",
              border: `1px solid ${(notas ?? "").trim() === MALA_TECNICA ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
              color: (notas ?? "").trim() === MALA_TECNICA ? "#ef4444" : "rgba(255,255,255,0.7)",
            }}
          >
            Mala técnica
          </button>
          <textarea
            value={notas ?? ""}
            onChange={(e) => onNotasChange(e.target.value)}
            placeholder="Más detalle (opcional)"
            rows={2}
            className="w-full rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 outline-none resize-none"
          />
        </div>
      )}
    </ExpandSheet>
  );
}
