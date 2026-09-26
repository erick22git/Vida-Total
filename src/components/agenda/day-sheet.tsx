"use client";

import { Check } from "lucide-react";
import { clock, DAY_MIN, durationLabel, minutesLeft, isInProgress, overlapFlags, taskProgress, timeRange } from "@/lib/agenda/time";
import { Notch } from "./day-timeline";
import type { AgendaTask } from "@/lib/agenda/types";
import { haptic } from "@/lib/haptics/haptic";
import { TaskNode } from "./task-node";

export const PEEK_H = 112;
export const NAV_H = 92;

function CheckCircle({ done, onToggle, size = 26 }: { done: boolean; onToggle: () => void; size?: number }) {
  return (
    <button
      aria-label={done ? "Marcar como pendiente" : "Completar"}
      onClick={(e) => {
        e.stopPropagation();
        haptic("light");
        onToggle();
      }}
      className="shrink-0 flex items-center justify-center rounded-full cursor-pointer active:scale-90 transition-transform"
      style={{ width: size, height: size, border: "2.5px solid #fff", background: done ? "#fff" : "transparent", color: "#111" }}
    >
      {done && <Check size={size - 9} strokeWidth={4} />}
    </button>
  );
}

/** Altura proporcional a la duración en la lista desplegada (cápsula que crece con el tiempo). */
const rowNodeHeight = (durationMin: number) => Math.max(53, 53 + 1.57 * (durationMin - 15));

function subtitle(task: AgendaTask, now: Date): string {
  if (task.startMin === null || task.allDay) return task.allDay ? "Todo el día" : "Sin hora";
  return isInProgress(task, now) ? `Tiempo restante: ${durationLabel(minutesLeft(task, now))}` : `${timeRange(task.startMin, task.durationMin)} (${durationLabel(task.durationMin)})`;
}

interface DaySheetProps {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  tasks: AgendaTask[];
  active: AgendaTask | null;
  now: Date;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

/**
 * Cajita inferior: cerrada muestra la tarea activa (o vacía); al tocarla se despliega hacia arriba con la lista del día.
 * En la lista, tocar el círculo la marca como hecha (se apaga) y tocar la fila la abre para editar.
 */
export function DaySheet({ expanded, onExpandedChange, tasks, active, now, onToggle, onOpen }: DaySheetProps) {
  const sorted = [...tasks].sort((a, b) => (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || (a.startMin ?? 0) - (b.startMin ?? 0));
  const overlaps = overlapFlags(sorted);
  return (
    <div
      className="absolute left-2.5 right-2.5 overflow-hidden"
      style={{
        bottom: expanded ? 0 : NAV_H,
        height: expanded ? "calc(100% - 150px)" : PEEK_H,
        left: expanded ? 0 : 10,
        right: expanded ? 0 : 10,
        background: expanded ? "#1c1c1e" : "#171717",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: expanded ? "36px 36px 0 0" : 36,
        transition: "height 320ms cubic-bezier(.32,.72,0,1), bottom 320ms cubic-bezier(.32,.72,0,1), border-radius 320ms, left 320ms, right 320ms",
        zIndex: 30,
        boxShadow: "0 -10px 40px rgba(0,0,0,0.45)",
      }}
    >
      <button aria-label={expanded ? "Contraer" : "Desplegar"} onClick={() => onExpandedChange(!expanded)} className="absolute top-0 left-0 right-0 h-8 flex justify-center pt-2.5 cursor-pointer z-10">
        <span className="w-[46px] h-[5px] rounded-full" style={{ background: "rgba(255,255,255,0.28)" }} />
      </button>

      {!expanded ? (
        <div className="absolute inset-0 pt-6" onClick={() => onExpandedChange(true)} role="button" aria-label="Desplegar lista del día">
          {active && (
            <div className="relative flex items-center gap-4 pl-[30px] pr-6 h-full pb-3">
              <span className="absolute w-[2px] top-0 -translate-x-1/2" style={{ left: 63, height: 36, background: "rgba(255,255,255,0.8)" }} />
              <TaskNode icon={active.icon} color={active.color} width={54} height={54} progress={taskProgress(active, now)} done={active.done} iconSize={24} label={active.title} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{subtitle(active, now)}</p>
                <p className="text-[22px] font-extrabold leading-tight truncate" style={{ textDecoration: active.done ? "line-through" : undefined, opacity: active.done ? 0.55 : 1 }}>{active.title}</p>
              </div>
              <CheckCircle done={active.done} onToggle={() => onToggle(active.id)} size={28} />
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 overflow-y-auto pt-8 pb-28 px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sorted.length === 0 && <p className="text-center mt-10 text-[16px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>Aún no hay tareas para este día.</p>}
          {sorted.map((t, i) => {
            const h = rowNodeHeight(t.durationMin);
            const timed = t.startMin !== null && !t.allDay;
            const end = timed ? t.startMin! + t.durationMin : null;
            const hourMarks = timed ? Array.from({ length: 24 }, (_, k) => k * 60).filter((m) => m > t.startMin! && m < end! && m < DAY_MIN) : [];
            return (
              <div key={t.id} className="relative pl-[52px] pr-5" onClick={() => onOpen(t.id)} role="button" aria-label={`Abrir ${t.title}`}>
                {overlaps[i] && (
                  <p className="text-[15px] font-semibold -mt-1 mb-3" style={{ marginLeft: 66, color: "rgba(255,255,255,0.5)" }}>
                    Las tareas <b className="text-white">coinciden</b>
                  </p>
                )}
                {i > 0 && <span className="absolute w-[2px] -translate-x-1/2" style={{ left: 75, top: -9, height: 12, background: "rgba(255,255,255,0.35)" }} />}
                <div className="relative flex items-center gap-4 mb-3 cursor-pointer" style={{ minHeight: h }}>
                  {overlaps[i] && (
                    <span className="absolute" style={{ left: 0, top: 0, width: 53 }}>
                      <Notch size={34} />
                    </span>
                  )}
                  <TaskNode icon={t.icon} color={t.color} width={53} height={timed ? h : 53} progress={taskProgress(t, now)} done={t.done} iconSize={24} label={t.title} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{subtitle(t, now)}</p>
                    <p className="text-[22px] font-extrabold leading-tight truncate" style={{ textDecoration: t.done ? "line-through" : undefined, color: t.done ? "rgba(255,255,255,0.55)" : "#fff" }}>{t.title}</p>
                  </div>
                  <CheckCircle done={t.done} onToggle={() => onToggle(t.id)} size={28} />
                </div>
                {timed && (
                  <>
                    {hourMarks.map((m) => (
                      <span key={m} className="absolute left-3 text-[12px] font-bold" style={{ top: 8 + ((m - t.startMin!) / t.durationMin) * (h - 16), color: "rgba(255,255,255,0.4)" }}>
                        {clock(m)}
                      </span>
                    ))}
                    <span className="absolute left-3 text-[12px] font-bold" style={{ top: h - 4, color: "rgba(255,255,255,0.4)" }}>
                      {clock(end!)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
