"use client";

/**
 * Pantalla de una sesión de Kegel (referencia del usuario): cuenta regresiva grande, anillo de segmentos con el dibujo
 * anatómico, indicador de fase (CONTRAE / SUELTA…), onda de los próximos ciclos, barra de avance y vibración.
 * Arranca sola al entrar; tocar el círculo pausa/reanuda. Al llegar a 0 la sesión queda cumplida y se vuelve al plan.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { KegelSessionDef } from "@/lib/gym/kegel-plan";
import { useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { useGymStore } from "@/lib/store/gymStore";
import { emitProgressEvent } from "@/lib/progress/event-bus";

const SEGMENTS = 60;
const WAVE_W = 300;
const WAVE_H = 110;
const CYCLES_SHOWN = 3;

/** Nivel (0–1) de la onda en el instante `t` (s): suaviza entre los centros de cada fase. */
function levelAt(def: KegelSessionDef, t: number): number {
  const cycle = def.phases.reduce((a, p) => a + p.seconds, 0);
  const centers: { c: number; amp: number }[] = [];
  for (let k = -2; k <= CYCLES_SHOWN + 2; k++) {
    let acc = 0;
    for (const p of def.phases) {
      centers.push({ c: k * cycle + acc + p.seconds / 2, amp: p.amp });
      acc += p.seconds;
    }
  }
  let i = 0;
  while (i < centers.length - 2 && centers[i + 1].c <= t) i++;
  const a = centers[i];
  const b = centers[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.c) / (b.c - a.c)));
  const e = (1 - Math.cos(Math.PI * f)) / 2;
  return a.amp + (b.amp - a.amp) * e;
}

