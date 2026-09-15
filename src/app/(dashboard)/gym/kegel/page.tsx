"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { useGymStore } from "@/lib/store/gymStore";

const TOTAL_REPS = 10;
type Phase = "idle" | "squeeze" | "release" | "done";

export default function KegelPage() {
  const kegelLevel = useGymStore((s) => s.kegelLevel);
  const kegelStreak = useGymStore((s) => s.kegelStreak);
  const completeKegelSession = useGymStore((s) => s.completeKegelSession);

  const [sessionActive, setSessionActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rep, setRep] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const squeezeMs = (3 + kegelLevel * 0.2) * 1000; // 3.2s - 5s
  const releaseMs = 3000;

  useEffect(() => {
    if (!sessionActive) return;
    if (phase === "squeeze") {
      timeoutRef.current = setTimeout(() => setPhase("release"), squeezeMs);
    } else if (phase === "release") {
      timeoutRef.current = setTimeout(() => {
        if (rep + 1 >= TOTAL_REPS) {
          setPhase("done");
        } else {
          setRep((r) => r + 1);
          setPhase("squeeze");
        }
      }, releaseMs);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionActive]);

  useEffect(() => {
    if (phase !== "done") return;
    const id = setTimeout(() => {
      completeKegelSession();
      setSessionActive(false);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function startSession() {
    setRep(0);
    setPhase("squeeze");
    setSessionActive(true);
  }

  function stopSession() {
    setSessionActive(false);
    setPhase("idle");
    setRep(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBackdrop src="/backgrounds/kegel.webp" />

      {/* `relative`: sin position, estos hijos se pintan debajo del
      PageBackdrop (fixed) sin importar el orden en el DOM. */}
      <div className="relative flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles style={{ color: "var(--paz-mental)" }} /> Kegel
        </h1>
      </header>

      {!sessionActive ? (
        <>
          <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-3">
            <p className="text-sm text-white/60">Nivel actual</p>
            <p className="text-2xl font-bold">Nivel {kegelLevel} / 10</p>
            <ProgressBar value={kegelLevel} max={10} color="var(--paz-mental)" />
          </GlassCard>

          <GlassCard accentColor="#f97316" glow className="flex items-center gap-4">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0"
              style={{ background: "#f9731622", animation: "flame-flicker 1.6s ease-in-out infinite" }}
            >
              <Flame size={26} style={{ color: "#f97316" }} />
            </div>
            <div>
              <p className="text-sm text-white/55">Racha actual</p>
              <p className="text-2xl font-bold">{kegelStreak} días</p>
            </div>
          </GlassCard>

          <GlassButton accentColor="var(--paz-mental)" size="lg" onClick={startSession} className="self-center">
            Iniciar sesión
          </GlassButton>
        </>
      ) : (
        <div className="flex flex-col items-center gap-8 py-6">
          <p className="text-sm text-white/50">
            Repetición {Math.min(rep + 1, TOTAL_REPS)} de {TOTAL_REPS}
          </p>

          <div className="relative w-56 h-56 flex items-center justify-center">
            <motion.div
              className="absolute rounded-full"
              style={{
                background:
                  "radial-gradient(circle, var(--paz-mental) 0%, transparent 72%)",
              }}
              animate={{
                width: phase === "squeeze" ? 224 : 120,
                height: phase === "squeeze" ? 224 : 120,
                opacity: phase === "squeeze" ? 0.9 : 0.5,
              }}
              transition={{
                duration: (phase === "squeeze" ? squeezeMs : releaseMs) / 1000,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="rounded-full border-2"
              style={{ borderColor: "var(--paz-mental)" }}
              animate={{
                width: phase === "squeeze" ? 200 : 100,
                height: phase === "squeeze" ? 200 : 100,
              }}
              transition={{
                duration: (phase === "squeeze" ? squeezeMs : releaseMs) / 1000,
                ease: "easeInOut",
              }}
            />
          </div>

          <p className="text-xl font-semibold text-white">
            {phase === "squeeze" ? "Aprieta" : phase === "release" ? "Suelta" : "¡Listo!"}
          </p>

          <GlassButton variant="outline" accentColor="var(--paz-mental)" onClick={stopSession}>
            Detener sesión
          </GlassButton>
        </div>
      )}
      </div>
    </div>
  );
}
