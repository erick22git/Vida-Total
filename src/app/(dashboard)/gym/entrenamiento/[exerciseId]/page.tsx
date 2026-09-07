"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { ExerciseGuideTab } from "@/components/gym/exercise-guide-tab";
import { ExerciseSummaryTab } from "@/components/gym/exercise-summary-tab";
import { ExerciseRankTab } from "@/components/gym/exercise-rank-tab";
import { ExerciseHistoryTab } from "@/components/gym/exercise-history-tab";
import { useGymStore } from "@/lib/store/gymStore";

type TabKey = "resumen" | "guia" | "rango" | "historial";
const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "guia", label: "Guía" },
  { key: "rango", label: "Rango" },
  { key: "historial", label: "Historial" },
];

export default function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = use(params);
  const allExercises = useAllExercises();
  const sessions = useGymStore((s) => s.sessions);
  const exercise = allExercises.find((e) => e.id === exerciseId);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
          {exercise?.nombre ?? "Ejercicio no encontrado"}
        </h1>
      </header>

      {!exercise ? (
        <p className="text-sm text-white/50">
          Este ejercicio no existe.{" "}
          <Link href="/gym/entrenamiento" className="underline">
            Volver
          </Link>
        </p>
      ) : (
        <Suspense fallback={null}>
          <ExerciseTabs exerciseId={exercise.id}>
            {(tab) => {
              if (tab === "guia") return <ExerciseGuideTab exercise={exercise} />;
              if (tab === "rango") return <ExerciseRankTab exerciseId={exercise.id} />;
              if (tab === "historial") return <ExerciseHistoryTab exerciseId={exercise.id} sessions={sessions} />;
              return <ExerciseSummaryTab exerciseId={exercise.id} sessions={sessions} />;
            }}
          </ExerciseTabs>
        </Suspense>
      )}
    </div>
  );
}

function ExerciseTabs({
  exerciseId,
  children,
}: {
  exerciseId: string;
  children: (tab: TabKey) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) ?? "resumen";
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? initialTab : "resumen");

  return (
    <div key={exerciseId} className="flex flex-col gap-5">
      <div className="flex gap-1.5 rounded-2xl bg-white/[0.04] p-1 border border-white/[0.08]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-xl py-2 text-xs md:text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: tab === t.key ? "linear-gradient(135deg, var(--gym), var(--gym-2))" : "transparent",
              color: tab === t.key ? "white" : "rgba(255,255,255,0.5)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children(tab)}
    </div>
  );
}
