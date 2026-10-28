"use client";

/**
 * "Snacks según tus objetivos": te dice cuántas comidas conviene hacer al día y cada cuánto (con la base de
 * `snack-advice.ts`), y te deja agregar o quitar snacks. Los snacks se llaman Snack 1, 2, 3… y cada uno tiene su hora en
 * "Horario de cada comida". Agregar uno SIEMPRE es tu decisión: la sugerencia solo propone.
 */
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { useGymStore } from "@/lib/store/gymStore";
import { useTargetProfile } from "@/lib/nutrition/use-targets";
import { DEFAULT_MEAL_START_TIMES, usePreferencesStore } from "@/lib/store/preferencesStore";
import { adviseSnacks } from "@/lib/nutrition/snack-advice";
import { MAX_SNACKS, sortedMeals } from "@/lib/gym/meal-time";
import { MEAL_LABELS, type MealType } from "@/lib/types";

export function SnackAdviceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const objetivo = useGymStore((s) => s.gymProfile?.objetivoCalorico);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const perfil = useTargetProfile();
  const times = usePreferencesStore((s) => s.mealStartTimes);
  const snackCount = usePreferencesStore((s) => s.snackCount);
  const setSnackCount = usePreferencesStore((s) => s.setSnackCount);
  const setMealStartTimes = usePreferencesStore((s) => s.setMealStartTimes);
  const [timeText, setTimeText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const advice = useMemo(
    () => adviseSnacks({ calorieGoal, proteinGoal, pesoKg: perfil.pesoKg, objetivo, entrena: !!perfil.entrena, mealTimes: times, snackCount }),
    [calorieGoal, proteinGoal, perfil.pesoKg, perfil.entrena, objetivo, times, snackCount],
  );

  const nextSnack = `snack${snackCount + 1}` as MealType;
  const lastSnack = `snack${snackCount}` as MealType;
  const timeForNew = timeText ?? advice.suggestedTime ?? DEFAULT_MEAL_START_TIMES[nextSnack];
  const order = sortedMeals(times, snackCount);

  function addSnack(time: string) {
    if (snackCount >= MAX_SNACKS) return;
    const taken = Object.entries(times).find(([m, t]) => t === time && sortedMeals(times, snackCount).includes(m as MealType));
    if (taken) {
      setError(`${MEAL_LABELS[taken[0] as MealType]} ya empieza a las ${time}. Elige otra hora.`);
      return;
    }
    setError(null);
    setMealStartTimes({ ...DEFAULT_MEAL_START_TIMES, ...times, [nextSnack]: time });
    setSnackCount(snackCount + 1);
    setTimeText(null);
  }

  function removeLast() {
    if (snackCount <= 0) return;
    if (loggedFoods.some((f) => f.meal === lastSnack)) {
      setError(`${MEAL_LABELS[lastSnack]} tiene alimentos registrados. Muévelos o bórralos antes de quitarlo.`);
      return;
    }
    setError(null);
    setSnackCount(snackCount - 1);
  }

  return (
    <ExpandSheet open={open} onClose={onClose} title="Snacks según tus objetivos">
      <div className="flex flex-col gap-4 pb-2">
        <div className="rounded-2xl bg-white/[0.06] p-4 flex flex-col gap-2">
          <p className="text-base font-semibold text-white">{advice.headline}</p>
          {advice.reasons.map((r) => (
            <p key={r} className="text-xs text-white/60 leading-relaxed">
              • {r}
            </p>
          ))}
          {advice.perSnack && (
            <p className="text-xs text-white/75 pt-1">
              Cada snack: ≈ {advice.perSnack.kcal} kcal y ≈ {advice.perSnack.proteinG} g de proteína.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Tu día ahora ({advice.mealsNow} comidas)</p>
          {order.map((m, i) => (
            <div key={m} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3.5 py-2 text-sm">
              <span className="text-white/85">{MEAL_LABELS[m]}</span>
              <span className="tabular-nums text-white/55">
                {times[m] ?? DEFAULT_MEAL_START_TIMES[m]}
                {i > 0 && advice.gaps[i - 1] ? ` · +${advice.gaps[i - 1].hours} h` : ""}
              </span>
            </div>
          ))}
        </div>

        {snackCount < MAX_SNACKS && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.05] p-3.5">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">{MEAL_LABELS[nextSnack]} a las</span>
              <input type="time" value={timeForNew} onChange={(e) => e.target.value && setTimeText(e.target.value)} className="bg-transparent text-white text-base font-semibold outline-none [color-scheme:dark]" />
            </label>
            <button onClick={() => addSnack(timeForNew)} className="flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold bg-white text-black cursor-pointer">
              <Plus size={15} /> {advice.delta > 0 ? `Agregar ${MEAL_LABELS[nextSnack]} (sugerido)` : `Agregar ${MEAL_LABELS[nextSnack]}`}
            </button>
            {advice.delta <= 0 && <p className="text-[11px] text-white/40">Según tu objetivo no hace falta, pero puedes agregarlo si te sirve.</p>}
          </div>
        )}

        {snackCount > 0 && (
          <button onClick={removeLast} className="flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium border border-white/20 text-white/80 cursor-pointer">
            <Minus size={15} /> Quitar {MEAL_LABELS[lastSnack]}
          </button>
        )}

        {error && (
          <p className="text-xs text-white/80" role="alert">
            {error}
          </p>
        )}
        <p className="text-[10px] text-white/35 leading-relaxed">
          Base: Schoenfeld &amp; Aragon 2018 (~0,4 g/kg de proteína por comida, en 4 o más), Areta 2013 (4 tomas cada 3 h), Mamerow 2014 (reparto
          parejo) y Schoenfeld 2015 (para perder grasa la frecuencia por sí sola no cambia el resultado). Es una guía, no una prescripción.
        </p>
      </div>
    </ExpandSheet>
  );
}
