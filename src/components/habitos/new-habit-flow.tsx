"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Minus, Plus, X } from "lucide-react";
import { HABIT_CATEGORIES } from "@/lib/data/habit-categories";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import { playSound } from "@/lib/sound/sound-engine";
import { haptic } from "@/lib/haptics/haptic";
import type { Habit, HabitType } from "@/lib/types/habits";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"]; // 0 = domingo
const TIME_PRESETS = [5, 10, 20, 30, 60];
const STEPS = 4;

export type NewHabitInput = Pick<
  Habit,
  "name" | "icon" | "color" | "frequency" | "categoryId" | "type" | "goal" | "unit" | "scheduledDays" | "reminder"
>;

const TYPE_OPTIONS: { id: HabitType; label: string; hint: string }[] = [
  { id: "binario", label: "Sí / No", hint: "Meditar, ir al gym" },
  { id: "cantidad", label: "Cantidad", hint: "5 / 8 vasos" },
  { id: "tiempo", label: "Tiempo", hint: "20 / 30 minutos" },
];

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

/**
 * Crear un hábito como experiencia progresiva de pantalla completa (no un
 * formulario): nombre → objetivo → frecuencia → recordatorio → crear. Cada
 * paso muestra UNA sola decisión. Referencia: "Start a new habit" de Not
 * Boring Habits (título, consejo, nombre grande, fondo difuso).
 */
