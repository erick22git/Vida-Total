"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, SlidersHorizontal, Key, CalendarDays, Clock } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { LIBRARY_PLANS } from "@/lib/data/plan-library";

export default function PlanLibraryPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Biblioteca de Planes</h1>
      </header>

      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">Planes Encontrados · {LIBRARY_PLANS.length} planes encontrados</p>
        <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white/[0.06] border border-white/[0.12] text-white/70 cursor-pointer">
          <SlidersHorizontal size={13} /> Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LIBRARY_PLANS.map((p) => (
          <GlassCard
            key={p.id}
            padding="none"
            className="h-52 flex flex-col justify-end p-5 overflow-hidden relative"
            style={{ background: p.gradient }}
          >
            <p className="text-xl font-extrabold uppercase text-white leading-tight">{p.nombre}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> {p.daysPerWeek} días/semana
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {p.minsPerSession} mins/sesión
              </span>
            </div>
            <span
              className="inline-flex items-center gap-1 mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium w-fit"
              style={{ background: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.85)" }}
            >
              <Key size={10} /> {p.contexto}
            </span>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
