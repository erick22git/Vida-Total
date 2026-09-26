"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Inbox, LayoutGrid, List, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { occurrencesOn } from "@/lib/agenda/recurrence";
import { inboxTasks, useAgendaStore } from "@/lib/agenda/store";
import { isInProgress, nowMinutes, toISODate } from "@/lib/agenda/time";
import { useNow } from "@/lib/agenda/use-now";
import type { AgendaTask } from "@/lib/agenda/types";
import { ConfirmSheet, CopyTasksSheet } from "./agenda-sheets";
import { DatePickerSheet, MenuRow } from "./pickers";
import { DayTimeline } from "./day-timeline";
import { DaySheet, NAV_H, PEEK_H } from "./day-sheet";
import { FocusScreen } from "./focus-screen";
import { TaskEditor, type EditorTarget } from "./task-editor";
import { TaskNode } from "./task-node";
import { getAgendaIcon } from "@/lib/agenda/icons";

type Tab = "inbox" | "day" | "ai";
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function pickActive(tasks: AgendaTask[], now: Date, selectedId: string | null): AgendaTask | null {
  const chosen = tasks.find((t) => t.id === selectedId);
  if (chosen) return chosen;
  const timed = tasks.filter((t) => t.startMin !== null && !t.allDay).sort((a, b) => a.startMin! - b.startMin!);
  return timed.find((t) => isInProgress(t, now)) ?? timed.find((t) => !t.done && t.startMin! >= nowMinutes(now)) ?? timed[0] ?? tasks[0] ?? null;
}

/**
 * Pantalla de planificación del día (ruta interna `agenda`; no lleva título con ese nombre).
 * Cabecera con mes + semana, línea de tiempo del día, cajita inferior desplegable, bandeja y espacio para la IA.
 */
