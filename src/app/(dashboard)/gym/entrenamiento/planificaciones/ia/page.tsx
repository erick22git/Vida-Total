"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Dumbbell, Info } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { BodySilhouetteFront, BodySilhouetteBack, type BodyZone } from "@/components/gym/body-silhouette";
import { MUSCLE_COLOR, FUNNY_ROUTINE_NAMES } from "@/lib/data/gym-meta";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";
import type { MuscleGroup, RoutineExercise, SetType } from "@/lib/types";

type Step = "goal" | "muscles" | "days" | "equipment" | "result";
const STEPS: Step[] = ["goal", "muscles", "days", "equipment", "result"];

const GOALS = [
  { key: "musculo", label: "Ganar músculo", emoji: "💪" },
  { key: "fuerza", label: "Ganar fuerza", emoji: "🏋️" },
  { key: "grasa", label: "Perder grasa", emoji: "🔥" },
  { key: "funcionalidad", label: "Mejorar funcionalidad", emoji: "🏃" },
];

const MUSCLE_OPTIONS = [
  { key: "completo", label: "Cuerpo completo", recomendado: true, zones: ["hombros", "pecho", "biceps", "abdomen", "cuadriceps", "espalda"] as BodyZone[] },
  { key: "traccion", label: "Músculos de tracción", zones: ["espalda", "biceps", "trapecio"] as BodyZone[] },
  { key: "empuje", label: "Músculos de empuje", zones: ["pecho", "hombros", "triceps"] as BodyZone[] },
  { key: "superior", label: "Tren superior", zones: ["hombros", "pecho", "biceps", "triceps", "espalda"] as BodyZone[] },
  { key: "inferior", label: "Tren inferior", zones: ["cuadriceps", "gemelos", "gluteos", "isquios"] as BodyZone[] },
  { key: "custom", label: "Elegir músculos", zones: [] as BodyZone[] },
];

const GOAL_TO_SETS: Record<string, { sets: number; reps: string; repsNum: number }> = {
  musculo: { sets: 4, reps: "8-12", repsNum: 10 },
  fuerza: { sets: 5, reps: "3-6", repsNum: 5 },
  grasa: { sets: 3, reps: "15-20", repsNum: 18 },
  funcionalidad: { sets: 3, reps: "10-15", repsNum: 12 },
};

const MUSCLE_TO_CATEGORIES: Record<string, MuscleGroup[]> = {
  completo: ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps", "Piernas", "Gluteos", "Abdomen"],
  traccion: ["Espalda", "Biceps"],
  empuje: ["Pecho", "Hombros", "Triceps"],
  superior: ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps"],
  inferior: ["Piernas", "Gluteos"],
  custom: ["Pecho", "Espalda", "Piernas"],
};

