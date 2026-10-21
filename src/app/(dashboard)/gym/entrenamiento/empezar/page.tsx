"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { BEGINNER_DAYS, createBeginnerPlan } from "@/lib/gym/beginner-plan";
import { useAllExercises } from "@/components/gym/exercise-picker";

/**
 * Primera vez en Entrenamiento: la cuenta nueva NO recibe ninguna rutina hecha. Se le pide elegir entre una rutina de
 * principiante sugerida (cuerpo completo, 3 días) o armar la suya. Cualquiera de las dos queda como plan propio y editable.
 */
export default function EmpezarEntrenamientoPage() {
  const router = useRouter();
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const createPlan = useGymStore((s) => s.createPlan);
  const setActivePlan = useGymStore((s) => s.setActivePlan);
  const applyPlanToWeek = useGymStore((s) => s.applyPlanToWeek);
  const allExercises = useAllExercises();
  const nameOf = (id: string) => allExercises.find((e) => e.id === id)?.nombre ?? id;

  function chooseSuggested() {
    const plan = createBeginnerPlan({ saveRoutine, createPlan });
    setActivePlan(plan.id);
    applyPlanToWeek(plan.id);
    router.replace("/gym/entrenamiento");
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col app-bg text-white overflow-y-auto">
      <header className="flex items-center px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={() => router.replace("/gym")} aria-label="Volver" className="w-9 h-9 -ml-2 flex items-center justify-center cursor-pointer text-white/80">
          <ChevronLeft size={24} />
        </button>
      </header>
      <div className="max-w-md w-full mx-auto px-5 pb-10 pt-3 flex flex-col gap-5">
        <div>
          <h1 className="text-[28px] leading-[1.05] font-black tracking-tight uppercase">¿Con qué rutina empezás?</h1>
          <p className="text-sm text-white/55 mt-2">Todavía no tenés ninguna. Elegí una sugerencia para principiantes o armá la tuya: después la podés cambiar cuando quieras.</p>
        </div>

        <GlassCard interactive={false} padding="lg" className="flex flex-col gap-3" style={{ background: "var(--glass-bg-dark)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-white/80" />
            <h2 className="text-base font-bold">Rutina de principiante</h2>
          </div>
          <p className="text-xs text-white/55">Cuerpo completo, 3 días a la semana (lunes, miércoles y viernes), unos 45 minutos. Pocas series y buena técnica.</p>
          <ul className="flex flex-col gap-2 text-xs text-white/70">
            {BEGINNER_DAYS.map((d) => (
              <li key={d.nombre}>
                <span className="font-semibold text-white/90">{d.nombre}:</span> {d.ejercicios.map((e) => nameOf(e.exerciseId)).join(" · ")}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={chooseSuggested}
            className="rounded-full py-3 text-sm font-semibold bg-white text-black cursor-pointer"
          >
            Usar esta rutina
          </button>
        </GlassCard>

        <GlassCard interactive={false} padding="lg" className="flex flex-col gap-3" style={{ background: "var(--glass-bg-dark)" }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-white/80" />
            <h2 className="text-base font-bold">Armar la mía</h2>
          </div>
          <p className="text-xs text-white/55">Elegís los días y los ejercicios vos. También podés pedirle una a la IA o copiar la de un atleta.</p>
          <button
            type="button"
            onClick={() => router.replace("/gym/entrenamiento/planificaciones")}
            className="rounded-full py-3 text-sm font-semibold bg-white/[0.12] glass-specular-ring text-white cursor-pointer"
          >
            Crear mi rutina
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
