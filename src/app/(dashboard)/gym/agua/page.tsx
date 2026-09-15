"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Droplets, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { GlassCard } from "@/components/glass/glass-card";
import { WaterBottle } from "@/components/gym/water-bottle";
import { WeeklyWaterCard } from "@/components/gym/weekly-water-card";
import { AddDrinkModal } from "@/components/gym/add-drink-modal";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { totalsByDrink } from "@/lib/gym/water-stats";
import { useGymStore, useTodayWaterEntries } from "@/lib/store/gymStore";

const QUICK_ADDS = [150, 250, 500];

export default function AguaPage() {
  const router = useRouter();
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const waterEntries = useGymStore((s) => s.waterEntries);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const addWater = useGymStore((s) => s.addWater);
  const removeWaterEntry = useGymStore((s) => s.removeWaterEntry);
  const todayEntries = useTodayWaterEntries();
  const [addDrinkOpen, setAddDrinkOpen] = useState(false);

  const todayByDrink = useMemo(() => totalsByDrink(todayEntries, drinkOverrides), [todayEntries, drinkOverrides]);

  return (
    <div className="flex flex-col gap-6">
      <PageBackdrop
        src="/backgrounds/agua.webp"
        positionClass="object-[60%_40%] md:object-[55%_45%] lg:object-[50%_50%]"
      />

      {/* `relative`: sin position, estos hijos se pintan debajo del
      PageBackdrop (fixed) sin importar el orden en el DOM. */}
      <div className="relative flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Droplets className="text-white" /> Agua
        </h1>
      </header>

      <GlassCard accentColor="#3b82f6" glow className="flex flex-col items-center gap-6 py-8" style={{ background: "var(--glass-bg-dark)" }}>
        <WaterBottle segments={todayByDrink.map((d) => ({ color: d.color, ml: d.ml }))} max={waterGoalMl} />
        <div className="flex gap-3">
          {QUICK_ADDS.map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              className="rounded-2xl px-4 py-2.5 text-sm font-medium text-white cursor-pointer transition-transform hover:scale-105 bg-white/[0.08] hover:bg-white/[0.14] glass-specular-ring"
            >
              +{ml}ml
            </button>
          ))}
        </div>
        <button
          onClick={() => setAddDrinkOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] glass-specular-ring transition-colors cursor-pointer"
        >
          <Plus size={16} /> Añadir una bebida
        </button>
      </GlassCard>

      <AddDrinkModal open={addDrinkOpen} onClose={() => setAddDrinkOpen(false)} />

      <GlassCard className="flex flex-col gap-2" style={{ background: "var(--glass-bg-dark)" }}>
        <p className="text-sm font-semibold text-white/80">Registros de hoy</p>
        {todayEntries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {todayEntries
              .slice()
              .reverse()
              .map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between text-sm bg-white/[0.04] rounded-xl glass-specular-ring px-3 py-2"
                >
                  <span className="text-white/80">
                    {w.drinkEmoji ?? "💧"} {w.drinkNombre ?? "Agua"} · {w.ml} ml
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">
                      {format(new Date(w.timestamp), "HH:mm")}
                    </span>
                    <button
                      onClick={() => removeWaterEntry(w.id)}
                      className="text-white/30 hover:text-white/70 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-white/30">Aún no registras agua hoy</p>
        )}
      </GlassCard>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Estadísticas semanales</p>
          <button
            onClick={() => router.push("/gym/agua/estadisticas")}
            className="flex items-center gap-0.5 text-xs font-medium text-[#3b82f6] hover:text-[#60a5fa] transition-colors cursor-pointer"
          >
            Más <ChevronRight size={13} />
          </button>
        </div>
        <WeeklyWaterCard waterEntries={waterEntries} waterGoalMl={waterGoalMl} />
      </div>
      </div>
    </div>
  );
}
