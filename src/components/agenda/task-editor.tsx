"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, BellOff, Calendar, Check, Clock, Ellipsis, Inbox, Palette, Repeat, Target, Trash2, X } from "lucide-react";
import { alertsOf, alertsSummary } from "@/lib/agenda/alerts";
import { iconForTitle } from "@/lib/agenda/icons";
import { isReadOnlyEvent, SOURCE_LABEL, sourceOf } from "@/lib/agenda/sources";
import { isDoneOn, isRecurring, occurrencesOn, repeatLabel } from "@/lib/agenda/recurrence";
import { emptyDraft, firstFreeStart, useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, isInProgress, minutesLeft, taskProgress, timeRange, toISODate } from "@/lib/agenda/time";
import { useNow } from "@/lib/agenda/use-now";
import { NO_REPEAT, type AgendaTask, type AgendaTaskDraft } from "@/lib/agenda/types";
import { haptic } from "@/lib/haptics/haptic";
import { ConfirmSheet, RepeatSheet } from "./agenda-sheets";
import { AlertsSheet } from "./alerts-sheet";
import { ColorIconSheet, DatePickerSheet, DurationSheet, TimeMoreMenu } from "./pickers";
import { CARD, RoundButton, Sheet, SURFACE } from "./sheet";
import { TaskNode } from "./task-node";
import { DurationSegments, SectionTitle, TimeAndDuration, TimeWheel } from "./time-duration";

/** Crear: abre el panel vacío (no crea nada hasta guardar). Editar: abre la tarea con sus datos reales (`date` = día que se está viendo). */
export type EditorTarget = { mode: "create"; date: string | null; startMin: number | null; prefill?: Partial<AgendaTaskDraft> } | { mode: "edit"; id: string; date: string };

const LIGHT = "#d9d9db";
/** Tiempo mínimo (ms) entre "Continuar" y poder pulsar "Crear tarea" en el mismo sitio: evita crear por un doble toque. */
const CREATE_GUARD_MS = 500;

const dateText = (iso: string | null) => (iso ? format(new Date(`${iso}T12:00:00`), "EEE, d MMM yyyy", { locale: es }).replace(/\./g, "") : "Sin fecha");
function dateHint(iso: string | null): string {
  if (!iso) return "Bandeja";
  const today = toISODate(new Date());
  if (iso === today) return "Hoy";
  return iso === toISODate(new Date(Date.now() + 86400000)) ? "Mañana" : "";
}

