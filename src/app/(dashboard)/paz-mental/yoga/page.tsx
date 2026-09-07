"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, PartyPopper, Play, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { usePazMentalStore } from "@/lib/store/pazMentalStore";
import type { YogaCategory, YogaPose } from "@/lib/types/paz-mental";
import yogaPosesData from "@/lib/data/yoga-poses.json";

const poses = yogaPosesData as YogaPose[];

const CATEGORIES: ("Todas" | YogaCategory)[] = [
  "Todas",
  "Flexibilidad",
  "Fuerza",
  "Relajación",
  "Matutino",
  "Nocturno",
];

const LEVELS: ("Todos" | YogaPose["difficulty"])[] = [
  "Todos",
  "Principiante",
  "Intermedio",
  "Avanzado",
];

// Build simple routines by grouping poses per category (5-8 poses each)
function buildRoutines() {
  const byCategory: Record<string, YogaPose[]> = {};
  poses.forEach((p) => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  return Object.entries(byCategory).map(([category, list]) => ({
    id: `routine-${category}`,
    name: `Rutina de ${category}`,
    category: category as YogaCategory,
    difficulty: list[0]?.difficulty ?? "Principiante",
    poses: list,
  }));
}

export default function YogaPage() {
  const routines = useMemo(() => buildRoutines(), []);
  const logYogaSession = usePazMentalStore((s) => s.logYogaSession);
  const yogaSessionsCompleted = usePazMentalStore((s) => s.yogaSessionsCompleted);

  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORIES)[number]>("Todas");
  const [levelFilter, setLevelFilter] = useState<(typeof LEVELS)[number]>("Todos");
  const [activeRoutine, setActiveRoutine] = useState<ReturnType<typeof buildRoutines>[number] | null>(null);

  const filteredRoutines = routines.filter((r) => {
    if (categoryFilter !== "Todas" && r.category !== categoryFilter) return false;
    if (levelFilter !== "Todos" && r.difficulty !== levelFilter) return false;
    return true;
  });

  if (activeRoutine) {
    return (
      <YogaSession
        routine={activeRoutine}
        onExit={() => setActiveRoutine(null)}
        onComplete={() => {
          logYogaSession();
          setActiveRoutine(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Yoga
          </h1>
        </div>
        {yogaSessionsCompleted > 0 && (
          <span className="ml-auto text-xs text-white/50">{yogaSessionsCompleted} sesiones completadas</span>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
              style={{
                background: categoryFilter === c ? "var(--paz-mental)" : "rgba(255,255,255,0.06)",
                color: categoryFilter === c ? "#04201c" : "rgba(255,255,255,0.7)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border"
              style={{
                borderColor: levelFilter === l ? "var(--paz-mental)" : "rgba(255,255,255,0.1)",
                color: levelFilter === l ? "var(--paz-mental)" : "rgba(255,255,255,0.6)",
                background: levelFilter === l ? "var(--paz-mental)11" : "transparent",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredRoutines.map((r) => (
          <GlassCard key={r.id} accentColor="var(--paz-mental)" glow className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-white">{r.name}</p>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--paz-mental)22", color: "var(--paz-mental)" }}
              >
                {r.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {Math.round(r.poses.reduce((s, p) => s + p.durationSec, 0) / 60)} min
              </span>
              <span>{r.poses.length} poses</span>
            </div>
            <GlassButton accentColor="var(--paz-mental)" onClick={() => setActiveRoutine(r)} className="w-full">
              <Play size={16} /> Iniciar rutina
            </GlassButton>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function YogaSession({
  routine,
  onExit,
  onComplete,
}: {
  routine: ReturnType<typeof buildRoutines>[number];
  onExit: () => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const pose = routine.poses[index];
  const [secondsLeft, setSecondsLeft] = useState(pose.durationSec);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function goToIndex(nextIndex: number) {
    setIndex(nextIndex);
    setSecondsLeft(routine.poses[nextIndex].durationSec);
    setRunning(false);
  }

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const isLast = index === routine.poses.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={onExit} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <X size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">{routine.name}</p>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-white">{pose.name}</h1>
        </div>
        <span className="ml-auto text-xs text-white/50">
          {index + 1}/{routine.poses.length} poses
        </span>
      </header>

      <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--paz-mental)" }}
          animate={{ width: `${((index + 1) / routine.poses.length) * 100}%` }}
        />
      </div>

      <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-5 py-10">
        <motion.div
          animate={{ scale: running ? [1, 1.04, 1] : 1 }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: "radial-gradient(circle, var(--paz-mental)55, var(--paz-mental)11)",
            boxShadow: "0 0 50px var(--paz-mental)44",
          }}
        >
          <p className="text-3xl font-bold text-white">{secondsLeft}s</p>
        </motion.div>
        <p className="text-sm text-white/60 text-center max-w-sm">{pose.description}</p>
        <GlassButton accentColor="var(--paz-mental)" onClick={() => setRunning((r) => !r)}>
          {running ? "Pausar" : "Iniciar timer"}
        </GlassButton>
      </GlassCard>

      <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-white/80">Instrucciones</p>
        <ol className="flex flex-col gap-1.5">
          {pose.instructions.map((ins, i) => (
            <li key={i} className="text-sm text-white/60 flex gap-2">
              <span style={{ color: "var(--paz-mental)" }}>{i + 1}.</span> {ins}
            </li>
          ))}
        </ol>
      </GlassCard>

      <div className="flex items-center justify-between gap-3">
        <GlassButton
          accentColor="var(--paz-mental)"
          variant="outline"
          onClick={() => goToIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          <ChevronLeft size={18} /> Anterior
        </GlassButton>
        {isLast ? (
          <GlassButton accentColor="var(--paz-mental)" onClick={onComplete}>
            <PartyPopper size={18} /> Terminar rutina
          </GlassButton>
        ) : (
          <GlassButton accentColor="var(--paz-mental)" onClick={() => goToIndex(index + 1)}>
            Siguiente <ChevronRight size={18} />
          </GlassButton>
        )}
      </div>
    </div>
  );
}
