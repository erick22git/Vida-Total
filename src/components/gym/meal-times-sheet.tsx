"use client";

import { useState } from "react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { DEFAULT_MEAL_START_TIMES, usePreferencesStore } from "@/lib/store/preferencesStore";
import { MEAL_ORDER } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type MealType } from "@/lib/types";

/**
 * "Tiempos de comida": la hora a la que EMPIEZA cada comida. El título de Calorías cambia solo según esta hora y cada comida
 * dura hasta que empieza la siguiente. Las horas tienen que ir en orden a lo largo del día.
 */
export function MealTimesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = usePreferencesStore((s) => s.mealStartTimes);
  const setMealStartTimes = usePreferencesStore((s) => s.setMealStartTimes);
  const [draft, setDraft] = useState<Record<MealType, string>>(() => ({ ...DEFAULT_MEAL_START_TIMES, ...saved }));
  const [error, setError] = useState<string | null>(null);

  // Al abrir se parte de lo guardado.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft({ ...DEFAULT_MEAL_START_TIMES, ...saved });
      setError(null);
    }
  }

  function save() {
    for (let i = 1; i < MEAL_ORDER.length; i++) {
      if (!draft[MEAL_ORDER[i]] || draft[MEAL_ORDER[i]] <= draft[MEAL_ORDER[i - 1]]) {
        setError(`${MEAL_LABELS[MEAL_ORDER[i]]} tiene que empezar después de ${MEAL_LABELS[MEAL_ORDER[i - 1]]}.`);
        return;
      }
    }
    setMealStartTimes(draft);
    onClose();
  }

  return (
    <ExpandSheet open={open} onClose={onClose} title="Tiempos de comida">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-sm text-white/55">Elige a qué hora empieza cada comida. Cada una dura hasta que empieza la siguiente.</p>
        {MEAL_ORDER.map((meal) => (
          <label key={meal} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-2.5">
            <span className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</span>
            <input
              type="time"
              value={draft[meal]}
              onChange={(e) => e.target.value && setDraft((d) => ({ ...d, [meal]: e.target.value }))}
              className="bg-transparent text-white text-base font-semibold outline-none [color-scheme:dark]"
            />
          </label>
        ))}
        {error && (
          <p className="text-xs text-[#ff9a9d]" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...DEFAULT_MEAL_START_TIMES });
              setError(null);
            }}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold bg-white/10 text-white cursor-pointer"
          >
            Valores por defecto
          </button>
          <button type="button" onClick={save} className="flex-1 rounded-full py-2.5 text-sm font-semibold bg-white text-black cursor-pointer">
            Guardar
          </button>
        </div>
      </div>
    </ExpandSheet>
  );
}