export function AgendaScreen() {
  const router = useRouter();
  const now = useNow(15_000);
  const tasks = useAgendaStore((s) => s.tasks);
  const toggleDoneOn = useAgendaStore((s) => s.toggleDoneOn);
  const moveTasks = useAgendaStore((s) => s.moveTasks);
  const clearDay = useAgendaStore((s) => s.clearDay);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [tab, setTab] = useState<Tab>("day");
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [calendar, setCalendar] = useState(false);
  const [dayMenu, setDayMenu] = useState<null | "menu" | "copy" | "move" | "clear">(null);
  const swipe = useRef<number | null>(null);

  const dayTasks = useMemo(() => occurrencesOn(tasks, date), [tasks, date]);
  const pending = dayTasks.filter((t) => !t.done && !(t.repeat && t.repeat.freq !== "none"));
  const inbox = useMemo(() => inboxTasks(tasks), [tasks]);
  const active = pickActive(dayTasks, now, selectedId);
  const today = toISODate(now);
  const selected = new Date(`${date}T12:00:00`);
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const title =
    tab === "inbox" ? "Bandeja" : tab === "ai" ? "IA" : expanded ? format(selected, "d MMM yyyy", { locale: es }).replace(/\./g, "") : format(selected, "MMMM 'de' yyyy", { locale: es });

  function shiftWeek(dir: 1 | -1) {
    setDate(toISODate(addDays(selected, dir * 7)));
    setSelectedId(null);
  }

  return (
    <div className="fixed inset-0 z-[45] text-white bg-black overflow-hidden">
      <div className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden flex flex-col" style={{ background: "#000" }}>
        {/* ---------- Cabecera ---------- */}
        <header className="shrink-0 pt-[max(env(safe-area-inset-top),14px)]">
          <div className="flex items-center justify-between pl-[25px] pr-4 h-[46px]">
            <button onClick={() => tab === "day" && setCalendar(true)} className="flex items-center gap-1.5 text-[29px] font-extrabold tracking-tight cursor-pointer text-left leading-none" aria-label="Elegir día">
              <span>{title}</span>
              {tab === "day" && <ChevronRight size={22} strokeWidth={3.4} />}
            </button>
            <button aria-label="Volver a Hábitos" onClick={() => router.push("/habitos")} className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer" style={{ background: "rgba(255,255,255,0.1)" }}>
              <ChevronLeft size={20} strokeWidth={3} />
            </button>
          </div>

          {tab === "day" && (
            <div
              className="grid grid-cols-7 px-3 pt-2 pb-2.5 select-none touch-pan-y"
              onPointerDown={(e) => (swipe.current = e.clientX)}
              onPointerUp={(e) => {
                if (swipe.current === null) return;
                const dx = e.clientX - swipe.current;
                swipe.current = null;
                if (Math.abs(dx) > 50) shiftWeek(dx < 0 ? 1 : -1);
              }}
            >
              {week.map((d, i) => {
                const iso = toISODate(d);
                const sel = iso === date;
                const dots = expanded && sel ? occurrencesOn(tasks, iso).slice(0, 5) : [];
                return (
                  <button key={iso} onClick={() => { if (sel) setDayMenu("menu"); else { setDate(iso); setSelectedId(null); } }} className="flex flex-col items-center gap-1 cursor-pointer" aria-label={format(d, "EEEE d 'de' MMMM", { locale: es })} aria-pressed={sel}>
                    <span className="text-[14px] font-semibold" style={{ color: sel ? "#fff" : "rgba(255,255,255,0.5)" }}>{WEEKDAYS[i]}</span>
                    <span className="flex items-center justify-center w-[30px] h-[30px] rounded-full text-[18px] font-extrabold" style={{ background: sel ? "#fff" : "transparent", color: sel ? "#000" : iso === today ? "#fff" : "#fff" }}>
                      {format(d, "d")}
                    </span>
                    <span className="flex h-[18px] items-center">
                      {dots.map((t, k) => {
                        const { Icon } = getAgendaIcon(t.icon);
                        return (
                          <span key={t.id} className="flex items-center justify-center w-[18px] h-[18px] rounded-full" style={{ background: t.done ? "#555" : "#fff", color: "#111", marginLeft: k ? -6 : 0 }}>
                            <Icon size={10} strokeWidth={3} />
                          </span>
                        );
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* ---------- Contenido ---------- */}
        {tab === "day" && (
          <DayTimeline
            date={date}
            tasks={dayTasks}
            now={now}
            selectedId={active?.id ?? null}
            onSelect={setSelectedId}
            onOpen={(id) => setEditor({ mode: "edit", id, date })}
            bottomPad={PEEK_H + NAV_H + 30}
          />
        )}
        {tab === "inbox" && (
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-40">
            {inbox.length === 0 ? (
              <div className="flex flex-col items-center gap-3 mt-24 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                <Inbox size={44} />
                <p className="text-[18px] font-bold">Tu bandeja está vacía</p>
                <p className="text-[15px] font-semibold max-w-[240px]">Aquí van las tareas que todavía no tienen día ni hora.</p>
              </div>
            ) : (
              inbox.map((t) => (
                <div key={t.id} role="button" aria-label={`Abrir ${t.title}`} onClick={() => setEditor({ mode: "edit", id: t.id, date: toISODate(new Date()) })} className="flex items-center gap-4 mb-4 cursor-pointer">
                  <TaskNode icon={t.icon} color={t.color} width={50} height={50} iconSize={22} done={t.done} label={t.title} />
                  <p className="flex-1 min-w-0 text-[21px] font-extrabold truncate" style={{ textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? 0.5 : 1 }}>{t.title}</p>
                  <button aria-label={t.done ? "Marcar como pendiente" : "Completar"} onClick={(e) => { e.stopPropagation(); toggleDoneOn(t.id, date); }} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style={{ border: "2.5px solid #fff", background: t.done ? "#fff" : "transparent", color: "#000" }}>
                    {t.done && <span className="text-[14px] font-black">✓</span>}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {tab === "ai" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 pb-40 text-center">
            <span className="flex items-center justify-center w-16 h-16 rounded-full" style={{ background: "#2b2b2e" }}>
              <Sparkles size={30} />
            </span>
            <p className="text-[22px] font-extrabold">Planifica tu día con IA</p>
            <p className="text-[15px] font-semibold max-w-[260px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Muy pronto podrás contarle tu día y armará las tareas por ti.
            </p>
            <div className="w-full h-14 rounded-full flex items-center px-5 text-left text-[17px] font-semibold opacity-60" style={{ background: "#1f1f22", color: "rgba(255,255,255,0.45)" }} aria-disabled>
              Cuéntame qué tienes que hacer…
            </div>
          </div>
        )}

        {tab === "day" && (
          <DaySheet
            expanded={expanded}
            onExpandedChange={setExpanded}
            tasks={dayTasks}
            active={active}
            now={now}
            onToggle={(id) => toggleDoneOn(id, date)}
            onOpen={(id) => setEditor({ mode: "edit", id, date })}
          />
        )}

        {/* ---------- Navegación inferior ---------- */}
        <nav className="absolute left-2.5 right-2.5 bottom-0 pb-[max(env(safe-area-inset-bottom),12px)] flex items-center gap-3 z-40">
          <div className="flex-1 flex items-center justify-between h-[62px] px-1.5 rounded-full" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              ["inbox", "Bandeja", Inbox],
              ["day", "Agenda", expanded ? List : LayoutGrid],
              ["ai", "IA", Sparkles],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => { setTab(k); if (k !== "day") setExpanded(false); }} aria-pressed={tab === k} className="flex-1 h-[52px] mx-0.5 flex flex-col items-center justify-center gap-0.5 rounded-full cursor-pointer text-[12px] font-extrabold transition-colors" style={{ background: tab === k ? "#3a3a3d" : "transparent", color: tab === k ? "#fff" : "rgba(255,255,255,0.6)" }}>
                <Icon size={24} />
                {label}
              </button>
            ))}
          </div>
          <button aria-label="Nueva tarea" onClick={() => setEditor({ mode: "create", date: tab === "inbox" ? null : date, startMin: null })} className="flex items-center justify-center w-[60px] h-[60px] rounded-full cursor-pointer active:scale-95 transition-transform" style={{ background: "#f4f4f5", color: "#111" }}>
            <Plus size={30} strokeWidth={3} />
          </button>
        </nav>

        {editor && (
          <TaskEditor
            key={editor.mode === "edit" ? editor.id : "new"}
            target={editor}
            onFocus={(id) => { setEditor(null); setFocusId(id); }}
            onClose={(createdId) => {
              setEditor(null);
              if (createdId) {
                const t = useAgendaStore.getState().tasks.find((x) => x.id === createdId);
                if (t?.date) { setTab("day"); setDate(t.date); }
                else setTab("inbox");
                setSelectedId(createdId);
              }
            }}
          />
        )}
        {focusId && <FocusScreen taskId={focusId} onClose={() => setFocusId(null)} />}
        {dayMenu === "menu" && (
          <div className="absolute inset-0 z-[55]" onClick={() => setDayMenu(null)}>
            <div className="absolute left-3 top-[112px] w-[250px] rounded-[28px] p-2" style={{ background: "rgba(28,28,30,0.97)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 50px rgba(0,0,0,0.7)" }} onClick={(e) => e.stopPropagation()} role="menu" aria-label="Opciones del día">
              <MenuRow icon={<Copy size={22} />} onClick={() => setDayMenu("copy")}>Copiar tareas del día</MenuRow>
              {pending.length > 0 && (
                <MenuRow icon={<Send size={22} />} onClick={() => setDayMenu("move")}>Volver a planificar {pending.length} {pending.length === 1 ? "tarea" : "tareas"}</MenuRow>
              )}
              <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.1)" }} />
              <MenuRow icon={<CalendarPlus size={22} />} onClick={() => { setDayMenu(null); setEditor({ mode: "create", date, startMin: null }); }}>Añadir tarea</MenuRow>
              <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.1)" }} />
              <button disabled={dayTasks.length === 0} onClick={() => setDayMenu("clear")} className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl text-[17px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default" style={{ color: "#ff453a" }}>
                <Trash2 size={22} /> Vaciar día
              </button>
            </div>
          </div>
        )}
        <CopyTasksSheet open={dayMenu === "copy"} onClose={() => setDayMenu(null)} sourceDate={date} tasks={dayTasks} />
        <DatePickerSheet open={dayMenu === "move"} onClose={() => setDayMenu(null)} value={date} onPick={(d) => { if (d) { moveTasks(pending.map((t) => t.id), d); setDate(d); setSelectedId(null); } }} />
        <ConfirmSheet
          open={dayMenu === "clear"}
          onClose={() => setDayMenu(null)}
          title="Vaciar día"
          message={`Se quitarán las ${dayTasks.length} tareas de este día. Las que se repiten seguirán en los demás días.`}
          actions={[{ label: "Vaciar día", danger: true, onClick: () => { clearDay(date); setDayMenu(null); setSelectedId(null); } }]}
        />
        <DatePickerSheet open={calendar} onClose={() => setCalendar(false)} value={date} onPick={(d) => { if (d) { setDate(d); setSelectedId(null); } }} />
      </div>
    </div>
  );
}
