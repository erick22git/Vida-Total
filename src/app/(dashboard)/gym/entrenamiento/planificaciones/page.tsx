"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Key, Pencil, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { EditPlanModal } from "@/components/gym/edit-plan-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { LIBRARY_PLANS, PLAN_LIBRARY_CATEGORIES } from "@/lib/data/plan-library";
import type { TrainingPlan } from "@/lib/types";

export default function PlanificacionesPage() {
  const router = useRouter();
  const plans = useGymStore((s) => s.plans);
  const routines = useGymStore((s) => s.routines);
  const setActivePlan = useGymStore((s) => s.setActivePlan);
  const applyPlanToWeek = useGymStore((s) => s.applyPlanToWeek);
  const allExercises = useAllExercises();
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);
  const activePlan = plans.find((p) => p.activo);
  const otherPlans = plans.filter((p) => !p.activo);

  const allCategories = useMemo(
    () => Array.from(new Set([...PLAN_LIBRARY_CATEGORIES, ...plans.map((p) => p.categoria)])),
    [plans],
  );

  function planBgImage(plan: TrainingPlan) {
    for (const day of plan.dias) {
      if (!day.routineId) continue;
      const routine = routines.find((r) => r.id === day.routineId);
      if (!routine) continue;
      for (const rex of routine.ejercicios) {
        const ex = allExercises.find((e) => e.id === rex.exerciseId);
        if (ex?.imagen) return ex.imagen;
      }
    }
    return undefined;
  }

  function selectPlan(id: string) {
    setActivePlan(id);
    applyPlanToWeek(id);
  }

  return (
    <div className="flex flex-col gap-7 pb-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Planificaciones</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/gym/entrenamiento/planificaciones/ia")}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-white cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] transition-colors"
          >
            <Sparkles size={13} /> IA
          </button>
          <button
            onClick={() => router.push("/gym/entrenamiento/planificaciones/manual")}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white cursor-pointer bg-white/[0.1] hover:bg-white/[0.18] transition-colors glass-specular-ring"
          >
            <Plus size={14} /> Crear
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-white/85">Mis Planes</h3>

        {activePlan ? (
          <GlassCard
            accentColor="rgba(255,255,255,0.9)"
            glow
            onClick={() => router.push(`/gym/entrenamiento/planificaciones/${activePlan.id}`)}
            className="relative h-56 flex flex-col justify-end p-5 overflow-hidden cursor-pointer"
            style={{
              background: planBgImage(activePlan) ? undefined : "var(--glass-bg-dark)",
            }}
          >
            {planBgImage(activePlan) && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={planBgImage(activePlan)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.85) 100%)" }}
                />
              </>
            )}
            <span className="absolute top-4 left-4 z-10">
              <GlassBadge color="#22c55e">Activo</GlassBadge>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingPlan(activePlan);
              }}
              aria-label="Editar plan"
              className="absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white cursor-pointer transition-colors"
            >
              <Pencil size={15} />
            </button>
            <p className="relative z-10 text-2xl font-extrabold uppercase text-white leading-tight">{activePlan.nombre}</p>
            <p className="relative z-10 text-sm text-white/60 mt-1">
              {activePlan.contexto} · {activePlan.categoria}
            </p>
            {activePlan.notas && <p className="relative z-10 text-xs text-white/45 mt-1.5 italic">{activePlan.notas}</p>}
          </GlassCard>
        ) : (
          <GlassCard interactive={false} className="text-center py-8" style={{ background: "var(--glass-bg-dark)" }}>
            <p className="text-sm text-white/40">Aún no tienes un plan activo. Crea uno con el botón de arriba.</p>
          </GlassCard>
        )}

        {otherPlans.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {otherPlans.map((p) => (
              <GlassCard key={p.id} padding="sm" className="flex items-center gap-3" style={{ background: "var(--glass-bg-dark)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-white/45 truncate">
                    {p.contexto} · {p.categoria}
                  </p>
                  {p.notas && <p className="text-[11px] text-white/35 italic truncate">{p.notas}</p>}
                </div>
                <button
                  onClick={() => setEditingPlan(p)}
                  aria-label="Editar plan"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white cursor-pointer transition-colors shrink-0"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => selectPlan(p.id)}
                  className="shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold text-white cursor-pointer transition-colors bg-white/[0.1] hover:bg-white/[0.18] glass-specular-ring"
                >
                  Seleccionar
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {allCategories.map((cat) => {
        const myItems = plans.filter((p) => p.categoria === cat);
        const libItems = LIBRARY_PLANS.filter((p) => p.categoria === cat);
        if (myItems.length === 0 && libItems.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-white/85">{cat}</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {myItems.map((p) => (
                <GlassCard
                  key={p.id}
                  padding="none"
                  onClick={() => router.push(`/gym/entrenamiento/planificaciones/${p.id}`)}
                  className="relative shrink-0 w-48 h-32 flex flex-col justify-end p-3.5 overflow-hidden cursor-pointer"
                  style={{ background: "var(--glass-bg-dark)" }}
                >
                  {p.activo && (
                    <span className="absolute top-2.5 right-2.5">
                      <GlassBadge color="#22c55e">Activo</GlassBadge>
                    </span>
                  )}
                  <p className="text-sm font-bold text-white leading-tight">{p.nombre}</p>
                  <p className="text-[11px] text-white/55 mt-1">{p.contexto}</p>
                </GlassCard>
              ))}
              {libItems.map((p) => (
                <Link key={p.id} href="/gym/entrenamiento/planificaciones/biblioteca">
                  <GlassCard
                    padding="none"
                    className="shrink-0 w-48 h-32 flex flex-col justify-end p-3.5 overflow-hidden"
                    style={{ background: "var(--glass-bg-dark)" }}
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
        );
      })}

      <EditPlanModal
        key={editingPlan?.id ?? "none"}
        open={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        plan={editingPlan}
        categorias={allCategories}
      />
    </div>
  );
}
