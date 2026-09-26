"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check } from "lucide-react";
import { COPY_SPANS, planCopy } from "@/lib/agenda/copy";
import { isRecurring, repeatLabel, repeatOf } from "@/lib/agenda/recurrence";
import { useAgendaStore } from "@/lib/agenda/store";
import { timeRange } from "@/lib/agenda/time";
import { NO_REPEAT, type AgendaRepeat, type AgendaTask } from "@/lib/agenda/types";
import { haptic } from "@/lib/haptics/haptic";
import { DatePickerSheet } from "./pickers";
import { CARD, CHIP, Sheet } from "./sheet";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-full text-[16px] font-extrabold cursor-pointer transition-colors"
      style={{ background: selected ? "#fff" : CHIP, color: selected ? "#111" : "rgba(255,255,255,0.75)" }}
    >
      {selected && <Check size={16} strokeWidth={4} />}
      {children}
    </button>
  );
}

function ActionButton({ onClick, disabled, children, danger }: { onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-14 rounded-full text-[19px] font-extrabold cursor-pointer disabled:opacity-35 disabled:cursor-default active:scale-[0.98] transition-transform"
      style={{ background: danger ? "#ff453a" : "#f4f4f5", color: danger ? "#fff" : "#111" }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------ Repetir ------------------------------------ */
/** Repetición real: no se repite / todos los días / días concretos de la semana, con fecha final opcional. */
export function RepeatSheet({ open, onClose, task, onChange }: { open: boolean; onClose: () => void; task: Pick<AgendaTask, "repeat" | "date">; onChange: (r: AgendaRepeat) => void }) {
  const r = repeatOf(task);
  const [pickUntil, setPickUntil] = useState(false);
  const baseDay = task.date ? new Date(`${task.date}T12:00:00`).getDay() : new Date().getDay();
  const mode: "none" | "daily" | "weekly" = r.freq;
  const activeDays = r.freq === "weekly" ? (r.days.length ? r.days : [baseDay]) : [];
  const set = (next: Partial<AgendaRepeat>) => onChange({ ...r, ...next });
  return (
    <Sheet open={open} onClose={onClose} title="Repetir">
      <div className="flex flex-col gap-2.5">
        <ModeRow selected={mode === "none"} onClick={() => onChange(NO_REPEAT)}>No se repite</ModeRow>
        <ModeRow selected={mode === "daily"} onClick={() => set({ freq: "daily", days: [] })}>Todos los días</ModeRow>
        <ModeRow selected={mode === "weekly"} onClick={() => set({ freq: "weekly", days: r.days.length ? r.days : [baseDay] })}>Días de la semana</ModeRow>
      </div>
      {mode === "weekly" && (
        <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Días de la semana">
          {WEEK_ORDER.map((d) => (
            <Chip
              key={d}
              selected={activeDays.includes(d)}
              onClick={() => {
                const next = activeDays.includes(d) ? activeDays.filter((x) => x !== d) : [...activeDays, d];
                if (next.length > 0) set({ freq: "weekly", days: next });
              }}
            >
              {SHORT[d]}
            </Chip>
          ))}
        </div>
      )}
      {mode !== "none" && (
        <div className="mt-5">
          <p className="text-[15px] font-bold mb-2 px-1" style={{ color: "rgba(255,255,255,0.55)" }}>Termina</p>
          <div className="flex gap-2">
            <Chip selected={!r.until} onClick={() => set({ until: null })}>Nunca</Chip>
            <Chip selected={!!r.until} onClick={() => setPickUntil(true)}>{r.until ? format(new Date(`${r.until}T12:00:00`), "d MMM yyyy", { locale: es }).replace(".", "") : "En una fecha"}</Chip>
          </div>
        </div>
      )}
      {mode !== "none" && <p className="text-[14px] font-semibold mt-4 px-1" style={{ color: "rgba(255,255,255,0.5)" }}>{repeatLabel({ repeat: r, date: task.date })}</p>}
      <div className="mt-5">
        <ActionButton onClick={onClose}>Listo</ActionButton>
      </div>
      <DatePickerSheet open={pickUntil} onClose={() => setPickUntil(false)} value={r.until} onPick={(d) => set({ until: d })} />
    </Sheet>
  );
}

function ModeRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button role="radio" aria-checked={selected} onClick={onClick} className="flex items-center justify-between h-14 px-5 rounded-full text-[19px] font-bold cursor-pointer" style={{ background: "#232326" }}>
      {children}
      {selected && <Check size={22} strokeWidth={3.4} />}
    </button>
  );
}

/* ------------------------------------ Copiar ------------------------------------- */
/** Copia las tareas de un día a otros días. Solo escribe al pulsar "Copiar"; abrir o cerrar la hoja no crea nada. */
export function CopyTasksSheet({ open, onClose, sourceDate, tasks }: { open: boolean; onClose: () => void; sourceDate: string; tasks: AgendaTask[] }) {
  const all = useAgendaStore((s) => s.tasks);
  const applyCopy = useAgendaStore((s) => s.applyCopy);
  const copyable = useMemo(() => tasks.filter((t) => !isRecurring(t)).sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0)), [tasks]);
  const [chosen, setChosen] = useState<string[] | null>(null); // null = todas
  const [days, setDays] = useState<number[]>([]);
  const [span, setSpan] = useState<number>(COPY_SPANS[0].days);
  const [done, setDone] = useState<string>("");
  const ids = chosen ?? copyable.map((t) => t.id);
  const allWeek = days.length === 7;
  const plan = useMemo(() => planCopy(all, sourceDate, ids, days, span), [all, sourceDate, ids, days, span]);
  const reset = () => {
    setChosen(null);
    setDays([]);
    setDone("");
  };
  const close = () => {
    reset();
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Copiar tareas del día" maxHeight="90%">
      {copyable.length === 0 ? (
        <p className="text-[16px] font-semibold py-6 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>Este día no tiene tareas para copiar.</p>
      ) : done ? (
        <div className="py-4">
          <p className="text-[20px] font-extrabold text-center">{done}</p>
          <div className="mt-5"><ActionButton onClick={close}>Listo</ActionButton></div>
        </div>
      ) : (
        <>
          <p className="text-[15px] font-bold mb-2 px-1" style={{ color: "rgba(255,255,255,0.55)" }}>Tareas a copiar</p>
          <div className="flex flex-col gap-2 mb-4" role="group" aria-label="Tareas a copiar">
            {copyable.map((t) => {
              const on = ids.includes(t.id);
              return (
                <button key={t.id} role="checkbox" aria-checked={on} onClick={() => setChosen(on ? ids.filter((x) => x !== t.id) : [...ids, t.id])} className="flex items-center gap-3 h-14 px-4 rounded-2xl text-left cursor-pointer" style={{ background: "#232326" }}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ border: "2px solid rgba(255,255,255,0.6)", background: on ? "#fff" : "transparent", color: "#111" }}>{on && <Check size={16} strokeWidth={4} />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-extrabold truncate">{t.title}</span>
                    <span className="block text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{t.startMin === null || t.allDay ? "Todo el día" : timeRange(t.startMin, t.durationMin)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[15px] font-bold mb-2 px-1" style={{ color: "rgba(255,255,255,0.55)" }}>Copiar a</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
            <Chip selected={allWeek} onClick={() => setDays(allWeek ? [] : [0, 1, 2, 3, 4, 5, 6])}>Todos los días</Chip>
            {WEEK_ORDER.map((d) => (
              <Chip key={d} selected={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{SHORT[d]}</Chip>
            ))}
          </div>

          <p className="text-[15px] font-bold mt-4 mb-2 px-1" style={{ color: "rgba(255,255,255,0.55)" }}>Durante los próximos</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Alcance">
            {COPY_SPANS.map((s) => (
              <button key={s.days} role="radio" aria-checked={span === s.days} onClick={() => setSpan(s.days)} className="flex-1 h-11 rounded-full text-[15px] font-extrabold cursor-pointer" style={{ background: span === s.days ? "#fff" : CHIP, color: span === s.days ? "#111" : "rgba(255,255,255,0.75)" }}>
                {s.label}
              </button>
            ))}
          </div>

          <p data-testid="copy-summary" className="text-[15px] font-semibold mt-4 px-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            {days.length === 0 ? "Elige a qué días copiar." : `Se crearán ${plan.create.length} ${plan.create.length === 1 ? "tarea" : "tareas"}${plan.skipped ? ` · ${plan.skipped} ya existen y se omiten` : ""}.`}
          </p>
          <div className="mt-4">
            <ActionButton
              disabled={plan.create.length === 0}
              onClick={() => {
                const n = applyCopy(plan);
                haptic("success");
                setDone(`Listo: ${n} ${n === 1 ? "tarea copiada" : "tareas copiadas"}.`);
              }}
            >
              Copiar
            </ActionButton>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------------------------------- Confirmaciones ---------------------------------- */
export function ConfirmSheet({ open, onClose, title, message, actions }: { open: boolean; onClose: () => void; title: string; message?: string; actions: { label: string; danger?: boolean; onClick: () => void }[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} z={90}>
      {message && <p className="text-[16px] font-semibold mb-4 px-1" style={{ color: "rgba(255,255,255,0.6)" }}>{message}</p>}
      <div className="flex flex-col gap-2.5">
        {actions.map((a) => (
          <ActionButton key={a.label} danger={a.danger} onClick={a.onClick}>{a.label}</ActionButton>
        ))}
        <button onClick={onClose} className="h-12 rounded-full text-[17px] font-bold cursor-pointer" style={{ background: CARD, color: "rgba(255,255,255,0.8)" }}>Cancelar</button>
      </div>
    </Sheet>
  );
}