export function NewHabitFlow({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewHabitInput) => void;
}) {
  const reduceMotion = useEffectiveReduceMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("binario");
  const [goal, setGoal] = useState(8);
  const [unit, setUnit] = useState("vasos");
  const [minutes, setMinutes] = useState(20);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [specificDays, setSpecificDays] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [reminder, setReminder] = useState("20:00");

  function reset() {
    setStep(0);
    setDir(1);
    setName("");
    setType("binario");
    setGoal(8);
    setUnit("vasos");
    setMinutes(20);
    setCategoryId(null);
    setSpecificDays(false);
    setDays([1, 2, 3, 4, 5]);
    setReminder("20:00");
  }

  function close() {
    reset();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canContinue = step === 0 ? name.trim().length > 0 : step === 2 ? !specificDays || days.length > 0 : true;

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
    playSound("navigation");
    haptic("light");
  }

  function next() {
    if (!canContinue) return;
    if (step < STEPS - 1) go(step + 1);
  }

  function create(withReminder: boolean) {
    const category = HABIT_CATEGORIES.find((c) => c.id === categoryId);
    onCreate({
      name: name.trim(),
      icon: category?.icon ?? "Star",
      color: category?.color ?? "var(--habitos)",
      categoryId: category?.id,
      type,
      goal: type === "cantidad" ? goal : type === "tiempo" ? minutes : undefined,
      unit: type === "cantidad" ? unit.trim() || "veces" : type === "tiempo" ? "min" : undefined,
      // "Días específicos" se modela como frecuencia semanal (la racha cuenta
      // semanas con al menos un cumplimiento) — la racha diaria se rompería
      // cada día no programado.
      frequency: specificDays ? "semanal" : "diario",
      scheduledDays: specificDays ? [...days].sort() : undefined,
      reminder: withReminder && reminder ? reminder : undefined,
    });
    playSound("complete");
    haptic("success");
    close();
  }

  const slide = {
    enter: (d: number) => ({ x: reduceMotion ? 0 : d * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduceMotion ? 0 : d * -60, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col text-white overflow-hidden"
          style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="relative flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)] h-14">
            <button
              onClick={() => (step > 0 ? go(step - 1) : close())}
              aria-label={step > 0 ? "Paso anterior" : "Cerrar"}
              className="w-10 h-10 flex items-center justify-center cursor-pointer text-white/70"
            >
              {step > 0 ? <ChevronLeft size={26} /> : <X size={24} />}
            </button>
            <span className="text-[12px] tracking-[0.2em] text-white/45" style={MONO}>
              {step + 1} / {STEPS}
            </span>
            <button onClick={close} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center cursor-pointer text-white/70">
              {step > 0 ? <X size={22} /> : null}
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="absolute inset-0 flex flex-col items-center px-6 overflow-y-auto"
              >
                {step === 0 && (
                  <div className="w-full max-w-[420px] flex flex-col items-center gap-4 pt-10">
                    <h2 className="text-[34px] font-black uppercase leading-none tracking-tight text-center">Empieza un nuevo hábito</h2>
                    <p className="text-[12px] uppercase tracking-[0.12em] text-white/55 text-center leading-relaxed" style={MONO}>
                      Consejo: piensa en pequeño. Empieza con 1 minuto, 1 página, 1 vaso…
                    </p>
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      enterKeyHint="next"
                      maxLength={40}
                      placeholder="Leer"
                      aria-label="Nombre del hábito"
                      className="mt-8 w-full bg-transparent text-center text-[44px] font-black leading-tight outline-none placeholder:text-white/20 caret-white"
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="w-full max-w-[420px] flex flex-col gap-6 pt-6">
                    <h2 className="text-[30px] font-black uppercase leading-none tracking-tight text-center">Objetivo</h2>
                    <div className="flex flex-col gap-2">
                      {TYPE_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setType(o.id)}
                          className="flex items-baseline justify-between rounded-2xl px-5 py-3.5 cursor-pointer text-left"
                          style={{
                            background: type === o.id ? "#fff" : "rgba(255,255,255,0.07)",
                            color: type === o.id ? "#000" : "#fff",
                          }}
                        >
                          <span className="text-[17px] font-bold">{o.label}</span>
                          <span className="text-[11px] uppercase tracking-wider opacity-60" style={MONO}>
                            {o.hint}
                          </span>
                        </button>
                      ))}
                    </div>

                    {type === "cantidad" && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-6">
                          <Stepper onClick={() => setGoal((g) => Math.max(1, g - 1))} label="Menos"><Minus size={20} /></Stepper>
                          <span className="text-[56px] font-black tabular-nums leading-none w-24 text-center">{goal}</span>
                          <Stepper onClick={() => setGoal((g) => Math.min(999, g + 1))} label="Más"><Plus size={20} /></Stepper>
                        </div>
                        <input
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          maxLength={14}
                          aria-label="Unidad"
                          className="bg-transparent text-center text-[18px] font-bold outline-none border-b border-white/25 w-40 pb-1"
                        />
                      </div>
                    )}

                    {type === "tiempo" && (
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-[56px] font-black tabular-nums leading-none">
                          {minutes}
                          <span className="text-[18px] ml-1 text-white/60">min</span>
                        </span>
                        <div className="flex flex-wrap justify-center gap-2">
                          {TIME_PRESETS.map((m) => (
                            <button
                              key={m}
                              onClick={() => setMinutes(m)}
                              className="px-4 py-2 rounded-full text-[14px] cursor-pointer"
                              style={{ ...MONO, background: minutes === m ? "#fff" : "rgba(255,255,255,0.08)", color: minutes === m ? "#000" : "#fff" }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/45 text-center" style={MONO}>
                        Categoría (opcional)
                      </span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {HABIT_CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
                            className="px-3 py-1.5 rounded-full text-[12px] cursor-pointer"
                            style={{
                              background: categoryId === c.id ? c.color : "rgba(255,255,255,0.08)",
                              color: categoryId === c.id ? "#000" : "#fff",
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="w-full max-w-[420px] flex flex-col gap-6 pt-6">
                    <h2 className="text-[30px] font-black uppercase leading-none tracking-tight text-center">Frecuencia</h2>
                    <div className="flex flex-col gap-2">
                      {[
                        { v: false, label: "Todos los días" },
                        { v: true, label: "Días específicos" },
                      ].map((o) => (
                        <button
                          key={String(o.v)}
                          onClick={() => setSpecificDays(o.v)}
                          className="rounded-2xl px-5 py-3.5 text-left text-[17px] font-bold cursor-pointer"
                          style={{
                            background: specificDays === o.v ? "#fff" : "rgba(255,255,255,0.07)",
                            color: specificDays === o.v ? "#000" : "#fff",
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {specificDays && (
                      <div className="flex justify-between">
                        {DAY_LETTERS.map((l, i) => {
                          const on = days.includes(i);
                          return (
                            <button
                              key={i}
                              onClick={() => setDays((cur) => (on ? cur.filter((d) => d !== i) : [...cur, i]))}
                              aria-pressed={on}
                              aria-label={["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][i]}
                              className="w-10 h-10 rounded-full text-[14px] cursor-pointer"
                              style={{ ...MONO, background: on ? "#f5b301" : "rgba(255,255,255,0.08)", color: on ? "#000" : "#fff" }}
                            >
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="w-full max-w-[420px] flex flex-col items-center gap-6 pt-6">
                    <h2 className="text-[30px] font-black uppercase leading-none tracking-tight text-center">Recordatorio</h2>
                    <input
                      type="time"
                      value={reminder}
                      onChange={(e) => setReminder(e.target.value)}
                      aria-label="Hora del recordatorio"
                      className="bg-white/10 rounded-2xl px-6 py-4 text-[44px] font-black tabular-nums text-center outline-none [color-scheme:dark]"
                    />
                    <p className="text-[12px] text-white/45 text-center" style={MONO}>
                      Se guarda la hora. Los avisos en el celular todavía no están activos.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-3 flex flex-col gap-2 items-center">
            {step < STEPS - 1 ? (
              <button
                onClick={next}
                disabled={!canContinue}
                className="w-full max-w-[420px] h-14 rounded-full bg-white text-black text-[17px] font-bold cursor-pointer disabled:opacity-25 disabled:cursor-default transition-opacity"
              >
                Continuar
              </button>
            ) : (
              <>
                <button
                  onClick={() => create(true)}
                  className="w-full max-w-[420px] h-14 rounded-full bg-white text-black text-[17px] font-bold cursor-pointer"
                >
                  Crear hábito
                </button>
                <button onClick={() => create(false)} className="h-10 text-[14px] text-white/60 cursor-pointer" style={MONO}>
                  Omitir recordatorio
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stepper({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      style={{ background: "rgba(255,255,255,0.1)" }}
    >
      {children}
    </button>
  );
}