export function KegelSessionScreen({ def }: { def: KegelSessionDef }) {
  const router = useRouter();
  const markCompleted = useKegelPlanStore((s) => s.markCompleted);
  const completeKegelSession = useGymStore((s) => s.completeKegelSession);

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [vibration, setVibration] = useState(true);

  const finished = elapsed >= def.durationSec;
  const remaining = Math.max(0, Math.ceil(def.durationSec - elapsed));

  const cycle = useMemo(() => def.phases.reduce((a, p) => a + p.seconds, 0), [def]);
  const windowSec = cycle * CYCLES_SHOWN;
  // La onda arranca en el centro de la última fase (un valle en CONTRAE/SUELTA), como en la referencia.
  const lastPhase = def.phases[def.phases.length - 1];
  const s0 = -lastPhase.seconds / 2;

  let phaseIdx = 0;
  {
    const t = elapsed % cycle;
    let acc = 0;
    for (let i = 0; i < def.phases.length; i++) {
      if (t < acc + def.phases[i].seconds) {
        phaseIdx = i;
        break;
      }
      acc += def.phases[i].seconds;
    }
  }
  const phase = def.phases[phaseIdx];

  useEffect(() => {
    if (paused || finished) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setElapsed((e) => Math.min(def.durationSec, e + dt));
    }, 100);
    return () => clearInterval(id);
  }, [paused, finished, def]);

  useEffect(() => {
    if (!vibration || paused || finished || elapsed === 0) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(phase.amp > 0.5 ? 60 : 25);
    // Solo al cambiar de fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  useEffect(() => {
    if (!finished) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const alreadyToday = (useKegelPlanStore.getState().completed[today] ?? []).length > 0;
    markCompleted(today, def.id);
    // El resumen de racha/nivel de Gym cuenta una vez por día (la primera sesión cumplida).
    if (!alreadyToday) completeKegelSession();
    emitProgressEvent("kegel.completed", `kegel:${today}:${def.id}`, { sessionId: def.id, durationSeconds: def.durationSec });
    const id = setTimeout(() => router.replace("/gym/kegel"), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ---- onda ----
  const wavePath = useMemo(() => {
    const pts: string[] = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const t = s0 + (i / n) * windowSec;
      const y = WAVE_H - 6 - levelAt(def, t) * (WAVE_H - 24);
      pts.push(`${i === 0 ? "M" : "L"}${((i / n) * WAVE_W).toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [def, s0, windowSec]);

  const labels = useMemo(() => {
    const out: { x: number; text: string; high: boolean }[] = [];
    for (let k = 0; k < CYCLES_SHOWN + 1; k++) {
      let acc = 0;
      for (const p of def.phases) {
        const c = k * cycle + acc + p.seconds / 2;
        const x = ((c - s0) / windowSec) * WAVE_W;
        if (x > 8 && x < WAVE_W - 8) out.push({ x, text: p.label, high: p.amp > 0.5 });
        acc += p.seconds;
      }
    }
    return out;
  }, [def, cycle, s0, windowSec]);

  const cursorX = (((elapsed - s0) % windowSec) / windowSec) * WAVE_W;
  const cursorY = WAVE_H - 6 - levelAt(def, s0 + (cursorX / WAVE_W) * windowSec) * (WAVE_H - 24);
  const progress = Math.min(1, elapsed / def.durationSec);
  const contracted = phase.amp > 0.5;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col text-white select-none overflow-y-auto app-bg">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.push("/gym/kegel")}
          aria-label="Volver"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">Kegel</h1>
        <span className="w-10 h-10 -mr-2 flex items-center justify-center" aria-hidden>
          <SlidersHorizontal size={22} strokeWidth={2.2} />
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-[max(env(safe-area-inset-bottom),18px)] max-w-md w-full mx-auto">
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-[17px] tracking-wide" style={MONO_FONT}>
            HOY
          </span>
          <span className="text-[68px] font-bold leading-none tracking-tight tabular-nums">{remaining} sec</span>
        </div>

        {/* Anillo + dibujo */}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Reanudar" : "Pausar"}
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
                    opacity: paused ? 0.7 : 1,
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
                transition={{ duration: paused ? 0 : phase.seconds, ease: "easeInOut" }}
              >
                <path d="M46 72 Q 68 88 92 68" stroke="#ef4444" strokeWidth="3" />
              </motion.g>
            </svg>
          </div>
        </button>

        <div className="flex flex-col items-center gap-3 w-full">
          <span
            className="px-7 py-2 rounded-full bg-white text-black text-[17px] font-bold tracking-wider"
            style={MONO_FONT}
          >
            {paused ? "PAUSA" : phase.label}
          </span>

          <div className="w-full flex flex-col gap-2 text-[15px] tracking-wide mt-1" style={MONO_FONT}>
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap">CONTRAE Y SOSTÉN</span>
              <span className="flex-1 h-px bg-white/70" />
              <svg viewBox="0 0 40 16" className="w-9 h-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M3 3 Q 20 22 37 3" />
              </svg>
            </div>
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap">CONTRAE Y RELAJA</span>
              <span className="flex-1 h-px bg-white/70" />
              <svg viewBox="0 0 40 16" className="w-9 h-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12 L 9 4 L 15 12 L 21 4 L 27 12 L 33 4 L 37 8" />
              </svg>
            </div>
          </div>
        </div>

        <span
          className="px-6 py-1.5 rounded-full bg-white text-black text-[15px] font-bold tracking-wider mt-4"
          style={MONO_FONT}
        >
          {phase.label}
        </span>

        {/* Onda */}
        <div className="relative w-full mt-3" style={{ maxWidth: 360 }}>
          <svg viewBox={`-2 -22 ${WAVE_W + 40} ${WAVE_H + 46}`} className="w-full overflow-visible">
            <line x1="0" y1="-14" x2="0" y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            <line x1="0" y1={WAVE_H - 2} x2={WAVE_W} y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            <line x1={WAVE_W} y1="-14" x2={WAVE_W} y2={WAVE_H - 2} stroke="#fff" strokeWidth="1" />
            {labels
              .filter((l) => !l.high)
              .map((l, i) => (
                <line key={i} x1={l.x} y1="-14" x2={l.x} y2={WAVE_H - 2} stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeDasharray="4 4" />
              ))}
            <path d={wavePath} stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            <circle cx={cursorX} cy={cursorY} r="4.5" fill="#fff" />
            {labels.map((l, i) => (
              <text
                key={i}
                x={l.x}
                y={l.high ? -6 : WAVE_H + 14}
                textAnchor="middle"
                fontSize="10.5"
                fill="#fff"
                style={MONO_FONT}
              >
                {l.text}
              </text>
            ))}
            {[
              { v: "10", y: -6 },
              { v: "5", y: WAVE_H / 2 - 2 },
              { v: "2", y: WAVE_H - 20 },
              { v: "0", y: WAVE_H - 2 },
            ].map((t) => (
              <text key={t.v} x={WAVE_W + 10} y={t.y + 4} fontSize="10.5" fill="#fff" style={MONO_FONT}>
                {t.v}
              </text>
            ))}
          </svg>
        </div>

        {/* Barra de avance */}
        <div className="relative w-full h-[18px] mt-4" aria-hidden>
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[8px] rounded-full" style={{ background: "#3a3a3d" }} />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="absolute top-1/2 w-[3px] h-[3px] -mt-[1.5px] rounded-full bg-white/80"
              style={{ left: `calc(8px + (100% - 16px) * ${i / 7})` }}
            />
          ))}
          <span
            className="absolute top-1/2 w-[20px] h-[20px] -mt-[10px] rounded-full bg-white"
            style={{ left: `calc((100% - 20px) * ${progress})`, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
          />
        </div>

        {/* Vibración */}
        <div className="flex items-center gap-3 mt-4 pb-1">
          <button
            onClick={() => setVibration((v) => !v)}
            role="switch"
            aria-checked={vibration}
            aria-label="Vibración"
            className="relative w-[78px] h-[42px] rounded-full cursor-pointer transition-colors"
            style={{ background: vibration ? "#3a3a3d" : "#232325" }}
          >
            <span
              className="absolute top-[5px] w-[32px] h-[32px] rounded-full bg-white transition-all"
              style={{ left: vibration ? 41 : 5, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
            />
          </button>
          <span className="text-[16px] tracking-wide" style={MONO_FONT}>
            VIBRACIÓN
          </span>
        </div>
      </div>
    </div>
  );
}
