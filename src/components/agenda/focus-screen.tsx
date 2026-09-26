"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { isDoneOn } from "@/lib/agenda/recurrence";
import { useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, timeRange, toISODate } from "@/lib/agenda/time";
import { haptic } from "@/lib/haptics/haptic";
import { TaskNode } from "./task-node";

type Tab = "subtasks" | "notes" | "intervals";

/** Modo enfoque: pantalla completa clara con cuenta regresiva de la tarea en curso. */
export function FocusScreen({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useAgendaStore((s) => s.tasks.find((t) => t.id === taskId));
  const toggleDoneOn = useAgendaStore((s) => s.toggleDoneOn);
  const toggleSubtask = useAgendaStore((s) => s.toggleSubtask);
  const updateTask = useAgendaStore((s) => s.updateTask);
  const [now, setNow] = useState(() => new Date());
  const day = toISODate(now);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!task || task.startMin === null) return null;

  const endSec = (task.startMin + task.durationMin) * 60;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const left = Math.max(0, endSec - nowSec);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const progress = Math.min(1, Math.max(0, 1 - left / (task.durationMin * 60)));
  const done = isDoneOn(task, day);

  return (
    <div className="absolute inset-0 z-[80] overflow-hidden" style={{ background: "#b4b4b6", color: "#111" }}>
      <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)" }} />
      <button aria-label="Salir del modo enfoque" onClick={onClose} className="absolute right-4 top-[max(env(safe-area-inset-top),16px)] z-10 flex items-center justify-center w-[52px] h-[52px] rounded-full cursor-pointer" style={{ background: "#555", color: "#fff" }}>
        <X size={26} strokeWidth={3} />
      </button>

      <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] mt-10 text-center">
        <p className="text-[68px] font-extrabold leading-none tracking-tight tabular-nums">{mm}:{ss}</p>
        <p className="text-[17px] font-extrabold tracking-wider mt-1" style={{ color: "#6c6c6f" }}>RESTANTES</p>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: 170 }}>
        <span className="w-[3px] h-[70px]" style={{ background: "linear-gradient(transparent, #fff)" }} />
        <TaskNode icon={task.icon} color={task.color} width={132} height={280} iconSize={54} progress={progress} style={{ boxShadow: "0 0 0 6px #fff", background: "#4d4d50" }} label={task.title} />
        <span className="w-[3px] h-[50px]" style={{ background: "linear-gradient(#fff, transparent)" }} />
      </div>

      <div className="absolute left-3 right-3 bottom-3 pb-[env(safe-area-inset-bottom)] flex flex-col gap-3">
        {tab && (
          <div className="rounded-[26px] p-4 max-h-48 overflow-y-auto" style={{ background: "rgba(70,70,72,0.94)", color: "#fff" }}>
            {tab === "subtasks" && (task.subtasks.length === 0 ? <p className="opacity-60 font-semibold">Sin subtareas.</p> : task.subtasks.map((s) => (
              <button key={s.id} onClick={() => toggleSubtask(task.id, s.id)} className="flex items-center gap-3 w-full py-2 text-left cursor-pointer text-[18px] font-semibold">
                <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ border: "2px solid rgba(255,255,255,0.6)", background: s.done ? "#fff" : "transparent", color: "#111" }}>{s.done && <Check size={16} strokeWidth={4} />}</span>
                <span style={{ textDecoration: s.done ? "line-through" : undefined, opacity: s.done ? 0.5 : 1 }}>{s.title}</span>
              </button>
            )))}
            {tab === "notes" && (
              <textarea value={task.notes} onChange={(e) => updateTask(task.id, { notes: e.target.value })} placeholder="Notas de esta tarea" aria-label="Notas" rows={4} className="w-full bg-transparent outline-none resize-none text-[18px] font-semibold placeholder:text-white/40" />
            )}
            {tab === "intervals" && <p className="opacity-60 font-semibold">Los intervalos de enfoque llegan pronto.</p>}
          </div>
        )}
        <div className="flex items-center gap-4 h-[74px] px-5 rounded-[30px]" style={{ background: "rgba(70,70,72,0.94)", color: "#fff" }}>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{timeRange(task.startMin, task.durationMin)} ({durationLabel(task.durationMin)})</p>
            <p className="text-[22px] font-extrabold truncate">{task.title}</p>
          </div>
          <button
            aria-label={done ? "Marcar como pendiente" : "Completar"}
            onClick={() => {
              haptic("success");
              toggleDoneOn(task.id, day);
            }}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center cursor-pointer"
            style={{ border: "2.5px solid #fff", background: done ? "#fff" : "transparent", color: "#111" }}
          >
            {done && <Check size={18} strokeWidth={4} />}
          </button>
        </div>
        <div className="flex items-center justify-around h-[62px] rounded-full text-[16px] font-extrabold" style={{ background: "rgba(70,70,72,0.94)", color: "#fff" }}>
          {([["subtasks", "Subtareas"], ["notes", "Notas"], ["intervals", "Intervalos"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(tab === k ? null : k)} className="px-4 h-full cursor-pointer" style={{ opacity: tab === k ? 1 : 0.7 }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
