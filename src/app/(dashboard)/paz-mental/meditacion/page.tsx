"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CloudRain,
  Bird,
  Waves,
  Flame,
  Trees,
  Wind as WindIcon,
  Play,
  Pause,
  Square,
  PartyPopper,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import {
  usePazMentalStore,
  useMeditationStreak,
  MEDITATION_TYPE_LABEL,
} from "@/lib/store/pazMentalStore";
import type { BreathingPattern, MeditationType } from "@/lib/types/paz-mental";

const PATTERNS: BreathingPattern[] = [
  { id: "relajacion", label: "4-4-6 Relajación", description: "Inhala 4s, sostén 4s, exhala 6s", inhale: 4, hold: 4, exhale: 6 },
  { id: "sueno", label: "4-7-8 Sueño", description: "Inhala 4s, sostén 7s, exhala 8s", inhale: 4, hold: 7, exhale: 8 },
  { id: "box", label: "Box Breathing 4-4-4-4", description: "Inhala, sostén, exhala y sostén, todo 4s", inhale: 4, hold: 4, exhale: 4, holdAfterExhale: 4 },
];

const SOUNDS = [
  { id: "lluvia", label: "Lluvia", icon: CloudRain },
  { id: "pajaros", label: "Pájaros", icon: Bird },
  { id: "olas", label: "Olas", icon: Waves },
  { id: "fuego", label: "Fuego", icon: Flame },
  { id: "bosque", label: "Bosque", icon: Trees },
  { id: "viento", label: "Viento", icon: WindIcon },
];

const DURATIONS = [5, 10, 15];

type BreathPhase = "inhale" | "hold" | "exhale" | "holdAfterExhale";

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Inhala...",
  hold: "Sostén...",
  exhale: "Exhala...",
  holdAfterExhale: "Sostén...",
};

