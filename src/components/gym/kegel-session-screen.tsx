"use client";

/**
 * Pantalla de sesión Kegel — rediseño con motor de estados puro.
 *
 * DISEÑO:
 *  - Ícono ARRIBA (arriba-derecha): interruptor de señales (sonido + vibración).
 *  - Barra ABAJO: progreso real de la sesión (serie x/y · rep x/y · tiempo restante).
 *  - Anillo + dibujo siguen la fase actual.
 *  - Tocar el anillo pausa / reanuda.
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { localDayKey } from "@/lib/gym/kegel-dates";
import type { KegelSessionDef } from "@/lib/gym/kegel-plan";
import { useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { useGymStore } from "@/lib/store/gymStore";
import { emitProgressEvent } from "@/lib/progress/event-bus";
import { useKegelEngine, useWakeLock, PHASE_LABEL, PHASE_AMP } from "@/lib/gym/kegel-engine";
import { playSound, unlockAudio } from "@/lib/sound/sound-engine";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics/haptics";
import { isHapticSupported } from "@/lib/haptics/haptic";

const SEGMENTS = 60;
const WAVE_W = 300;
const WAVE_H = 110;

/** Nivel (0–1) de la onda en el instante `t` dado ciclo squeeze/relax. */
function waveAt(squeezeS: number, relaxS: number, t: number): number {
  const cycle = squeezeS + relaxS;
  const tMod = ((t % cycle) + cycle) % cycle;
  const f = tMod < squeezeS ? tMod / squeezeS : 1 - (tMod - squeezeS) / relaxS;
  return 0.15 + 0.85 * f;
}

