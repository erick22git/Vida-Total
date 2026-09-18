"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Moon, Dumbbell, Plus, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { ExercisePicker, useAllExercises } from "@/components/gym/exercise-picker";
import { ExerciseSessionBuilder } from "@/components/gym/exercise-session-builder";
import { useGymStore } from "@/lib/store/gymStore";
import { dominantMuscleGroup } from "@/lib/gym-utils";
import { PLAN_LIBRARY_CATEGORIES } from "@/lib/data/plan-library";
import { cn } from "@/lib/utils";
import type { RoutineExercise, WeeklyPlanDay } from "@/lib/types";

const DAYS = [
  { key: "L", label: "Lunes" },
  { key: "M", label: "Martes" },
  { key: "X", label: "Miércoles" },
  { key: "J", label: "Jueves" },
  { key: "V", label: "Viernes" },
  { key: "S", label: "Sábado" },
  { key: "D", label: "Domingo" },
];

export default function ManualPlanCreatorPage() {
  const router = useRouter();
  const createPlan = useGymStore((s) => s.createPlan);
  const setActivePlan = useGymStore((s) => s.setActivePlan);
  const applyPlanToWeek = useGymStore((s) => s.applyPlanToWeek);
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const existingPlans = useGymStore((s) => s.plans);
  const allExercises = useAllExercises();

  const [dayDrafts, setDayDrafts] = useState<RoutineExercise[][]>(DAYS.map(() => []));
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [nombre, setNombre] = useState("Mi Plan Personalizado");
  const [categoria, setCategoria] = useState(PLAN_LIBRARY_CATEGORIES[0]);
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [notas, setNotas] = useState("");
  // Bloque 13: fecha desde la que arranca este plan — por default hoy,
  // pero editable (p.ej. si lo estás armando de antemano para que empiece
  // el lunes que viene). Es lo que queda registrado en `planHistory`, y
  // también lo que cierra automáticamente el `fechaFin` del plan anterior.
  const [fechaInicio, setFechaInicio] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const hasActivePlan = existingPlans.some((p) => p.activo);
  // Antes esto se forzaba siempre a true — no había forma de armar un plan
  // nuevo (p.ej. para el mes que viene) sin desactivar de inmediato el que
  // ya estabas usando. Si todavía no hay ningún plan activo, no tiene
  // sentido dejar la opción destildada (te quedarías sin plan actual), así
  // que ahí queda forzada y deshabilitada.
  const [usarComoActual, setUsarComoActual] = useState(true);

  const categoriasDisponibles = useMemo(
    () => Array.from(new Set([...PLAN_LIBRARY_CATEGORIES, ...existingPlans.map((p) => p.categoria)])),
    [existingPlans],
  );

  const daysActive = dayDrafts.filter((d) => d.length > 0).length;

  function clearDay(i: number) {
    setDayDrafts((d) => d.map((day, idx) => (idx === i ? [] : day)));
  }

  function handleCreate() {
    const dias: WeeklyPlanDay[] = DAYS.map((d, i) => {
      const draft = dayDrafts[i];
      if (draft.length === 0) return { day: d.key, grupoMuscular: "Descanso" as const };
      const routine = saveRoutine(`${nombre.trim() || "Mi Plan Personalizado"} - ${d.label}`, draft);
      const grupo = dominantMuscleGroup(draft, allExercises) ?? "Cardio";
      return { day: d.key, grupoMuscular: grupo, routineId: routine.id };
    });
    const plan = createPlan({
      nombre: nombre.trim() || "Mi Plan Personalizado",
      contexto: `Gimnasio · ${daysActive} días/semana`,
      categoria: categoria.trim() || PLAN_LIBRARY_CATEGORIES[0],
      notas: notas.trim(),
      dias,
      daysPerWeek: daysActive,
      minsPerSession: 60,
    });
    if (usarComoActual || !hasActivePlan) {
      const inicioISO = new Date(`${fechaInicio}T00:00:00`).toISOString();
      setActivePlan(plan.id, inicioISO);
      applyPlanToWeek(plan.id);
    }
    router.push("/gym/entrenamiento/planificaciones");
  }

  if (editingDay !== null) {
    const label = DAYS[editingDay].label;
    const draft = dayDrafts[editingDay];
    return (
      <div className="flex flex-col gap-5 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditingDay(null)} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">Editar: {label}</h1>
          </div>
          <GlassButton size="sm" accentColor="rgba(255,255,255,0.85)" className="!text-black" onClick={() => setEditingDay(null)}>
            Listo
          </GlassButton>
        </header>

        {draft.length === 0 ? (
          <>
            <p className="text-sm text-white/50 -mt-3">Selecciona los ejercicios para {label}.</p>
            <ExercisePicker
              multiple
              confirmButtonClassName="z-30"
              onConfirmSelection={(exs) =>
                setDayDrafts((d) =>
                  d.map((day, idx) =>
                    idx === editingDay
                      ? exs.map<RoutineExercise>((e) => ({
                          exerciseId: e.id,
                          sets: [
                            { peso: 0, reps: 10, tipo: "normal" },
                            { peso: 0, reps: 10, tipo: "normal" },
                            { peso: 0, reps: 10, tipo: "normal" },
                          ],
                        }))
                      : day,
                  ),
                )
              }
            />
          </>
        ) : (
          <ExerciseSessionBuilder
            draft={draft}
            onDraftChange={(next) => setDayDrafts((d) => d.map((day, idx) => (idx === editingDay ? next : day)))}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Crear Manualmente</h1>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Nombre del plan</span>
        <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del plan" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Categoría</span>
        <div className="flex flex-wrap gap-2">
          {categoriasDisponibles.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoria(cat);
                setNuevaCategoria(false);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
                categoria === cat && !nuevaCategoria
                  ? "bg-white/[0.85] border-white text-black"
                  : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
              )}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setNuevaCategoria(true)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
              nuevaCategoria
                ? "bg-white/[0.85] border-white text-black"
                : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
            )}
          >
            <Plus size={12} /> Nueva
          </button>
        </div>
        {nuevaCategoria && (
          <GlassInput
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Nombre de la nueva categoría"
            className="mt-1"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Notas (opcional)</span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Alguna observación sobre este plan..."
          rows={2}
          className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:shadow-[var(--glass-specular-strong)] focus:bg-white/[0.09] resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Inicio del plan</span>
        <GlassInput type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
      </div>

      <button
        onClick={() => hasActivePlan && setUsarComoActual((v) => !v)}
        disabled={!hasActivePlan}
        className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] glass-specular-ring px-4 py-3 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div>
          <p className="text-sm font-medium text-white">Usar como mi plan actual</p>
          <p className="text-xs text-white/45">
            {hasActivePlan
              ? "Con esto activado, empezarás a entrenar según este plan apenas lo crees."
              : "Todavía no tienes un plan activo, así que este se activará solo."}
          </p>
        </div>
        <div
          className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
          style={{ background: usarComoActual || !hasActivePlan ? "var(--gym)" : "rgba(255,255,255,0.15)" }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: usarComoActual || !hasActivePlan ? "translateX(22px)" : "translateX(2px)" }}
          />
        </div>
      </button>

      <p className="text-sm text-white/50 -mt-1">Toca un día para agregarle ejercicios.</p>

      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((d, i) => {
          const draft = dayDrafts[i];
          const isRest = draft.length === 0;
          const grupo = isRest ? null : dominantMuscleGroup(draft, allExercises);
          return (
            <GlassCard
              key={d.key}
              padding="sm"
              accentColor={isRest ? undefined : "rgba(255,255,255,0.85)"}
              onClick={() => setEditingDay(i)}
              className="relative flex flex-col gap-2 h-28 justify-center items-center text-center cursor-pointer"
              style={{ background: "var(--glass-bg-dark)" }}
            >
              {!isRest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDay(i);
                  }}
                  className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-black/40 text-white/50 hover:text-white cursor-pointer"
                  title="Marcar como descanso"
                  aria-label="Marcar como descanso"
                >
                  <X size={12} />
                </button>
              )}
              <p className="text-xs font-semibold text-white/50">{d.label}</p>
              {isRest ? (
                <>
                  <Moon size={20} className="text-white/30" />
                  <p className="text-xs text-white/40">Día de descanso</p>
                </>
              ) : (
                <>
                  <Dumbbell size={20} className="text-white" />
                  <p className="text-sm font-bold text-white">{grupo}</p>
                  <p className="text-[10px] text-white/40">{draft.length} ejercicios</p>
                </>
              )}
            </GlassCard>
          );
        })}
      </div>

      <div className="fixed bottom-4 md:bottom-6 left-0 right-0 px-5 md:px-8 md:ml-64">
        <GlassButton accentColor="rgba(255,255,255,0.85)" className="w-full max-w-2xl mx-auto !text-black" size="lg" onClick={handleCreate}>
          Crear Planificación
        </GlassButton>
      </div>
    </div>
  );
}
