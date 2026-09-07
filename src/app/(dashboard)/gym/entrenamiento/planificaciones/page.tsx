"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Key } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { CreatePlanModal } from "@/components/gym/create-plan-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { LIBRARY_PLANS, PLAN_LIBRARY_CATEGORIES } from "@/lib/data/plan-library";

export default function PlanificacionesPage() {
  const plans = useGymStore((s) => s.plans);
  const [createOpen, setCreateOpen] = useState(false);
  const activePlan = plans.find((p) => p.activo);

  return (
    <div className="flex flex-col gap-7 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Planificaciones</h1>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg, var(--gym), var(--gym-2))" }}
        >
          <Plus size={14} /> Crear
        </button>
      </header>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-white/85">Tus Planificaciones</h3>
        {activePlan || plans.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {(activePlan ? [activePlan, ...plans.filter((p) => p.id !== activePlan.id)] : plans).map((p) => (
              <GlassCard
                key={p.id}
                accentColor={p.activo ? "var(--gym-2)" : undefined}
                glow={p.activo}
                className="relative h-36 flex flex-col justify-end p-4 overflow-hidden"
                style={{ background: "linear-gradient(160deg, var(--gym)33, var(--gym-2)22)" }}
              >
                {p.activo && (
                  <span className="absolute top-3 left-3">
                    <GlassBadge color="#22c55e">Activo</GlassBadge>
                  </span>
                )}
                <p className="text-lg font-extrabold uppercase text-white leading-tight">{p.nombre}</p>
                <p className="text-xs text-white/55 mt-1">{p.contexto}</p>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard interactive={false} className="text-center py-8">
            <p className="text-sm text-white/40">Aún no tienes planificaciones. Crea una con el botón de arriba.</p>
          </GlassCard>
        )}
      </div>

      {PLAN_LIBRARY_CATEGORIES.map((cat) => (
        <div key={cat} className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-white/85">{cat}</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {LIBRARY_PLANS.filter((p) => p.categoria === cat).map((p) => (
              <Link key={p.id} href="/gym/entrenamiento/planificaciones/biblioteca">
                <GlassCard
                  padding="none"
                  className="shrink-0 w-48 h-32 flex flex-col justify-end p-3.5 overflow-hidden"
                  style={{ background: p.gradient }}
                >
                  <p className="text-sm font-bold text-white leading-tight">{p.nombre}</p>
                  <p className="text-[11px] text-white/55 flex items-center gap-1 mt-1">
                    <Key size={10} /> {p.contexto}
                  </p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <CreatePlanModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