export default function MeditacionPage() {
  const addMeditationSession = usePazMentalStore((s) => s.addMeditationSession);
  const streak = useMeditationStreak();

  const [type, setType] = useState<MeditationType>("respiracion");
  const [patternId, setPatternId] = useState(PATTERNS[0].id);
  const [durationMin, setDurationMin] = useState(5);
  const [activeSounds, setActiveSounds] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [, setPhaseElapsed] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [summary, setSummary] = useState<{ duration: number; type: MeditationType } | null>(null);

  const pattern = PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0];
  const totalSeconds = durationMin * 60;

  const phaseOrder = useMemo(() => {
    const order: BreathPhase[] = ["inhale", "hold", "exhale"];
    if (pattern.holdAfterExhale) order.push("holdAfterExhale");
    return order;
  }, [pattern]);

  const phaseDuration = (p: BreathPhase) => {
    if (p === "inhale") return pattern.inhale;
    if (p === "hold") return pattern.hold;
    if (p === "exhale") return pattern.exhale;
    return pattern.holdAfterExhale ?? 0;
  };

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running || paused) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= totalSeconds) {
          finishSession(next);
          return next;
        }
        return next;
      });
      if (type === "respiracion") {
        setPhaseElapsed((prevPE) => {
          const currentDuration = phaseDuration(phase);
          if (prevPE + 1 >= currentDuration) {
            setPhase((prevPhase) => {
              const idx = phaseOrder.indexOf(prevPhase);
              const nextIdx = (idx + 1) % phaseOrder.length;
              if (nextIdx === 0) setCycles((c) => c + 1);
              return phaseOrder[nextIdx];
            });
            return 0;
          }
          return prevPE + 1;
        });
      }
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, phase, type, totalSeconds]);

  function finishSession(finalElapsed: number) {
    setRunning(false);
    setPaused(false);
    if (tickRef.current) clearInterval(tickRef.current);
    addMeditationSession({
      type,
      duration: finalElapsed,
      soundsUsed: Object.keys(activeSounds),
    });
    setSummary({ duration: finalElapsed, type });
  }

  function handleStart() {
    setSummary(null);
    setElapsed(0);
    setPhase("inhale");
    setPhaseElapsed(0);
    setCycles(0);
    setRunning(true);
    setPaused(false);
  }

  function handlePauseToggle() {
    setPaused((p) => !p);
  }

  function handleStop() {
    finishSession(elapsed);
  }

  function toggleSound(id: string) {
    setActiveSounds((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 0.6;
      return next;
    });
  }

  const remaining = Math.max(0, totalSeconds - elapsed);
  const minsLeft = Math.floor(remaining / 60);
  const secsLeft = remaining % 60;

  const scaleMap: Record<BreathPhase, number> = {
    inhale: 1.5,
    hold: 1.5,
    exhale: 0.85,
    holdAfterExhale: 0.85,
  };
  const currentDur = phaseDuration(phase);

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="breathing-bg absolute inset-0 -z-10 rounded-3xl opacity-40 pointer-events-none" />
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Meditación
          </h1>
        </div>
        {streak > 0 && (
          <span className="ml-auto text-xs text-white/50 flex items-center gap-1">
            🔥 {streak} días
          </span>
        )}
      </header>

      {!running && !summary && (
        <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] glass-specular-ring w-full sm:w-fit">
          {(["guiada", "respiracion", "libre"] as MeditationType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex-1 sm:flex-none"
              style={{
                background: type === t ? "var(--paz-mental)" : "transparent",
                color: type === t ? "#04201c" : "rgba(255,255,255,0.6)",
              }}
            >
              {MEDITATION_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {summary ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-4 text-center py-10">
              <PartyPopper size={36} style={{ color: "var(--paz-mental)" }} />
              <p className="text-lg font-semibold">¡Sesión completada!</p>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-2xl font-semibold">{Math.round(summary.duration / 60)}</p>
                  <p className="text-white/50">minutos</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{MEDITATION_TYPE_LABEL[summary.type]}</p>
                  <p className="text-white/50">tipo</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{streak}</p>
                  <p className="text-white/50">racha (días)</p>
                </div>
              </div>
              <GlassButton accentColor="var(--paz-mental)" onClick={() => setSummary(null)}>
                Nueva sesión
              </GlassButton>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            {type === "respiracion" && (
              <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-6 py-10">
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: running && !paused ? scaleMap[phase] : 1 }}
                    transition={{ duration: currentDur, ease: "easeInOut" }}
                    className="absolute w-32 h-32 rounded-full"
                    style={{
                      background: "radial-gradient(circle, var(--paz-mental)55, var(--paz-mental)11)",
                      boxShadow: "0 0 60px var(--paz-mental)55",
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <p className="text-lg font-semibold text-white">
                      {running ? PHASE_LABEL[phase] : "Listo"}
                    </p>
                    {running && (
                      <p className="text-3xl font-bold text-white">
                        {minsLeft}:{secsLeft.toString().padStart(2, "0")}
                      </p>
                    )}
                  </div>
                </div>

                {running && (
                  <p className="text-sm text-white/50">Ciclos completados: {cycles}</p>
                )}

                {!running && (
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <p className="text-xs text-white/50 text-center">Patrón de respiración</p>
                    <div className="flex flex-col gap-2">
                      {PATTERNS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPatternId(p.id)}
                          className="text-left px-4 py-2.5 rounded-2xl text-sm transition-colors cursor-pointer"
                          style={{
                            background: patternId === p.id ? "var(--paz-mental)22" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${patternId === p.id ? "var(--paz-mental)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <p className="font-medium text-white">{p.label}</p>
                          <p className="text-white/45 text-xs">{p.description}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/50 text-center mt-2">Duración</p>
                    <div className="flex gap-2 justify-center">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDurationMin(d)}
                          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
                          style={{
                            background: durationMin === d ? "var(--paz-mental)" : "rgba(255,255,255,0.06)",
                            color: durationMin === d ? "#04201c" : "rgba(255,255,255,0.7)",
                          }}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            )}

            {type !== "respiracion" && (
              <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col items-center gap-4 py-10">
                <motion.div
                  animate={{ scale: running && !paused ? [1, 1.08, 1] : 1 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle, var(--paz-mental)55, var(--paz-mental)11)",
                    boxShadow: "0 0 60px var(--paz-mental)55",
                  }}
                >
                  <p className="text-2xl font-bold text-white">
                    {minsLeft}:{secsLeft.toString().padStart(2, "0")}
                  </p>
                </motion.div>
                {!running && (
                  <div className="flex gap-2 justify-center">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDurationMin(d)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
                        style={{
                          background: durationMin === d ? "var(--paz-mental)" : "rgba(255,255,255,0.06)",
                          color: durationMin === d ? "#04201c" : "rgba(255,255,255,0.7)",
                        }}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-sm text-white/50">
                  {type === "guiada" ? "Meditación guiada" : "Meditación libre"}
                </p>
              </GlassCard>
            )}

            <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-white/80">Sonidos ambientales</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {SOUNDS.map((s) => {
                  const active = s.id in activeSounds;
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSound(s.id)}
                      className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-colors cursor-pointer"
                      style={{
                        background: active ? "var(--paz-mental)22" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "var(--paz-mental)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      <s.icon size={20} style={{ color: active ? "var(--paz-mental)" : "rgba(255,255,255,0.5)" }} />
                      <span className="text-[11px] text-white/60">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              {Object.keys(activeSounds).length > 0 && (
                <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
                  {Object.entries(activeSounds).map(([id, vol]) => {
                    const s = SOUNDS.find((snd) => snd.id === id)!;
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <s.icon size={16} style={{ color: "var(--paz-mental)" }} />
                        <span className="text-xs text-white/60 w-16">{s.label}</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={vol}
                          onChange={(e) =>
                            setActiveSounds((prev) => ({ ...prev, [id]: Number(e.target.value) }))
                          }
                          className="flex-1 accent-[var(--paz-mental)]"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            <div className="flex items-center justify-center gap-3">
              {!running ? (
                <GlassButton accentColor="var(--paz-mental)" size="lg" onClick={handleStart}>
                  <Play size={18} /> Iniciar
                </GlassButton>
              ) : (
                <>
                  <GlassButton accentColor="var(--paz-mental)" variant="outline" size="lg" onClick={handlePauseToggle}>
                    {paused ? <Play size={18} /> : <Pause size={18} />} {paused ? "Reanudar" : "Pausar"}
                  </GlassButton>
                  <GlassButton accentColor="#ef4444" variant="outline" size="lg" onClick={handleStop}>
                    <Square size={18} /> Terminar
                  </GlassButton>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
