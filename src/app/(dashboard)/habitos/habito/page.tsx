"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { BigCheck } from "@/components/habitos/big-check";
import { HabitWeekStrip } from "@/components/habitos/habit-week-strip";
import { CreateHabitModal } from "@/components/habitos/create-habit-modal";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

// Textura de grano sutil del fondo (referencia: fondo gris oscuro granulado).
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.07'/></svg>\")";

function HabitScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const habits = useHabitsStore((s) => s.habits);
  const addHabit = useHabitsStore((s) => s.addHabit);
  const [createOpen, setCreateOpen] = useState(false);

  const today = todayISO();
  const habit = habits.find((h) => h.id === params.get("id")) ?? habits[0];
  const done = habit ? habit.completedDates.includes(today) : false;

  return (
    // z-[45]: por encima del BottomNav (z-40) para que la pantalla sea
    // completa como en la referencia, pero por debajo de los modales (z-50).
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white select-none"
      style={{ backgroundColor: "#1c1c1c", backgroundImage: NOISE }}
    >
      <div className="flex justify-center pt-[max(env(safe-area-inset-top),8px)]">
        <button
          onClick={() => router.push("/habitos")}
          aria-label="Volver a Hábitos"
          className="w-12 h-6 flex items-center justify-center text-white/40 cursor-pointer"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      <header className="flex items-center justify-between px-5 h-12">
        <button
          onClick={() => setCreateOpen(true)}
          aria-label="Nuevo hábito"
          className="w-10 h-10 flex items-center justify-center cursor-pointer"
        >
          <Plus size={30} strokeWidth={2.6} />
        </button>
        <h1
          className={`flex-1 text-center text-[15px] uppercase tracking-[0.12em] truncate px-2 ${done ? "line-through" : ""}`}
          style={MONO}
        >
          {habit?.name ?? "Sin hábitos"}
        </h1>
        {/* El detalle del hábito (progreso, horario, configuración) se
            conecta en la Fase 12 — hasta entonces el botón queda inerte. */}
        <button aria-label="Detalle del hábito" className="w-10 h-10 flex items-center justify-center cursor-pointer">
          <SlidersHorizontal size={26} strokeWidth={2.4} />
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        {habit ? (
          // Círculo principal. La interacción (mantener presionado para
          // completar) se agrega en la Fase 3.
          <HabitOrb done={done} className="w-[68vw] max-w-[340px]">
            {done ? (
              <BigCheck size={170} />
            ) : (
              <span className="px-8 text-center text-[34px] font-extrabold leading-[1.02] tracking-tight line-clamp-3 break-words">
                {habit.name}
              </span>
            )}
          </HabitOrb>
        ) : (
          <button onClick={() => setCreateOpen(true)} className="w-[68vw] max-w-[340px] cursor-pointer">
            <HabitOrb className="w-full">
              <span className="text-lg font-bold text-white/70">Crea tu primer hábito</span>
            </HabitOrb>
          </button>
        )}
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px]">
        {habit && <HabitWeekStrip completedDates={habit.completedDates} todayISO={today} />}
      </div>

      <CreateHabitModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => addHabit(input)}
      />
    </div>
  );
}

export default function HabitPage() {
  return (
    <Suspense fallback={null}>
      <HabitScreen />
    </Suspense>
  );
}
