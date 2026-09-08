"use client";

import { useState } from "react";
import { Flame, ArrowLeft, Search, ScanLine, Mic, BookOpen, List } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MealCard } from "@/components/gym/meal-card";
import { FoodSearchModal } from "@/components/gym/food-search-modal";
import { useGymStore, useTodayLoggedFoods } from "@/lib/store/gymStore";
import type { MealType } from "@/lib/types";

const QUICK_ACTIONS = [
  { key: "buscar", label: "Buscar", href: "/gym/calorias/buscar", icon: Search },
  { key: "escaner", label: "Escáner", href: "/gym/calorias/escaner", icon: ScanLine },
  { key: "voz", label: "Voz", href: "/gym/calorias/voz", icon: Mic },
  { key: "recetas", label: "Recetas", href: "/gym/calorias/recetas", icon: BookOpen },
  { key: "lista", label: "Lista", href: "/gym/calorias/lista", icon: List },
] as const;

const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snacks"];

export default function CaloriasPage() {
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const todayFoods = useTodayLoggedFoods();
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);

  const totals = todayFoods.reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Flame style={{ color: "var(--gym)" }} /> Calorías
        </h1>
      </header>

      <div className="flex flex-col items-center gap-4 py-2">
        <ProgressRing value={totals.calorias} max={calorieGoal} size={220} color="var(--gym)">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold">{totals.calorias}</span>
            <span className="text-xs text-white/45">de {calorieGoal} kcal</span>
          </div>
        </ProgressRing>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {QUICK_ACTIONS.map(({ key, label, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] py-3 transition-colors"
          >
            <Icon size={17} style={{ color: "var(--gym)" }} />
            <span className="text-[10px] text-white/60">{label}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <ProgressBar
          label="Proteína"
          sublabel={`${Math.round(totals.proteina)} / ${proteinGoal} g`}
          value={totals.proteina}
          max={proteinGoal}
          color="#22c55e"
        />
        <ProgressBar
          label="Carbohidratos"
          sublabel={`${Math.round(totals.carbos)} / ${carbsGoal} g`}
          value={totals.carbos}
          max={carbsGoal}
          color="#eab308"
        />
        <ProgressBar
          label="Grasas"
          sublabel={`${Math.round(totals.grasas)} / ${fatGoal} g`}
          value={totals.grasas}
          max={fatGoal}
          color="#f97316"
        />
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MEALS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            foods={todayFoods.filter((f) => f.meal === meal)}
            onAdd={() => setActiveMeal(meal)}
          />
        ))}
      </section>

      {activeMeal && (
        <FoodSearchModal
          open={!!activeMeal}
          onClose={() => setActiveMeal(null)}
          meal={activeMeal}
        />
      )}
    </div>
  );
}