export default function AiPlanWizardPage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const startWorkoutFromRoutine = useGymStore((s) => s.startWorkoutFromRoutine);

  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [muscleChoice, setMuscleChoice] = useState<string | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipment, setEquipment] = useState<string[]>(["Gimnasio comercial"]);

  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  type Generated = {
    ejercicios: RoutineExercise[];
    distribution: { cat: MuscleGroup; count: number; pct: number }[];
    nombre: string;
    goalConfig: { sets: number; reps: string; repsNum: number };
    chosen: typeof allExercises;
  };
  const [generated, setGenerated] = useState<Generated | null>(null);

  function buildRoutine() {
    if (!goal || !muscleChoice) return;
    const categories = MUSCLE_TO_CATEGORIES[muscleChoice] ?? MUSCLE_TO_CATEGORIES.completo;
    const goalConfig = GOAL_TO_SETS[goal];
    const pool = allExercises.filter((e) => categories.includes(e.categoria));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(7, Math.max(4, shuffled.length)));
    const ejercicios: RoutineExercise[] = chosen.map((ex) => ({
      exerciseId: ex.id,
      sets: Array.from({ length: goalConfig.sets }).map(() => ({
        peso: 0,
        reps: goalConfig.repsNum,
        tipo: "normal" as SetType,
      })),
    }));
    const distribution = categories
      .map((cat) => ({
        cat,
        count: ejercicios.filter((e) => allExercises.find((ex) => ex.id === e.exerciseId)?.categoria === cat).length,
      }))
      .filter((d) => d.count > 0)
      .map((d) => ({ ...d, pct: Math.round((d.count / ejercicios.length) * 100) }));
    const nombre = FUNNY_ROUTINE_NAMES[Math.floor(Math.random() * FUNNY_ROUTINE_NAMES.length)];
    setGenerated({ ejercicios, distribution, nombre, goalConfig, chosen });
  }

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }

  function handleGenerate() {
    buildRoutine();
    next();
  }

  function handleStart() {
    if (!generated) return;
    const routine = saveRoutine(generated.nombre, generated.ejercicios);
    startWorkoutFromRoutine(routine);
    router.push("/gym/entrenamiento/activo");
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-400"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, var(--gym-2))" }}
          />
        </div>
        <button onClick={() => router.push("/gym/entrenamiento/planificaciones")} className="text-white/50 hover:text-white cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {step === "goal" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.1] px-4 py-3 text-sm text-white/70">
            {goal ? GOALS.find((g) => g.key === goal)?.label : "Elige tu objetivo"}
          </div>
          <h2 className="text-xl font-bold text-center">Elige tu objetivo</h2>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGoal(g.key)}
                className="flex flex-col items-center gap-2 rounded-3xl py-8 cursor-pointer transition-all"
                style={{
                  background: goal === g.key ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${goal === g.key ? "white" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                <span className="text-4xl">{g.emoji}</span>
                <span className="text-sm font-semibold text-white text-center px-2">{g.label}</span>
              </button>
            ))}
          </div>
          <GlassButton accentColor="#3b82f6" size="lg" disabled={!goal} onClick={next}>
            Continuar
          </GlassButton>
        </div>
      )}

      {step === "muscles" && (
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-center">Músculos a trabajar</h2>
          <div className="flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs" style={{ background: "#3b82f61f", border: "1px solid #3b82f640", color: "#93c5fd" }}>
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Mantén presionado para ver los músculos que se trabajarán en cada grupo.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MUSCLE_OPTIONS.map((m) => {
              const intensities = Object.fromEntries(m.zones.map((z) => [z, 0.9]));
              const active = muscleChoice === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMuscleChoice(m.key)}
                  className="relative flex flex-col items-center gap-1.5 rounded-3xl py-4 cursor-pointer transition-all"
                  style={{
                    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                    border: `2px solid ${active ? "white" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {m.recomendado && (
                    <span className="absolute top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      Recomendado
                    </span>
                  )}
                  <div className="flex gap-1">
                    <BodySilhouetteFront intensities={intensities} size={44} />
                    <BodySilhouetteBack intensities={intensities} size={44} />
                  </div>
                  <span className="text-xs font-semibold text-white text-center px-2">{m.label}</span>
                </button>
              );
            })}
          </div>
          <GlassButton accentColor="#3b82f6" size="lg" disabled={!muscleChoice} onClick={next}>
            Continuar
          </GlassButton>
        </div>
      )}

      {step === "days" && (
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-center">¿Cuántos días a la semana?</h2>
          <div className="flex justify-center gap-2.5 flex-wrap">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setDaysPerWeek(n)}
                className="flex items-center justify-center w-14 h-14 rounded-2xl text-lg font-bold cursor-pointer transition-all"
                style={{
                  background: daysPerWeek === n ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${daysPerWeek === n ? "white" : "rgba(255,255,255,0.1)"}`,
                  color: "white",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <GlassButton accentColor="#3b82f6" size="lg" onClick={next}>
            Continuar
          </GlassButton>
        </div>
      )}

      {step === "equipment" && (
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-center">¿Dónde entrenas?</h2>
          <div className="flex flex-col gap-2.5">
            {["Gimnasio comercial", "En casa", "Calistenia / sin equipo"].map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipment([eq])}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 cursor-pointer transition-all"
                style={{
                  background: equipment[0] === eq ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${equipment[0] === eq ? "white" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                <span className="text-sm font-semibold text-white">{eq}</span>
              </button>
            ))}
          </div>
          <GlassButton accentColor="#3b82f6" size="lg" onClick={handleGenerate}>
            Generar mi plan
          </GlassButton>
        </div>
      )}

      {step === "result" && generated && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <p className="text-xs text-white/45 mb-1">Tu rutina generada</p>
            <h2 className="text-2xl font-extrabold text-white">{generated.nombre}</h2>
          </div>

          {generated.distribution.length > 0 && (
            <GlassCard accentColor="var(--gym)" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white/80">Distribución Muscular</p>
              <div className="flex flex-wrap gap-2">
                {generated.distribution.map((d) => {
                  const color = MUSCLE_COLOR[d.cat] ?? "var(--gym)";
                  return (
                    <span
                      key={d.cat}
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{ background: `${color}1f`, border: `1px solid ${color}55`, color }}
                    >
                      {d.cat} · {d.pct}%
                    </span>
                  );
                })}
              </div>
            </GlassCard>
          )}

          <div className="flex flex-col gap-2">
            {generated.chosen.map((ex) => (
              <GlassCard key={ex.id} padding="sm" interactive={false} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  {ex.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ex.imagen} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Dumbbell size={16} className="text-white/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ex.nombre}</p>
                  <p className="text-xs text-white/45">
                    {generated.goalConfig.sets} series x {generated.goalConfig.reps} reps
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassButton accentColor="var(--gym-2)" size="lg" onClick={handleStart}>
            Empezar Entrenamiento
          </GlassButton>
        </div>
      )}
    </div>
  );
}
