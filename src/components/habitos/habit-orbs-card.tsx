"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Habit } from "@/lib/types/habits";
import { HabitOrb } from "@/components/habitos/habit-orb";
import { BigCheck } from "@/components/habitos/big-check";

/** Ruta de la experiencia individual de un hábito. */
export function habitHref(id: string) {
  return `/habitos/habito?id=${encodeURIComponent(id)}`;
}

/**
 * Una sola card con las esferas de los hábitos (referencia: Not Boring
 * Habits, "card de hábitos"). Cada esfera es un botón real: tocarla abre
 * directamente la experiencia de ESE hábito.
 */
export function HabitOrbsCard({
  habits,
  todayISO,
  onCreate,
}: {
  habits: Habit[];
  todayISO: string;
  onCreate: () => void;
}) {
  const router = useRouter();
  // Los pendientes van primero; los que ya se completaron hoy pasan al final
  // (en blanco, con check), así al recorrer la card se ven primero los que
  // todavía faltan. `sort` es estable: se conserva el orden original dentro
  // de cada grupo.
  const ordered = [...habits].sort(
    (a, b) => Number(a.completedDates.includes(todayISO)) - Number(b.completedDates.includes(todayISO)),
  );

  return (
    <div
      className="rounded-[28px] p-3"
      style={{
        background: "linear-gradient(180deg, #2a2a2a 0%, #1f1f1f 100%)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.04), 0 12px 30px rgba(0,0,0,0.45)",
      }}
    >
      {/* Con 3 esferas ocupan justo el ancho (como en la referencia); con más,
          la fila se desliza en horizontal. */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1 py-1">
        {ordered.map((h) => {
          const done = h.completedDates.includes(todayISO);
          return (
            <motion.button
              key={h.id}
              layout="position"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              onClick={() => router.push(habitHref(h.id))}
              aria-label={`Abrir ${h.name}${done ? " (completado hoy)" : ""}`}
              className="snap-start shrink-0 basis-[calc((100%-1.5rem)/3)] min-w-[92px] cursor-pointer active:scale-95 transition-transform"
            >
              <HabitOrb done={done}>
                {done ? (
                  <BigCheck size={62} />
                ) : (
                  <span
                    className="px-2 text-center font-mono uppercase text-[10px] leading-tight tracking-wider text-white line-clamp-2 break-words"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {h.name}
                  </span>
                )}
              </HabitOrb>
            </motion.button>
          );
        })}
        <button
          onClick={onCreate}
          aria-label="Nuevo hábito"
          className="snap-start shrink-0 basis-[calc((100%-1.5rem)/3)] min-w-[92px] cursor-pointer active:scale-95 transition-transform"
        >
          <HabitOrb className="opacity-60">
            <Plus size={22} className="text-white/70" />
          </HabitOrb>
        </button>
      </div>
    </div>
  );
}
