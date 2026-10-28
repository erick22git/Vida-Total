"use client";

import { useState } from "react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { DEFAULT_MEAL_START_TIMES, usePreferencesStore } from "@/lib/store/preferencesStore";
import { sortedMeals } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type MealType } from "@/lib/types";

/**
 * "Tiempos de comida": la hora a la que EMPIEZA cada comida (Desayuno, Almuerzo, Cena y los Snack 1, 2, 3… que tengas
 * activos). El título de Calorías cambia solo según esta hora y cada comida dura hasta que empieza la siguiente. Se
 * listan por hora; dos comidas no pueden empezar a la misma hora.
 */
export function MealTimesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = usePreferencesStore((s) => s.mealStartTimes);
  const snackCount = usePreferencesStore((s) => s.snackCount);
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

  const meals = sortedMeals(draft, snackCount);

  function save() {
    const seen = new Map<string, MealType>();
    for (const m of meals) {
      if (!draft[m]) {
        setError(`Pon la hora de ${MEAL_LABELS[m]}.`);
        return;
      }
      const clash = seen.get(draft[m]);
      if (clash) {
        setError(`${MEAL_LABELS[m]} y ${MEAL_LABELS[clash]} empiezan a la misma hora.`);
        return;
      }
      seen.set(draft[m], m);
    }
    setMealStartTimes(draft);
    onClose();
  }

  return (
    <ExpandSheet open={open} onClose={onClose} title="Tiempos de comida">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-sm text-white/55">
          Elige a qué hora empieza cada comida y cada snack. Cada una dura hasta que empieza la siguiente. Para tener más snacks usa
          &ldquo;Snacks según tus objetivos&rdquo;.
        </p>
        {meals.map((meal) => (
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
          <p className="text-xs text-white/80" role="alert">
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
