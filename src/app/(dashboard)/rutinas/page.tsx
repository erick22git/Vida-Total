"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Flame, ListChecks, Plus } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { useHabitsStore, todayISO } from "@/lib/store/habitsStore";
import { routineProgressOn } from "@/lib/routine-utils";

export default function RutinasHubPage() {
  const routines = useHabitsStore((s) => s.routines);
  const habits = useHabitsStore((s) => s.habits);
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/habitos" className="text-white/50 hover:text-white transition-colors shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ListChecks style={{ color: "var(--rutinas)" }} /> Rutinas
          </h1>
        </div>
        <Link
          href="/rutinas/nueva"
          className="flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-semibold text-white shrink-0 cursor-pointer"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <Plus size={14} /> Nueva
        </Link>
      </header>

      {routines.length === 0 ? (
        <GlassCard accentColor="var(--rutinas)" className="flex flex-col items-center gap-2 py-10 text-center">
          <ListChecks size={28} className="text-white/25" />
          <p className="text-sm text-white/60">Todavía no tenés ninguna rutina.</p>
          <p className="text-xs text-white/40 max-w-xs">
            Una rutina es una secuencia con horario — cada paso puede estar vinculado a uno de tus hábitos.
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {routines.map((r) => {
            const { done, total } = routineProgressOn(r, habits, today);
            return (
              <Link key={r.id} href={`/rutinas/${r.id}`}>
                <GlassCard accentColor="var(--rutinas)" className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0"
                    style={{ background: "var(--rutinas)22" }}
                  >
                    <ListChecks size={19} style={{ color: "var(--rutinas)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.nombre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-white/45">
                        {done}/{total} pasos hoy
                      </span>
                      {r.streak > 0 && (
                        <span className="flex items-center gap-1 text-xs text-white/45">
                          <Flame size={11} className="text-orange-400" /> {r.streak} día{r.streak !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 shrink-0" />
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
