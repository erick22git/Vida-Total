"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Repeat, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { usePazMentalStore, useFacialYogaStreak } from "@/lib/store/pazMentalStore";
import type { FacialExercise, FacialZone } from "@/lib/types/paz-mental";
import facialYogaData from "@/lib/data/facial-yoga.json";

const exercises = facialYogaData as FacialExercise[];

const ZONE_LABEL: Record<FacialZone, string> = {
  frente: "Frente",
  ojos: "Ojos",
  mejillas: "Mejillas",
  nariz: "Nariz",
  boca: "Boca / Labios",
  mandibula: "Mandíbula / Cuello",
};

export default function YogaFacialPage() {
  const streak = useFacialYogaStreak();
  const logFacialYogaToday = usePazMentalStore((s) => s.logFacialYogaToday);

  const [selectedZone, setSelectedZone] = useState<FacialZone | null>(null);
  const [activeExercise, setActiveExercise] = useState<FacialExercise | null>(null);

  const zoneExercises = selectedZone ? exercises.filter((e) => e.zone === selectedZone) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Yoga Facial
          </h1>
        </div>
        <span className="ml-auto text-xs text-white/50 flex items-center gap-1">
          <Flame size={13} className="text-orange-400" /> {streak} días
        </span>
      </header>

      {activeExercise ? (
        <ExerciseSession
          exercise={activeExercise}
          onExit={() => setActiveExercise(null)}
          onComplete={() => {
            logFacialYogaToday();
            setActiveExercise(null);
          }}
        />
      ) : (
        <>
          <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-white/60 text-center">
              Toca una zona del rostro para ver sus ejercicios
            </p>
            <FaceSVG selectedZone={selectedZone} onSelect={setSelectedZone} />
          </GlassCard>

          {selectedZone && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white/80">
                Ejercicios para {ZONE_LABEL[selectedZone]}
              </p>
              {zoneExercises.map((ex) => (
                <GlassCard key={ex.id} padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-white">{ex.name}</p>
                    <p className="text-xs text-white/45">{ex.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1">
                      <span>{ex.durationSec}s</span>
                      <span className="flex items-center gap-1">
                        <Repeat size={11} /> {ex.repetitions}x
                      </span>
                    </div>
                  </div>
                  <GlassButton accentColor="var(--paz-mental)" size="sm" onClick={() => setActiveExercise(ex)}>
                    Iniciar
                  </GlassButton>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FaceSVG({
  selectedZone,
  onSelect,
}: {
  selectedZone: FacialZone | null;
  onSelect: (z: FacialZone) => void;
}) {
  const zoneStyle = (z: FacialZone) => ({
    fill: selectedZone === z ? "var(--paz-mental)55" : "rgba(255,255,255,0.06)",
    stroke: selectedZone === z ? "var(--paz-mental)" : "rgba(255,255,255,0.2)",
    strokeWidth: 1.5,
    cursor: "pointer",
    transition: "fill 0.2s, stroke 0.2s",
  });

  return (
    <svg viewBox="0 0 240 300" className="w-56 h-auto">
      {/* face outline */}
      <ellipse cx="120" cy="150" rx="85" ry="115" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

      {/* frente */}
      <path
        d="M45 90 Q120 45 195 90 L195 115 Q120 85 45 115 Z"
        style={zoneStyle("frente")}
        onClick={() => onSelect("frente")}
      />
      {/* ojos */}
      <ellipse cx="85" cy="145" rx="22" ry="12" style={zoneStyle("ojos")} onClick={() => onSelect("ojos")} />
      <ellipse cx="155" cy="145" rx="22" ry="12" style={zoneStyle("ojos")} onClick={() => onSelect("ojos")} />
      {/* nariz */}
      <path d="M112 145 L128 145 L124 200 L116 200 Z" style={zoneStyle("nariz")} onClick={() => onSelect("nariz")} />
      {/* mejillas */}
      <ellipse cx="65" cy="190" rx="22" ry="26" style={zoneStyle("mejillas")} onClick={() => onSelect("mejillas")} />
      <ellipse cx="175" cy="190" rx="22" ry="26" style={zoneStyle("mejillas")} onClick={() => onSelect("mejillas")} />
      {/* boca */}
      <ellipse cx="120" cy="225" rx="28" ry="12" style={zoneStyle("boca")} onClick={() => onSelect("boca")} />
      {/* mandibula */}
      <path
        d="M45 200 Q60 260 120 265 Q180 260 195 200 L195 235 Q120 290 45 235 Z"
        style={zoneStyle("mandibula")}
        onClick={() => onSelect("mandibula")}
      />
    </svg>
  );
}

function ExerciseSession({
  exercise,
  onExit,
  onComplete,
}: {
  exercise: FacialExercise;
  onExit: () => void;
  onComplete: () => void;
}) {
  const [rep, setRep] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(exercise.durationSec);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const isLast = rep >= exercise.repetitions;

  function nextRep() {
    if (isLast) {
      onComplete();
      return;
    }
    setRep((r) => r + 1);
    setSecondsLeft(exercise.durationSec);
    setRunning(false);
  }

  return (
    <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-5 py-10">
      <div className="flex items-center justify-between w-full">
        <p className="text-lg font-semibold text-white">{exercise.name}</p>
        <button onClick={onExit} className="text-white/50 hover:text-white cursor-pointer">
          <X size={20} />
        </button>
      </div>
      <p className="text-xs text-white/50">
        Repetición {rep}/{exercise.repetitions}
      </p>
      <motion.div
        animate={{ scale: running ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          background: "radial-gradient(circle, var(--paz-mental)55, var(--paz-mental)11)",
          boxShadow: "0 0 50px var(--paz-mental)44",
        }}
      >
        <p className="text-3xl font-bold text-white">{secondsLeft}s</p>
      </motion.div>
      <p className="text-sm text-white/60 text-center max-w-sm">{exercise.description}</p>
      <div className="flex gap-3">
        <GlassButton accentColor="var(--paz-mental)" variant="outline" onClick={() => setRunning((r) => !r)}>
          {running ? "Pausar" : "Iniciar timer"}
        </GlassButton>
        <GlassButton accentColor="var(--paz-mental)" onClick={nextRep}>
          {isLast ? "Terminar" : "Siguiente repetición"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
