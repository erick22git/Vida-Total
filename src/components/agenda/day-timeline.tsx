"use client";

import { useEffect, useMemo, useRef } from "react";
import { hourParts, layoutDay, nowMinutes, taskProgress, toISODate } from "@/lib/agenda/time";
import type { AgendaTask } from "@/lib/agenda/types";
import { TaskNode } from "./task-node";

const NODE_W = 37;
const AXIS = "63%";

/** Muesca donde una tarea se encaja en otra que coincide en el tiempo (ambas siguen visibles). */
export function Notch({ size = 28 }: { size?: number }) {
  return <span aria-hidden className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: -8, width: size, height: 15, borderRadius: "50%", background: "#000", zIndex: 5, boxShadow: "0 0 0 2px rgba(255,255,255,0.15)" }} />;
}

/**
 * Línea de tiempo vertical del día. Las horas con tareas se expanden y las vacías se comprimen; cada tarea es un
 * círculo/cápsula sobre una línea central, más alta cuanto más dura. La hora actual va llenando el bloque.
 */
export function DayTimeline({
  date, tasks, now, selectedId, onSelect, onOpen, bottomPad,
}: { date: string; tasks: AgendaTask[]; now: Date; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void; bottomPad: number }) {
  const layout = useMemo(() => layoutDay(tasks), [tasks]);
  const scroller = useRef<HTMLDivElement>(null);
  const isToday = date === toISODate(now);
  const nowMin = nowMinutes(now);

  // Al entrar (o cambiar de día) deja a la vista la hora actual o la primera tarea.
  const firstTop = layout.items[0]?.top;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = isToday ? layout.yFor(nowMin - 75) : firstTop !== undefined ? firstTop - 40 : 0;
    el.scrollTo({ top: Math.max(0, target) });
    // solo al abrir / cambiar de día
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const hours = Array.from({ length: 24 - layout.firstHour }, (_, i) => layout.firstHour + i);
  const items = layout.items;

  return (
    <div ref={scroller} className="relative flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="relative" style={{ height: layout.height + bottomPad }}>
        {hours.map((h) => {
          const { n, s } = hourParts(h);
          return (
            <span key={h} className="absolute left-1.5 text-[12px] font-bold leading-none" style={{ top: layout.yFor(h * 60) - 6, color: "rgba(255,255,255,0.45)" }}>
              {n}
              <sup className="text-[7px] ml-px">{s}</sup>
            </span>
          );
        })}

        {/* Conectores entre tareas consecutivas */}
        {items.map((it, i) => {
          const next = items[i + 1];
          const y1 = it.top + it.height;
          const y2 = next ? next.top : y1 + 22;
          if (y2 <= y1) return null;
          return <span key={`l${it.task.id}`} className="absolute w-[2px] -translate-x-1/2" style={{ left: AXIS, top: y1, height: y2 - y1, background: "rgba(255,255,255,0.85)" }} />;
        })}
        {items[0] && <span className="absolute w-[2px] -translate-x-1/2" style={{ left: AXIS, top: Math.max(0, items[0].top - 22), height: Math.min(22, items[0].top), background: "linear-gradient(transparent, rgba(255,255,255,0.85))" }} />}

        {items.map((it) => (
          <div key={it.task.id} className="absolute -translate-x-1/2" style={{ left: AXIS, top: it.top, zIndex: it.z }}>
            {it.overlapsPrev && <Notch />}
            <TaskNode
              icon={it.task.icon}
              color={it.task.color}
              width={NODE_W}
              height={it.height}
              progress={taskProgress(it.task, now)}
              done={it.task.done}
              selected={selectedId === it.task.id}
              iconSize={17}
              label={it.task.title}
              onClick={() => (selectedId === it.task.id ? onOpen(it.task.id) : onSelect(it.task.id))}
            />
          </div>
        ))}

        {tasks.filter((t) => t.allDay).length > 0 && (
          <p className="absolute right-4 text-[12px] font-semibold" style={{ top: 6, color: "rgba(255,255,255,0.5)" }}>
            {tasks.filter((t) => t.allDay).length} todo el día
          </p>
        )}
      </div>
    </div>
  );
}
