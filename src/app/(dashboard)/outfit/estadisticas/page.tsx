"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, BarChart3, DollarSign, Palette } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/outfit-utils";
import { useOutfitStore } from "@/lib/store/outfitStore";

export default function EstadisticasPage() {
  const clothingItems = useOutfitStore((s) => s.clothingItems);

  const byCategory = useMemo(() => {
    const counts = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      count: clothingItems.filter((c) => c.category === cat).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return { counts, max };
  }, [clothingItems]);

  const sortedByUse = useMemo(
    () => [...clothingItems].sort((a, b) => b.timesWorn - a.timesWorn),
    [clothingItems],
  );
  const topUsed = sortedByUse.slice(0, 5);
  const leastUsed = [...sortedByUse].reverse().slice(0, 5);

  const colorFrequency = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of clothingItems) {
      map.set(item.color, (map.get(item.color) ?? 0) + Math.max(1, item.timesWorn));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [clothingItems]);

  const withCost = clothingItems.filter((c) => typeof c.cost === "number" && c.cost! > 0);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/outfit"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] glass-specular-ring text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 style={{ color: "var(--outfit)" }} /> Estadísticas
        </h1>
      </header>

      {clothingItems.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
          <BarChart3 size={32} className="text-white/25" />
          <p className="text-white/60 text-sm">
            Agrega prendas a tu armario para ver estadísticas.
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard accentColor="var(--outfit)" glow className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-white/80">Prendas por categoría</p>
            <div className="flex flex-col gap-3">
              {byCategory.counts.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-white/55">
                    {CATEGORY_LABELS[c.category]}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.count / byCategory.max) * 100}%`,
                        background: "var(--outfit)",
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-white/60">{c.count}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard accentColor="var(--outfit)" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white/80">Top 5 más usadas</p>
              <div className="flex flex-col gap-2">
                {topUsed.length === 0 && <p className="text-xs text-white/40">Sin datos aún.</p>}
                {topUsed.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/75 truncate">{item.name}</span>
                    <span className="text-white/45 text-xs shrink-0 ml-2">{item.timesWorn}x</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard accentColor="var(--outfit)" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white/80">Top 5 menos usadas</p>
              <div className="flex flex-col gap-2">
                {leastUsed.length === 0 && <p className="text-xs text-white/40">Sin datos aún.</p>}
                {leastUsed.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/75 truncate">{item.name}</span>
                    <span className="text-white/45 text-xs shrink-0 ml-2">{item.timesWorn}x</span>
                  </div>
                ))}
              </div>
              {leastUsed.some((i) => i.timesWorn === 0) && (
                <p className="text-xs text-white/35 pt-1">
                  Algunas prendas nunca se han usado — considera donar las que no usas.
                </p>
              )}
            </GlassCard>
          </div>

          <GlassCard accentColor="var(--outfit)" className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Palette size={15} style={{ color: "var(--outfit)" }} /> Paleta dominante
            </p>
            <div className="flex flex-wrap gap-3">
              {colorFrequency.map(([color, freq]) => (
                <div key={color} className="flex flex-col items-center gap-1">
                  <span
                    className="w-10 h-10 rounded-full glass-specular-ring"
                    style={{ background: color }}
                  />
                  <span className="text-[10px] text-white/40">{freq}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard accentColor="var(--outfit)" className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <DollarSign size={15} style={{ color: "var(--outfit)" }} /> Costo por uso
            </p>
            {withCost.length === 0 ? (
              <p className="text-xs text-white/40">
                No has registrado costos en tus prendas todavía.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {withCost.map((item) => {
                  const perUse = item.cost! / Math.max(1, item.timesWorn);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-white/75 truncate">{item.name}</span>
                      <span className="text-white/45 text-xs shrink-0 ml-2">
                        ${perUse.toFixed(0)} / uso
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
