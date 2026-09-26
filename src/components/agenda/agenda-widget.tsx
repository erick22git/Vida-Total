"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { occurrencesOn } from "@/lib/agenda/recurrence";
import { useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, taskProgress, timeRange, toISODate } from "@/lib/agenda/time";
import { useNow } from "@/lib/agenda/use-now";
import { haptic } from "@/lib/haptics/haptic";
import { TaskNode } from "./task-node";

/**
 * Widget de Hábitos que entra a la planificación del día: muestra las próximas tareas (una hecha y las que siguen)
 * con el mismo look que la pantalla completa. Sin tareas, invita a planificar el día.
 */
export function AgendaWidget() {
  const now = useNow(30_000);
  const tasks = useAgendaStore((s) => s.tasks);
  const toggleDoneOn = useAgendaStore((s) => s.toggleDoneOn);
  const today = toISODate(now);
  const rows = useMemo(() => {
    const sorted = occurrencesOn(tasks, today)
      .filter((t) => t.startMin !== null && !t.allDay)
      .sort((a, b) => a.startMin! - b.startMin!);
    const firstPending = sorted.findIndex((t) => !t.done);
    const from = firstPending > 0 ? firstPending - 1 : 0;
    return sorted.slice(from, from + 2);
  }, [tasks, today]);

  return (
    <Link href="/habitos/agenda" aria-label="Planificar el día" className="block rounded-[30px] overflow-hidden" style={{ background: "rgba(24,24,26,0.92)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}>
      {rows.length === 0 ? (
        <div className="flex items-center gap-4 px-5 py-6">
          <span className="flex items-center justify-center w-[46px] h-[46px] rounded-full" style={{ background: "#3d3d40" }}>
            <Plus size={22} strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-[19px] font-extrabold leading-tight">Planifica tu día</p>
            <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Toca para añadir tu primera tarea</p>
          </div>
        </div>
      ) : (
        <div className="relative px-5 py-4 flex flex-col gap-3">
          {rows.length > 1 && <span className="absolute w-[2px] left-[43px] top-[38px] bottom-[38px]" style={{ background: "rgba(255,255,255,0.85)" }} />}
          {rows.map((t) => (
            <div key={t.id} className="relative flex items-center gap-4 min-h-[48px]">
              <TaskNode icon={t.icon} color={t.color} width={46} height={46} iconSize={21} done={t.done} progress={taskProgress(t, now)} label={t.title} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{timeRange(t.startMin!, t.durationMin)} ({durationLabel(t.durationMin)})</p>
                <p className="text-[19px] font-extrabold leading-tight truncate" style={{ textDecoration: t.done ? "line-through" : undefined, color: t.done ? "rgba(255,255,255,0.5)" : "#fff" }}>{t.title}</p>
              </div>
              <button
                aria-label={t.done ? "Marcar como pendiente" : "Completar"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  haptic("light");
                  toggleDoneOn(t.id, today);
                }}
                className="shrink-0 flex items-center justify-center w-[26px] h-[26px] rounded-full cursor-pointer"
                style={{ border: "2.5px solid #fff", background: t.done ? "#fff" : "transparent", color: "#111" }}
              >
                {t.done && <Check size={15} strokeWidth={4} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
