"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassCard } from "@/components/glass/glass-card";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { useGymStore, useTodayLoggedFoods } from "@/lib/store/gymStore";
import { MEAL_LABELS, type MealType } from "@/lib/types";

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snacks"];

/** Simplified free-text capture per meal — quick logging without searching
 * the food database, similar to jotting down what you ate on a notepad. */
export default function ListaPage() {
  const addLoggedFood = useGymStore((s) => s.addLoggedFood);
  const removeLoggedFood = useGymStore((s) => s.removeLoggedFood);
  const todayFoods = useTodayLoggedFoods();

  return (
    <div className="flex flex-col gap-4 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Lista rápida</h1>
      </header>

      <CaloriasMethodNav />

      <p className="text-xs text-white/45">
        Escribe libremente lo que comiste en cada comida. Puedes agregar las calorías si las conoces, o dejarlas
        en blanco y completarlas después desde el historial.
      </p>

      {MEALS.map((meal) => (
        <MealQuickList
          key={meal}
          meal={meal}
          items={todayFoods.filter((f) => f.meal === meal)}
          onAdd={(nombre, kcal) =>
            addLoggedFood({
              foodId: `lista-${Date.now()}`,
              nombre,
              calorias: kcal,
              proteina: 0,
              carbos: 0,
              grasas: 0,
              meal,
            })
          }
          onRemove={removeLoggedFood}
        />
      ))}
    </div>
  );
}

function MealQuickList({
  meal,
  items,
  onAdd,
  onRemove,
}: {
  meal: MealType;
  items: { id: string; nombre: string; calorias: number }[];
  onAdd: (nombre: string, kcal: number) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [kcal, setKcal] = useState("");

  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim(), parseFloat(kcal) || 0);
    setText("");
    setKcal("");
  }

  return (
    <GlassCard padding="md" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</h2>

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs bg-white/[0.04] rounded-xl px-3 py-2">
              <span className="text-white/80">{item.nombre}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-white/45">{item.calorias || "—"} kcal</span>
                <button onClick={() => onRemove(item.id)} className="text-white/30 hover:text-white/70 cursor-pointer">
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <GlassInput
          placeholder="¿Qué comiste?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1"
        />
        <GlassInput
          placeholder="kcal"
          type="number"
          inputMode="numeric"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-20"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-2xl shrink-0 disabled:opacity-30 cursor-pointer transition-colors"
          style={{ background: "var(--gym)" }}
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>
    </GlassCard>
  );
}
