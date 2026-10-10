"use client";

/**
 * Pantalla de sesión Kegel.
 *
 * DISEÑO (referencia del usuario, ver docs/diseno.md "Kegel"):
 *  - Header: salir (izq.) + "Sesión N" — SIN ícono de configuración acá (el de ajustes vive solo en
 *    la pantalla principal de Kegel).
 *  - Número grande: segundos restantes de TODA la sesión (no "HOY", eso era de la pantalla principal).
 *  - Anillo de cuadros: progreso de la FASE actual (no de toda la sesión) — gira en sentido horario y
 *    se reinicia en cada fase; blanco mientras se contrae, verde mientras se relaja.
 *  - Lista de las 9 series (scrolleable): qué viene ahora y después, "Contrae y sostén" / "Contrae y
 *    relaja" con su ícono — la serie activa resaltada y centrada en la vista automáticamente.
 *  - Botón de pausa (reemplaza al antiguo pill "CONTRAE").
 *  - Gráfica del ciclo de la serie ACTUAL (sin números de eje; "RELAJA"/"SOSTÉN" en vez de "SUELTA").
 *  - Volumen (de los tonos de esta sesión) y vibración — ambos editables acá mismo.
 *  - Tocar el anillo también pausa/reanuda (atajo, además del botón).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Pause, Play, Volume2 } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { localDayKey } from "@/lib/gym/kegel-dates";
import { SERIES_LABEL, type KegelSeriesKind, type KegelSessionDef } from "@/lib/gym/kegel-plan";
import { useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { useKegelSettingsStore } from "@/lib/store/kegelSettingsStore";
import { useGymStore } from "@/lib/store/gymStore";
import { emitProgressEvent } from "@/lib/progress/event-bus";
import { useKegelEngine, useWakeLock, PHASE_LABEL, PHASE_AMP, type EnginePhase } from "@/lib/gym/kegel-engine";
import { playSound, unlockAudio } from "@/lib/sound/sound-engine";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics/haptics";

const SEGMENTS = 28;
const GRAPH_W = 300;
const GRAPH_H = 84;

function SostenIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 14" width={16} height={12} aria-hidden style={{ color: active ? "#fff" : "rgba(255,255,255,0.35)" }}>
      <path d="M2 2 Q 10 14 18 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function RelajaIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 14" width={16} height={12} aria-hidden style={{ color: active ? "#fff" : "rgba(255,255,255,0.35)" }}>
      <path d="M1 7 Q 4 1 7 7 T 13 7 T 19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Reemplaza el "CONTRAE/SUELTA" genérico: el sostén se nombra distinto del apretón rápido. */
function phaseDisplayLabel(phase: EnginePhase, kind: KegelSeriesKind): string {
  if (phase === "squeeze") return kind === "sosten" ? "SOSTÉN" : "CONTRAE";
  if (phase === "relax") return "RELAJA";
  return PHASE_LABEL[phase];
}