export function TaskEditor({ target, onClose, onFocus }: { target: EditorTarget; onClose: (createdId?: string) => void; onFocus?: (id: string) => void }) {
  const step = useAgendaStore((s) => s.timeStep);
  const presets = useAgendaStore((s) => s.durationPresets);
  const tasks = useAgendaStore((s) => s.tasks);
  const addTask = useAgendaStore((s) => s.addTask);
  const updateTask = useAgendaStore((s) => s.updateTask);
  const deleteTask = useAgendaStore((s) => s.deleteTask);
  const toggleDoneOn = useAgendaStore((s) => s.toggleDoneOn);
  const addSubtask = useAgendaStore((s) => s.addSubtask);
  const toggleSubtask = useAgendaStore((s) => s.toggleSubtask);
  const removeSubtask = useAgendaStore((s) => s.removeSubtask);
  const pushRecent = useAgendaStore((s) => s.pushRecentIcon);
  const now = useNow(15_000);

  const isEdit = target.mode === "edit";
  const stored: AgendaTask | undefined = isEdit ? tasks.find((t) => t.id === target.id) : undefined;
  const viewDate = isEdit ? target.date : (target.date ?? toISODate(now));
  const [local, setLocal] = useState<AgendaTaskDraft>(() => {
    if (target.mode !== "create") return emptyDraft(null, null);
    const all = useAgendaStore.getState().tasks;
    const st = useAgendaStore.getState().timeStep;
    return { ...emptyDraft(target.date, target.date === null ? null : (target.startMin ?? firstFreeStart(all, target.date, st))), ...target.prefill };
  });
  // En edición se lee siempre del store (una sola fuente de verdad: se actualiza ESA tarea, nunca se crea otra); en creación, del borrador local.
  const draft: AgendaTaskDraft = stored ?? local;
  const patch = (p: Partial<AgendaTaskDraft>) => (isEdit && stored ? updateTask(stored.id, p) : setLocal((d) => ({ ...d, ...p })));

  const [stage, setStage] = useState<1 | 2>(isEdit ? 2 : 1);
  const [sheet, setSheet] = useState<null | "date" | "duration" | "color" | "time" | "timeMenu" | "more" | "repeat" | "delete" | "alerts">(null);
  const [subDraft, setSubDraft] = useState("");
  const [hint, setHint] = useState("");
  const iconTouched = useRef(isEdit);
  const createdRef = useRef(false);
  const stageAt = useRef(0);

  const start = draft.startMin ?? firstFreeStart(tasks, viewDate, step, draft.durationMin);
  const shown: AgendaTask | undefined = stored ? { ...stored, date: viewDate, done: isDoneOn(stored, viewDate) } : undefined;
  const inProgress = !!shown && isInProgress(shown, now);
  const recurring = isRecurring(draft);
  const isImportedSource = sourceOf(draft) !== "local";
  const canCreate = draft.title.trim().length > 0;
  // Los eventos de calendario son de solo lectura: solo se cambian color, icono, alertas y subtareas.
  const locked = !!stored && isReadOnlyEvent(stored);
  const alerts = alertsOf(draft);

  // Vecinos en la línea de tiempo (para ver qué tarea va antes y cuál después mientras se edita).
  const neighbors = (() => {
    const day = occurrencesOn(tasks, viewDate)
      .filter((t) => t.startMin !== null && !t.allDay && t.id !== stored?.id)
      .sort((a, b) => a.startMin! - b.startMin!);
    return { prev: [...day].reverse().find((t) => t.startMin! <= start), next: day.find((t) => t.startMin! > start) };
  })();

  function setTitle(title: string) {
    patch({ title, ...(iconTouched.current ? {} : { icon: iconForTitle(title) }) });
  }
  function goToDetails() {
    stageAt.current = Date.now();
    setStage(2);
  }
  /** Única vía para crear una tarea desde el panel: pulsar "Crear tarea" con nombre, una sola vez. */
  function finishCreate() {
    if (isEdit || createdRef.current) return;
    if (Date.now() - stageAt.current < CREATE_GUARD_MS) return;
    if (!canCreate) {
      setHint("Ponle un nombre a la tarea para crearla.");
      return;
    }
    createdRef.current = true;
    const id = addTask({ ...draft, title: draft.title.trim(), startMin: draft.date === null || draft.allDay ? null : start });
    pushRecent(draft.icon);
    haptic("success");
    onClose(id);
  }
  function submitSub() {
    const t = subDraft.trim();
    if (!t) return;
    if (isEdit && stored) addSubtask(stored.id, t);
    else setLocal((d) => ({ ...d, subtasks: [...d.subtasks, { id: `s-${Date.now()}`, title: t, done: false }] }));
    setSubDraft("");
  }
  const subtaskToggle = (id: string) => (isEdit && stored ? toggleSubtask(stored.id, id) : setLocal((d) => ({ ...d, subtasks: d.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) })));
  const subtaskRemove = (id: string) => (isEdit && stored ? removeSubtask(stored.id, id) : setLocal((d) => ({ ...d, subtasks: d.subtasks.filter((s) => s.id !== id) })));
  function removeTask(scope: "day" | "series") {
    if (!stored) return;
    deleteTask(stored.id, scope === "day" ? viewDate : undefined);
    haptic("medium");
    onClose();
  }

  const timeLabel = draft.allDay ? "Todo el día" : timeRange(start, draft.durationMin);
  const remaining = shown && inProgress ? minutesLeft(shown, now) : null;
  const doneNow = shown ? shown.done : draft.done;

  if (isEdit && !stored) return null; // se eliminó

  return (
    <div className="absolute inset-0 z-[60] flex flex-col" style={{ background: "#000" }}>
      <div className="relative flex-1 flex flex-col mt-[max(env(safe-area-inset-top),20px)] overflow-hidden" style={{ background: SURFACE, borderTopLeftRadius: 34, borderTopRightRadius: 34 }}>
        {/* ---------- Cabecera clara ---------- */}
        <div className="relative shrink-0 overflow-hidden" style={{ background: LIGHT, color: "#111", borderTopLeftRadius: 34, borderTopRightRadius: 34, height: stage === 1 ? 150 : 236, transition: "height 240ms ease" }}>
          <div className="absolute left-4 top-4 z-20">
            <RoundButton label="Cerrar" light size={40} onClick={() => onClose()}>
              <X size={22} strokeWidth={3} />
            </RoundButton>
          </div>
          {isEdit && !recurring && (
            <div className="absolute right-4 top-4 z-20">
              <RoundButton label="Más" light size={40} onClick={() => setSheet(sheet === "more" ? null : "more")}>
                <Ellipsis size={22} />
              </RoundButton>
            </div>
          )}

          {/* columna del icono: tarea anterior (asoma arriba) · esta tarea · siguiente (asoma abajo) */}
          <div className="absolute left-7" style={{ top: stage === 1 ? 64 : 64, width: 74 }}>
            {stage === 2 && neighbors.prev && (
              <div className="absolute left-0 right-0 flex flex-col items-center" style={{ top: -84 }} aria-label={`Antes: ${neighbors.prev.title}`}>
                <TaskNode icon={neighbors.prev.icon} color={neighbors.prev.color} width={74} height={74} iconSize={30} done={neighbors.prev.done} style={{ background: "#5b5b5e" }} />
                <span className="w-[3px] h-[10px]" style={{ background: "#fff" }} />
              </div>
            )}
            <div className="relative">
              <TaskNode
                icon={draft.icon}
                color={draft.color}
                width={74}
                height={stage === 1 ? 74 : 152}
                iconSize={stage === 1 ? 34 : 36}
                progress={shown ? taskProgress(shown, now) : 0}
                style={{ boxShadow: "0 0 0 3px #fff", background: "#484848", transition: "height 240ms ease" }}
                label="Icono de la tarea"
              />
              {stage === 2 && (
                <button aria-label="Color e icono" onClick={() => setSheet("color")} className="absolute -left-2 -bottom-2 flex items-center justify-center w-[42px] h-[42px] rounded-full cursor-pointer" style={{ background: "#585858", color: "#fff", boxShadow: "0 0 0 3px " + LIGHT }}>
                  <Palette size={20} />
                </button>
              )}
            </div>
            {stage === 2 && neighbors.next && (
              <div className="absolute left-0 right-0 flex flex-col items-center" style={{ top: 152 }} aria-label={`Después: ${neighbors.next.title}`}>
                <span className="w-[3px] h-[10px]" style={{ background: "#fff" }} />
                <TaskNode icon={neighbors.next.icon} color={neighbors.next.color} width={74} height={74} iconSize={30} done={neighbors.next.done} style={{ background: "#5b5b5e" }} />
              </div>
            )}
          </div>

          <div className="absolute inset-y-0 flex flex-col justify-start pt-[68px] pr-5" style={{ left: 118, right: 0 }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "#7c7c80" }}>
                  {remaining !== null ? `Tiempo restante: ${durationLabel(remaining)}` : draft.allDay || draft.date === null ? "Sin hora" : `${timeRange(start, draft.durationMin)} (${durationLabel(draft.durationMin)})`}
                </p>
                <input
                  autoFocus={!isEdit}
                  value={draft.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre de la tarea"
                  aria-label="Título"
                  readOnly={locked}
                  className="w-full bg-transparent text-[26px] font-extrabold tracking-tight outline-none placeholder:text-black/30 pb-1"
                  style={{ borderBottom: "1.5px solid rgba(0,0,0,0.55)" }}
                />
              </div>
              <button
                aria-label={doneNow ? "Marcar como pendiente" : "Completar"}
                onClick={() => {
                  haptic("light");
                  if (isEdit && stored) toggleDoneOn(stored.id, viewDate);
                  else patch({ done: !draft.done });
                }}
                className="shrink-0 mt-6 flex items-center justify-center w-[26px] h-[26px] rounded-full cursor-pointer"
                style={{ border: "2.5px solid #111", background: doneNow ? "#111" : "transparent", color: LIGHT }}
              >
                {doneNow && <Check size={16} strokeWidth={4} />}
              </button>
            </div>
            {inProgress && stored && (
              <button onClick={() => onFocus?.(stored.id)} className="mt-4 flex items-center justify-center gap-2 w-full h-12 rounded-full text-[17px] font-extrabold cursor-pointer" style={{ background: "#6b6b6e", color: "#fff" }}>
                <Target size={20} /> Enfócate ahora
              </button>
            )}
          </div>
        </div>

        {/* ---------- Cuerpo ---------- */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
          {stage === 1 ? (
            <>
              <button onClick={() => setSheet("date")} className="flex items-center gap-3 w-full h-14 px-4 rounded-full cursor-pointer text-left" style={{ background: CARD }}>
                <Calendar size={24} />
                <span className="flex-1 text-[19px] font-bold">{dateText(draft.date)}</span>
                <span className="text-[17px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{dateHint(draft.date)} ›</span>
              </button>
              {!draft.allDay && draft.date !== null && (
                <TimeAndDuration
                  startMin={start}
                  durationMin={draft.durationMin}
                  step={step}
                  presets={presets}
                  onStart={(m) => patch({ startMin: m })}
                  onDuration={(m) => patch({ durationMin: m })}
                  onTimeMore={() => setSheet("timeMenu")}
                  onDurationMore={() => setSheet("duration")}
                />
              )}
              {(draft.allDay || draft.date === null) && (
                <div className="mt-6 flex flex-col gap-3">
                  <p className="text-[16px] font-semibold px-1" style={{ color: "rgba(255,255,255,0.55)" }}>{draft.date === null ? "Esta tarea irá a la bandeja, sin hora." : "Tarea de todo el día."}</p>
                  <button onClick={() => patch(draft.date === null ? { date: toISODate(new Date()) } : { allDay: false })} className="h-12 rounded-full text-[16px] font-bold cursor-pointer" style={{ background: CARD }}>
                    {draft.date === null ? "Ponerle fecha" : "Ponerle hora"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-[26px] overflow-hidden" style={{ background: CARD }}>
                <Row icon={<Calendar size={24} />} onClick={locked ? undefined : () => setSheet("date")} right={recurring ? "Inicio" : dateHint(draft.date)}>{dateText(draft.date)}</Row>
                {draft.date !== null && (
                  <Row icon={<Clock size={24} fill="#fff" color={CARD} />} onClick={locked ? undefined : () => (draft.allDay ? patch({ allDay: false }) : setSheet("time"))} right={draft.allDay ? "" : durationLabel(draft.durationMin)} divider>
                    {timeLabel}
                  </Row>
                )}
                {draft.date !== null && (
                  <Row icon={alerts.length ? <Bell size={24} /> : <BellOff size={24} />} onClick={() => setSheet("alerts")} right="Empujoncito" divider>
                    <span data-testid="alerts-summary">{alertsSummary(alerts)}</span>
                  </Row>
                )}
              </div>
              {isImportedSource && (
                <p data-testid="source-banner" className="text-[13px] font-bold mt-3 px-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {SOURCE_LABEL[sourceOf(draft)]}
                  {locked ? " · solo lectura: puedes cambiar color, icono, alertas y subtareas." : " · importado de una lista externa."}
                </p>
              )}
              {!locked && <button
                onClick={() => (draft.date === null ? setHint("Ponle una fecha a la tarea para poder repetirla.") : setSheet("repeat"))}
                aria-label="Repetir"
                className="flex items-center gap-3 h-14 px-5 mt-3 rounded-full cursor-pointer text-[19px] font-bold"
                style={{ background: CARD, color: recurring ? "#fff" : "rgba(255,255,255,0.7)" }}
              >
                <Repeat size={22} /> {recurring ? repeatLabel(draft) : "Repetir"}
              </button>}

              <div className="mt-4 rounded-[26px] p-4" style={{ background: CARD }}>
                {draft.subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2">
                    <button aria-label="Completar subtarea" onClick={() => subtaskToggle(s.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer" style={{ border: "2px solid rgba(255,255,255,0.6)", background: s.done ? "#fff" : "transparent", color: "#111" }}>
                      {s.done && <Check size={16} strokeWidth={4} />}
                    </button>
                    <span className="flex-1 text-[18px] font-semibold" style={{ textDecoration: s.done ? "line-through" : undefined, opacity: s.done ? 0.5 : 1 }}>{s.title}</span>
                    <button aria-label="Quitar subtarea" onClick={() => subtaskRemove(s.id)} className="opacity-50 cursor-pointer"><X size={18} /></button>
                  </div>
                ))}
                <div className="flex items-center gap-3 py-2">
                  <span className="w-6 h-6 rounded-md" style={{ border: "2px solid rgba(255,255,255,0.35)" }} />
                  <input
                    value={subDraft}
                    onChange={(e) => setSubDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitSub()}
                    onBlur={submitSub}
                    placeholder="Añadir subtarea"
                    aria-label="Añadir subtarea"
                    className="flex-1 bg-transparent outline-none text-[18px] font-semibold placeholder:text-white/35"
                  />
                </div>
                <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.1)" }} />
                <textarea
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Añadir notas, reuniones o números de teléfono"
                  aria-label="Notas"
                  rows={5}
                  readOnly={locked}
                  className="w-full bg-transparent outline-none resize-none text-[18px] font-semibold placeholder:text-white/35 pt-2"
                />
              </div>
              {hint && <p role="status" className="text-[14px] font-semibold mt-3 px-2" style={{ color: "rgba(255,255,255,0.6)" }}>{hint}</p>}

              {isEdit && stored && (
                <button
                  onClick={() => (recurring ? setSheet("delete") : removeTask("series"))}
                  className="flex items-center justify-center gap-3 w-full h-14 mt-6 rounded-full text-[19px] font-extrabold cursor-pointer"
                  style={{ background: CARD, color: "#ff453a" }}
                >
                  <Trash2 size={22} /> {locked ? "Quitar de la agenda" : "Eliminar"}
                </button>
              )}
            </>
          )}
        </div>

        {/* ---------- Botón principal ---------- */}
        <div className="absolute left-4 right-4 bottom-4 pb-[env(safe-area-inset-bottom)]">
          {isEdit ? (
            <button onClick={() => onClose()} className="w-full h-14 rounded-full text-[21px] font-extrabold cursor-pointer" style={{ background: "#f4f4f5", color: "#111" }}>
              Listo
            </button>
          ) : (
            <button
              onClick={() => (stage === 1 ? goToDetails() : finishCreate())}
              aria-disabled={stage === 2 && !canCreate}
              className="w-full h-14 rounded-full text-[21px] font-extrabold cursor-pointer active:scale-[0.98] transition-[transform,opacity]"
              style={{ background: "#f4f4f5", color: "#111", opacity: stage === 2 && !canCreate ? 0.45 : 1 }}
            >
              {stage === 1 ? "Continuar" : "Crear tarea"}
            </button>
          )}
        </div>
      </div>

      {/* ---------- Hojas y menús ---------- */}
      {sheet === "more" && stored && (
        <div className="absolute inset-0 z-[75]" onClick={() => setSheet(null)}>
          <div className="absolute right-4 top-[92px] w-[250px] rounded-[26px] p-2" style={{ background: "rgba(38,38,41,0.97)", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
            <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-[17px] font-semibold cursor-pointer" onClick={() => { updateTask(stored.id, { date: null, startMin: null, allDay: false }); setSheet(null); onClose(); }}>
              <Inbox size={20} /> Enviar a la bandeja
            </button>
          </div>
        </div>
      )}
      <DatePickerSheet open={sheet === "date"} onClose={() => setSheet(null)} value={draft.date} allowNone onPick={(d) => patch(d === null ? { date: null, startMin: null, repeat: NO_REPEAT } : { date: d, startMin: draft.startMin ?? firstFreeStart(tasks, d, step, draft.durationMin) })} />
      <Sheet open={sheet === "time" || (sheet === "timeMenu" && stage === 2)} onClose={() => setSheet(null)} title="Tiempo" onMore={() => setSheet("timeMenu")}>
        <div className="-mt-3">
          <TimeWheel startMin={start} durationMin={draft.durationMin} step={step} onChange={(m) => patch({ startMin: m })} />
          <SectionTitle onMore={() => setSheet("duration")} moreLabel="Opciones de duración">Duración</SectionTitle>
          <DurationSegments presets={presets} value={draft.durationMin} onChange={(m) => patch({ durationMin: m })} />
        </div>
      </Sheet>
      <DurationSheet open={sheet === "duration"} onClose={() => setSheet(stage === 2 ? "time" : null)} value={draft.durationMin} onChange={(m) => patch({ durationMin: m })} />
      <TimeMoreMenu
        open={sheet === "timeMenu"}
        onClose={() => setSheet(stage === 2 ? "time" : null)}
        top={stage === 1 ? 318 : 150}
        allDay={draft.allDay}
        onChangeDay={() => setSheet("date")}
        onToggleAllDay={() => patch({ allDay: !draft.allDay })}
        onInbox={() => patch({ date: null, startMin: null, allDay: false, repeat: NO_REPEAT })}
      />
      <ColorIconSheet
        open={sheet === "color"}
        onClose={() => setSheet(null)}
        title={draft.title}
        color={draft.color}
        icon={draft.icon}
        onColor={(c) => patch({ color: c })}
        onIcon={(k) => {
          iconTouched.current = true;
          patch({ icon: k });
        }}
      />
      <AlertsSheet open={sheet === "alerts"} onClose={() => setSheet(null)} alerts={alerts} onChange={(a) => patch({ alerts: a })} allDay={draft.allDay} />
      <RepeatSheet open={sheet === "repeat"} onClose={() => setSheet(null)} task={draft} onChange={(r) => patch({ repeat: r })} />
      <ConfirmSheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title="Eliminar tarea que se repite"
        message="¿Quieres borrar solo este día o toda la serie?"
        actions={[
          { label: "Solo este día", onClick: () => removeTask("day") },
          { label: "Toda la serie", danger: true, onClick: () => removeTask("series") },
        ]}
      />
    </div>
  );
}

function Row({ icon, children, right, onClick, divider }: { icon: React.ReactNode; children: React.ReactNode; right?: string; onClick?: () => void; divider?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 w-full h-[58px] px-5 text-left cursor-pointer relative">
      {divider && <span className="absolute top-0 left-[62px] right-5 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />}
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-[19px] font-bold">{children}</span>
      {right && <span className="text-[17px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{right} ›</span>}
    </button>
  );
}