export function KegelSessionScreen({ def }: { def: KegelSessionDef }) {
  const router = useRouter();
  const markCompleted = useKegelPlanStore((s) => s.markCompleted);
  const completeKegelSession = useGymStore((s) => s.completeKegelSession);

  const engine = useKegelEngine(def);
  const { state, totalDuration, progress } = engine;

  const [signalsOn, setSignalsOn] = useState(true);
  const [audioWarning, setAudioWarning] = useState(false);

  const prevPhase = useRef(state.phase);
  const completedRef = useRef(false);

  // Wake Lock mientras la sesión está activa
  const wakeLock = useWakeLock(state.phase !== "idle" && state.phase !== "done" && !state.paused);

  // Desbloquear audio en primer gesto
  function handleFirstGesture() {
    try {
      unlockAudio();
    } catch {
      setAudioWarning(true);
    }
  }

  // Señales al cambiar de fase
  useEffect(() => {
    if (prevPhase.current === state.phase) return;
    prevPhase.current = state.phase;
    if (!signalsOn) return;

    switch (state.phase) {
      case "prepare":
        playSound("kegel-countdown");
        break;
      case "squeeze":
        playSound("kegel-squeeze");
        vibrate(HAPTIC_PATTERNS.kegelSqueeze);
        break;
      case "relax":
        playSound("kegel-relax");
        vibrate(HAPTIC_PATTERNS.kegelRelax);
        break;
      case "rest":
        vibrate(HAPTIC_PATTERNS.kegelRelax);
        break;
      case "done":
        playSound("kegel-done");
        vibrate(HAPTIC_PATTERNS.kegelDone);
        break;
    }
  }, [state.phase, signalsOn]);

  // Completar sesión
  useEffect(() => {
    if (state.phase !== "done" || completedRef.current || state.partial) return;
    completedRef.current = true;
    const today = localDayKey();
    markCompleted(today, def.id);
    completeKegelSession();
    emitProgressEvent("kegel.completed", `kegel:${today}:${def.id}`, {
      sessionId: def.id,
      durationSeconds: def.durationSec,
    });
    const id = setTimeout(() => router.replace("/gym/kegel"), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Datos del ejercicio actual
  const ex = def.exercises[state.exerciseIndex] ?? def.exercises[0];
  const totalSets = ex?.sets ?? 1;
  const totalReps = ex?.reps ?? 1;
  const squeezeS = ex?.squeezeSeconds ?? 1;
  const relaxS = ex?.relaxSeconds ?? 1;

  // Tiempo restante en la fase actual
  const phaseRemaining = Math.max(0, Math.ceil(state.phaseDuration - state.phaseElapsed));
  // Tiempo total restante de la sesión
  const sessionRemaining = Math.max(0, Math.ceil(totalDuration * (1 - progress)));
  const contracted = PHASE_AMP[state.phase] > 0.5;

  // Onda de fondo (ciclo squeeze/relax del ejercicio actual)
  const wavePath = useMemo(() => {
    const n = 120;
    const windowSec = (squeezeS + relaxS) * 3;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * windowSec;
      const y = WAVE_H - 6 - waveAt(squeezeS, relaxS, t) * (WAVE_H - 24);
      pts.push(`${i === 0 ? "M" : "L"}${((i / n) * WAVE_W).toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [squeezeS, relaxS]);

  const phaseLabel = state.paused ? "PAUSA" : (PHASE_LABEL[state.phase] ?? state.phase.toUpperCase());
  const hapticAvailable = isHapticSupported();

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-y-auto app-bg"
      onPointerDown={handleFirstGesture}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => {
            if (state.phase !== "done") {
              engine.exit();
            }
            router.push("/gym/kegel");
          }}
          aria-label="Volver"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">{def.title}</h1>
        {/* Ícono de señales: interruptor sonido + vibración */}
        <button
          onClick={() => setSignalsOn((v) => !v)}
          aria-label={signalsOn ? "Silenciar señales" : "Activar señales"}
          aria-pressed={signalsOn}
          className="w-10 h-10 -mr-2 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          title={!hapticAvailable ? "Vibración no disponible en este dispositivo" : undefined}
        >
          {signalsOn
            ? <Volume2 size={22} strokeWidth={2.2} />
            : <VolumeX size={22} strokeWidth={2.2} className="opacity-50" />}
        </button>
      </header>

      {audioWarning && (
        <p className="text-center text-[13px] px-5 pb-1" style={{ color: "#aab4c8" }}>
          Toca la pantalla para activar el sonido
        </p>
      )}

      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-[max(env(safe-area-inset-bottom),18px)] max-w-md w-full mx-auto">
        {/* Tiempo restante en la fase */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-[17px] tracking-wide" style={MONO_FONT}>
            {phaseLabel}
          </span>
          <span className="text-[68px] font-bold leading-none tracking-tight tabular-nums">
            {phaseRemaining} sec
          </span>
        </div>

        {/* Anillo + dibujo anatómico */}
        <button
          onClick={() => state.paused ? engine.resume() : engine.pause()}
          aria-label={state.paused ? "Reanudar" : "Pausar"}
          className="relative w-[min(66vw,270px)] aspect-square rounded-full cursor-pointer my-3"
          style={{ border: "1.5px solid rgba(255,255,255,0.55)" }}
        >
          <div className="absolute inset-[7px] rounded-full">
            {Array.from({ length: SEGMENTS }, (_, i) => {
              const gone = i < Math.floor(progress * SEGMENTS);
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-0 h-[13%] w-[2.6%] -ml-[1.3%] origin-[50%_385%] rounded-[1px]"
                  style={{
                    transform: `rotate(${(i * 360) / SEGMENTS}deg)`,
                    transformOrigin: "50% 385%",
                    background: gone ? "rgba(255,255,255,0.28)" : "#fff",
                    opacity: state.paused ? 0.7 : 1,
                  }}
                />
              );
            })}
          </div>
          <div
            className="absolute inset-[15%] rounded-full flex items-center justify-center overflow-hidden"
            style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <svg viewBox="0 0 120 120" className="w-[88%] h-[88%]" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" strokeLinecap="round">
              <path d="M22 78 C 20 55, 34 40, 52 46" />
              <path d="M22 78 C 22 92, 40 100, 58 96 C 70 93, 80 88, 90 82" />
              <ellipse cx="34" cy="80" rx="8" ry="11" fill="rgba(255,255,255,0.14)" />
              <path d="M52 46 C 48 40, 56 32, 64 36 C 70 40, 66 50, 60 54 C 56 58, 58 64, 62 68" fill="rgba(255,255,255,0.14)" />
              <path d="M74 46 C 80 36, 92 34, 96 42 C 98 50, 92 56, 88 62 C 84 68, 92 74, 94 80" />
              <path d="M96 42 L 96 56" />
              <motion.g
                animate={{ y: contracted ? -7 : 2 }}
                transition={{ duration: state.paused ? 0 : (contracted ? squeezeS : relaxS), ease: "easeInOut" }}
              >
                <path d="M46 72 Q 68 88 92 68" stroke="#ef4444" strokeWidth="3" />
              </motion.g>
            </svg>
          </div>
        </button>

        {/* Etiqueta de fase */}
        <span
          className="px-7 py-2 rounded-full bg-white text-black text-[17px] font-bold tracking-wider"
          style={MONO_FONT}
        >
          {phaseLabel}
        </span>

        {/* Onda de ciclo */}
        <div className="relative w-full mt-3" style={{ maxWidth: 360 }}>
          <svg viewBox={`-2 -22 ${WAVE_W + 40} ${WAVE_H + 46}`} className="w-full overflow-visible">
            <line x1="0" y1="-14" x2="0" y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            <line x1="0" y1={WAVE_H - 2} x2={WAVE_W} y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            <line x1={WAVE_W} y1="-14" x2={WAVE_W} y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            <path d={wavePath} stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
          </svg>
        </div>

        {/* BARRA DE PROGRESO REAL — serie · rep · tiempo restante sesión */}
        <div className="w-full mt-4" aria-label="Progreso de la sesión">
          <div className="flex justify-between text-[13px] mb-2" style={{ ...MONO_FONT, color: "#aab4c8" }}>
            <span>SERIE {state.setIndex + 1}/{totalSets}</span>
            <span>REP {state.repIndex + 1}/{totalReps}</span>
            <span>{Math.floor(sessionRemaining / 60)}:{String(sessionRemaining % 60).padStart(2, "0")} restante</span>
          </div>
          <div className="relative w-full h-[18px]" aria-hidden>
            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[8px] rounded-full" style={{ background: "#3a3a3d" }} />
            <span
              className="absolute top-1/2 w-[20px] h-[20px] -mt-[10px] rounded-full bg-white"
              style={{ left: `calc((100% - 20px) * ${progress})`, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
            />
          </div>
        </div>

        {/* Info si Wake Lock no está disponible */}
        {!wakeLock.supported && (
          <p className="text-[12px] mt-2 opacity-40" style={MONO_FONT}>
            Mantén la pantalla activa manualmente
          </p>
        )}
      </div>
    </div>
  );
}