export function KegelSessionScreen({ def }: { def: KegelSessionDef }) {
  const router = useRouter();
  const markCompleted = useKegelPlanStore((s) => s.markCompleted);
  const completeKegelSession = useGymStore((s) => s.completeKegelSession);
  const vibrationEnabled = useKegelSettingsStore((s) => s.vibrationEnabled);
  const setVibrationEnabled = useKegelSettingsStore((s) => s.setVibrationEnabled);
  const kegelVolume = useKegelSettingsStore((s) => s.kegelVolume);
  const setKegelVolume = useKegelSettingsStore((s) => s.setKegelVolume);

  const engine = useKegelEngine(def);
  const { state, totalDuration, progress } = engine;

  const [audioWarning, setAudioWarning] = useState(false);
  const prevPhase = useRef(state.phase);
  const completedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Wake Lock mientras la sesión está activa
  const wakeLock = useWakeLock(state.phase !== "idle" && state.phase !== "done" && !state.paused);

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
    switch (state.phase) {
      case "prepare":
        playSound("kegel-countdown", kegelVolume);
        break;
      case "squeeze":
        playSound("kegel-squeeze", kegelVolume);
        if (vibrationEnabled) vibrate(HAPTIC_PATTERNS.kegelSqueeze);
        break;
      case "relax":
        playSound("kegel-relax", kegelVolume);
        if (vibrationEnabled) vibrate(HAPTIC_PATTERNS.kegelRelax);
        break;
      case "rest":
        if (vibrationEnabled) vibrate(HAPTIC_PATTERNS.kegelRelax);
        break;
      case "done":
        playSound("kegel-done", kegelVolume);
        if (vibrationEnabled) vibrate(HAPTIC_PATTERNS.kegelDone);
        break;
    }
  }, [state.phase, vibrationEnabled, kegelVolume]);

  // Completar sesión — el festejo (check + sonido de "completado") vive en /gym/kegel, no acá.
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
    const id = setTimeout(() => router.replace(`/gym/kegel?done=${def.id}`), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const currentSeries = def.series[state.seriesIndex] ?? def.series[0];
  const phaseLabel = state.paused ? "PAUSA" : phaseDisplayLabel(state.phase, currentSeries.kind);
  const contracted = PHASE_AMP[state.phase] > 0.5;

  // Progreso 0–1 de la FASE actual (no de toda la sesión) — es lo que llena el anillo.
  const phaseProgress = state.phaseDuration > 0 ? Math.min(1, state.phaseElapsed / state.phaseDuration) : 0;
  const filledCount = Math.floor(phaseProgress * SEGMENTS);
  const ringColor = state.phase === "relax" ? "#34d399" : "#ffffff";

  const sessionRemaining = Math.max(0, Math.ceil(totalDuration * (1 - progress)));

  // Autoscroll: la serie activa siempre visible en la lista.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-series-index="${state.seriesIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state.seriesIndex]);

  // Onda de la serie ACTUAL: para "sostén" es un solo arco (8 s apretar + 6 s relajar); para "relaja"
  // son sus 15 pulsos rápidos (1 s + 1 s) uno tras otro — la forma cambia con la serie, no es fija.
  const graphPath = useMemo(() => {
    const { reps, squeezeSeconds: sq, relaxSeconds: rl } = currentSeries;
    const cycle = sq + rl;
    const totalT = cycle * reps;
    const n = Math.max(60, reps * 14);
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * totalT;
      const tMod = t % cycle;
      const f = tMod < sq ? tMod / sq : 1 - (tMod - sq) / rl;
      const y = GRAPH_H - 6 - (0.12 + 0.82 * f) * (GRAPH_H - 18);
      pts.push(`${i === 0 ? "M" : "L"}${((i / n) * GRAPH_W).toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [currentSeries]);

  function togglePause() {
    if (state.paused) engine.resume();
    else engine.pause();
  }

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-y-auto app-bg"
      onPointerDown={handleFirstGesture}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => {
            if (state.phase !== "done") engine.exit();
            router.push("/gym/kegel");
          }}
          aria-label="Salir"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">{def.title}</h1>
        {/* Sin ícono de configuración acá — solo existe en la pantalla principal de Kegel. */}
        <span className="w-10 h-10 -mr-2" aria-hidden />
      </header>

      {audioWarning && (
        <p className="text-center text-[13px] px-5 pb-1" style={{ color: "#aab4c8" }}>
          Toca la pantalla para activar el sonido
        </p>
      )}

      <div className="flex-1 flex flex-col items-center px-5 pb-[max(env(safe-area-inset-bottom),14px)] max-w-md w-full mx-auto gap-1.5">
        {/* Segundos restantes de TODA la sesión */}
        <span className="text-[58px] font-bold leading-none tracking-tight tabular-nums pt-1">
          {sessionRemaining}
          <span className="text-[20px] font-medium ml-1.5 align-top">sec</span>
        </span>

        {/* Anillo: progreso de la fase actual (blanco = contrae, verde = relaja), sentido horario, se reinicia cada fase. */}
        <button
          onClick={togglePause}
          aria-label={state.paused ? "Reanudar" : "Pausar"}
          className="relative w-[min(56vw,224px)] aspect-square rounded-full cursor-pointer my-0.5"
          style={{ border: "1.5px solid rgba(255,255,255,0.3)" }}
        >
          <div className="absolute inset-[6px] rounded-full">
            {Array.from({ length: SEGMENTS }, (_, i) => {
              const filled = i < filledCount;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-0 h-[11%] w-[3%] -ml-[1.5%] rounded-[1px]"
                  style={{
                    transform: `rotate(${(i * 360) / SEGMENTS}deg)`,
                    transformOrigin: "50% 400%",
                    background: filled ? ringColor : "rgba(255,255,255,0.18)",
                    opacity: state.paused ? 0.6 : 1,
                    transition: "background 0.15s linear",
                  }}
                />
              );
            })}
          </div>
          <div
            className="absolute inset-[16%] rounded-full flex items-center justify-center overflow-hidden"
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
                transition={{ duration: state.paused ? 0 : (contracted ? currentSeries.squeezeSeconds : currentSeries.relaxSeconds), ease: "easeInOut" }}
              >
                <path d="M46 72 Q 68 88 92 68" stroke="#ef4444" strokeWidth="3" />
              </motion.g>
            </svg>
          </div>
        </button>

        <span className="px-6 py-1.5 rounded-full bg-white text-black text-[15px] font-bold tracking-wider" style={MONO_FONT}>
          {phaseLabel}
        </span>

        {/* Las 9 series de la sesión: qué viene ahora y después. */}
        <div ref={listRef} className="w-full mt-1 flex flex-col overflow-y-auto" style={{ maxHeight: 118 }} aria-label="Series de la sesión">
          {def.series.map((s, i) => {
            const active = i === state.seriesIndex && state.phase !== "prepare" && state.phase !== "done";
            return (
              <div
                key={i}
                data-series-index={i}
                className="flex items-center justify-center gap-2 py-1.5 text-[12.5px] uppercase shrink-0"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.35)", fontWeight: active ? 700 : 400 }}
              >
                <span>{SERIES_LABEL[s.kind]}</span>
                <span className="w-6 h-px shrink-0" style={{ background: active ? "#fff" : "rgba(255,255,255,0.25)" }} />
                {s.kind === "sosten" ? <SostenIcon active={active} /> : <RelajaIcon active={active} />}
              </div>
            );
          })}
        </div>

        {/* Botón de pausa — reemplaza al antiguo pill "CONTRAE". */}
        <button
          onClick={togglePause}
          className="mt-0.5 px-8 py-2.5 rounded-full bg-white text-black flex items-center gap-2 text-[14px] font-bold cursor-pointer active:scale-95 transition-transform"
        >
          {state.paused ? (
            <>
              <Play size={16} fill="black" /> Reanudar
            </>
          ) : (
            <>
              <Pause size={16} fill="black" /> Pausa
            </>
          )}
        </button>

        {/* Gráfica del ciclo de la serie actual — sin números de eje. */}
        <div className="relative w-full mt-1" style={{ maxWidth: 320 }}>
          <div className="flex justify-between text-[10px] uppercase tracking-wide px-1 pb-1" style={{ ...MONO_FONT, color: "#aab4c8" }}>
            <span>{currentSeries.kind === "sosten" ? "SOSTÉN" : "CONTRAE"}</span>
            <span>RELAJA</span>
          </div>
          <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="w-full overflow-visible">
            <path d={graphPath} stroke="#fff" strokeWidth="2" fill="none" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Volumen de los tonos de esta sesión (además del interruptor general y el volumen físico). */}
        <div className="w-full mt-1 flex items-center gap-3">
          <Volume2 size={16} className="text-white/50 shrink-0" aria-hidden />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={kegelVolume}
            onChange={(e) => setKegelVolume(Number(e.target.value))}
            className="flex-1 accent-white"
            aria-label="Volumen de los tonos de Kegel"
          />
        </div>

        {/* Vibración */}
        <div className="w-full flex items-center justify-between py-1">
          <span className="text-[13px] tracking-wide text-white/70" style={MONO_FONT}>
            VIBRACIÓN
          </span>
          <button
            role="switch"
            aria-checked={vibrationEnabled}
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
            className="relative w-[46px] h-[26px] rounded-full transition-colors cursor-pointer"
            style={{ background: vibrationEnabled ? "#fff" : "#3a3a3d" }}
          >
            <span
              className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-transform"
              style={{ background: vibrationEnabled ? "#000" : "#888", transform: vibrationEnabled ? "translateX(23px)" : "translateX(3px)" }}
            />
          </button>
        </div>

        {!wakeLock.supported && (
          <p className="text-[11px] opacity-40 pb-1" style={MONO_FONT}>
            Mantén la pantalla activa manualmente
          </p>
        )}
      </div>
    </div>
  );
}
