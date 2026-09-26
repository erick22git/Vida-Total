"use client";

import { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import { ArrowRight, Check, CornerUpLeft, Inbox, SkipForward, Trash2, X } from "lucide-react";
import { pendingItems, type PendingItem, type ReplanAction } from "@/lib/agenda/replan";
import { firstFreeStart, useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, timeRange, toISODate } from "@/lib/agenda/time";
import { haptic } from "@/lib/haptics/haptic";
import { ActionButton } from "./agenda-sheets";
import { DatePickerSheet } from "./pickers";
import { Sheet } from "./sheet";
import { TaskNode } from "./task-node";

const SWIPE = 90;
const STATS0 = { complete: 0, delete: 0, reschedule: 0, inbox: 0, skip: 0 };

/**
 * Replan: revisa una por una las tareas que quedaron sin hacer. Cada decisión es UNA ocurrencia (nunca la serie):
 * completar (→ derecha), Bandeja (← izquierda), reprogramar (↑ arriba) o eliminar (↓ abajo). También se puede omitir y deshacer.
 */
export function ReplanScreen({ scopeDate, onClose }: { scopeDate: string | null; onClose: () => void }) {
  const replanAction = useAgendaStore((s) => s.replanAction);
  const restoreTasks = useAgendaStore((s) => s.restoreTasks);
  const [items] = useState<PendingItem[]>(() => pendingItems(useAgendaStore.getState().tasks, new Date(), scopeDate));
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ tasks: ReturnType<typeof useAgendaStore.getState>["tasks"]; index: number; kind: keyof typeof STATS0 }[]>([]);
  const [stats, setStats] = useState({ ...STATS0 });
  const [resched, setResched] = useState(false);
  const [picking, setPicking] = useState(false);
  const controls = useAnimation();
  const busy = useRef(false);
  const item = items[index];
  // Entrada suave de cada tarjeta.
  const key = item?.key;
  useEffect(() => {
    if (!key) return;
    controls.set({ scale: 0.96, opacity: 0.4, x: 0, y: 0 });
    controls.start({ scale: 1, opacity: 1, transition: { duration: 0.22 } });
  }, [key, controls]);
  const total = items.length;

  const advance = (kind: keyof typeof stats, mutate?: () => void) => {
    setHistory((h) => [...h, { tasks: useAgendaStore.getState().tasks, index, kind }]);
    mutate?.();
    setStats((s) => ({ ...s, [kind]: s[kind] + 1 }));
    setIndex((i) => i + 1);
    setResched(false);
    haptic("light");
  };
  const act = (action: ReplanAction, target?: { date: string; startMin: number | null }) => {
    if (!item) return;
    advance(action, () => replanAction(item.task.id, item.date, action, target));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    restoreTasks(last.tasks);
    setIndex(last.index);
    setHistory((h) => h.slice(0, -1));
    setStats((s) => ({ ...s, [last.kind]: Math.max(0, s[last.kind] - 1) }));
    setResched(false);
  };
  const reschedule = (date: string) => {
    if (!item) return;
    const tasks = useAgendaStore.getState().tasks;
    const step = useAgendaStore.getState().timeStep;
    const original = item.task.startMin;
    const timed = original !== null && !item.task.allDay;
    const start = timed ? (date === toISODate(new Date()) ? firstFreeStart(tasks, date, step, item.task.durationMin) : original) : null;
    act("reschedule", { date, startMin: start });
  };

  function onDragEnd(_: unknown, info: PanInfo) {
    if (busy.current) return;
    const { x, y } = info.offset;
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (Math.max(ax, ay) < SWIPE) return void controls.start({ x: 0, y: 0 });
    busy.current = true;
    const done = () => {
      controls.set({ x: 0, y: 0, opacity: 1 });
      busy.current = false;
    };
    if (ax > ay) {
      controls.start({ x: x > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.18 } }).then(() => {
        act(x > 0 ? "complete" : "inbox");
        done();
      });
    } else if (y < 0) {
      controls.start({ x: 0, y: 0 });
      setResched(true);
      busy.current = false;
    } else {
      controls.start({ y: 400, opacity: 0, transition: { duration: 0.18 } }).then(() => {
        act("delete");
        done();
      });
    }
  }

  const ago = item ? differenceInCalendarDays(new Date(), new Date(`${item.date}T12:00:00`)) : 0;

  return (
    <div className="absolute inset-0 z-[70] flex flex-col" style={{ background: "#000" }} role="dialog" aria-label="Revisar tareas pendientes">
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] h-[64px] shrink-0">
        <h2 className="text-[26px] font-extrabold tracking-tight">Pendientes</h2>
        <div className="flex items-center gap-2">
          {total > 0 && item && <span className="text-[15px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{Math.min(index + 1, total)} de {total}</span>}
          <button aria-label="Cerrar" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{ background: "#2b2b2e" }}>
            <X size={20} strokeWidth={3} />
          </button>
        </div>
      </div>

      {total > 0 && (
        <div className="h-1 mx-5 rounded-full overflow-hidden shrink-0" style={{ background: "#232326" }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(Math.min(index, total) / total) * 100}%`, background: "#fff" }} />
        </div>
      )}

      {!item ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center pb-24">
          <span className="flex items-center justify-center w-16 h-16 rounded-full" style={{ background: "#fff", color: "#111" }}>
            <Check size={34} strokeWidth={4} />
          </span>
          <p className="text-[24px] font-extrabold">{total === 0 ? "Todo al día" : "Listo"}</p>
          <p className="text-[15px] font-semibold max-w-[260px]" style={{ color: "rgba(255,255,255,0.55)" }} data-testid="replan-summary">
            {total === 0
              ? "No tienes tareas pendientes de días anteriores."
              : `${stats.complete} completadas · ${stats.reschedule} reprogramadas · ${stats.inbox} a la Bandeja · ${stats.delete} eliminadas${stats.skip ? ` · ${stats.skip} omitidas` : ""}`}
          </p>
          <div className="w-full max-w-[280px] mt-4 flex flex-col gap-2">
            {history.length > 0 && (
              <button onClick={undo} className="h-12 rounded-full text-[16px] font-bold cursor-pointer" style={{ background: "#2b2b2e" }}>Deshacer la última</button>
            )}
            <ActionButton onClick={onClose}>Cerrar</ActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center px-5 pb-6">
            <motion.div
              key={item.key}
              drag
              dragElastic={0.6}
              dragSnapToOrigin
              animate={controls}
              onDragEnd={onDragEnd}
              className="w-full max-w-[340px] rounded-[34px] p-6 flex flex-col items-center text-center touch-none"
              style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
              data-testid="replan-card"
            >
              <TaskNode icon={item.task.icon} color={item.task.color} width={84} height={84} iconSize={38} source={item.task.source} label={item.task.title} />
              <p className="text-[26px] font-extrabold leading-tight mt-4 break-words">{item.task.title}</p>
              <p className="text-[16px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                {format(new Date(`${item.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-[15px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                {item.task.startMin === null || item.task.allDay ? "Todo el día" : `${timeRange(item.task.startMin, item.task.durationMin)} (${durationLabel(item.task.durationMin)})`} · {ago === 0 ? "hoy" : ago === 1 ? "ayer" : `hace ${ago} días`}
              </p>
              {item.recurring && (
                <span className="mt-3 px-3 py-1.5 rounded-full text-[13px] font-bold" style={{ background: "#2b2b2e", color: "rgba(255,255,255,0.75)" }}>
                  Se repite · solo cambia este día
                </span>
              )}
              <p className="text-[12px] font-semibold mt-4" style={{ color: "rgba(255,255,255,0.35)" }}>Desliza: → completar · ← Bandeja · ↑ reprogramar · ↓ eliminar</p>
            </motion.div>
          </div>

          <div className="shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              <Action label="Completar" icon={<Check size={24} strokeWidth={3.4} />} onClick={() => act("complete")} />
              <Action label="Reprogramar" icon={<ArrowRight size={24} strokeWidth={3} className="-rotate-45" />} onClick={() => setResched(true)} />
              <Action label="Enviar a la bandeja" short="Bandeja" icon={<Inbox size={24} />} onClick={() => act("inbox")} />
              <Action label="Eliminar" icon={<Trash2 size={22} />} onClick={() => act("delete")} danger />
            </div>
            <div className="flex items-center justify-between">
              <button aria-label="Deshacer" disabled={history.length === 0} onClick={undo} className="flex items-center gap-2 h-11 px-4 rounded-full text-[15px] font-bold cursor-pointer disabled:opacity-30" style={{ background: "#232326" }}>
                <CornerUpLeft size={17} /> Deshacer
              </button>
              <button aria-label="Omitir" onClick={() => advance("skip")} className="flex items-center gap-2 h-11 px-4 rounded-full text-[15px] font-bold cursor-pointer" style={{ background: "#232326" }}>
                Omitir <SkipForward size={17} />
              </button>
            </div>
          </div>
        </>
      )}

      <Sheet open={resched && !!item} onClose={() => setResched(false)} title="Reprogramar" z={90}>
        <div className="flex flex-col gap-2.5">
          <Option label={item && item.task.startMin !== null && !item.task.allDay ? "Hoy, en el próximo hueco" : "Hoy"} onClick={() => reschedule(toISODate(new Date()))} />
          <Option label="Mañana" onClick={() => reschedule(toISODate(new Date(Date.now() + 86400000)))} />
          <Option label="Elegir otro día…" onClick={() => setPicking(true)} />
        </div>
      </Sheet>
      <DatePickerSheet open={picking} onClose={() => setPicking(false)} value={toISODate(new Date())} onPick={(d) => d && reschedule(d)} />
    </div>
  );
}

function Option({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-14 px-5 rounded-full text-[18px] font-bold text-left cursor-pointer" style={{ background: "#232326" }}>
      {label}
    </button>
  );
}

function Action({ label, short, icon, onClick, danger }: { label: string; short?: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} className="flex flex-col items-center justify-center gap-1.5 h-[76px] rounded-[26px] text-[12px] font-extrabold cursor-pointer active:scale-95 transition-transform" style={{ background: "#232326", color: danger ? "#ff453a" : "#fff" }}>
      {icon}
      {short ?? label}
    </button>
  );
}
