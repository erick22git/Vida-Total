"use client";

import { useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CalendarDays, ListTodo, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { parseICS } from "@/lib/agenda/ics";
import { CALENDAR_COLORS, CALENDAR_PROVIDERS } from "@/lib/agenda/providers";
import { useAgendaStore } from "@/lib/agenda/store";
import type { AgendaCalendar } from "@/lib/agenda/types";
import { PaletteManager } from "./palette";
import { CARD, CHIP } from "./sheet";

const STEPS = [5, 10, 15, 30];

function Card({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="rounded-[28px] p-5 mb-4" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.07)" }}>
      <h3 className="flex items-center gap-2.5 text-[20px] font-extrabold mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Ajustes de la Agenda: calendarios y recordatorios importados, paleta de colores, rueda de hora y alertas. */
export function SettingsView() {
  const calendars = useAgendaStore((s) => s.calendars);
  const sync = useAgendaStore((s) => s.sync);
  const setSync = useAgendaStore((s) => s.setSync);
  const importCalendar = useAgendaStore((s) => s.importCalendar);
  const setVisible = useAgendaStore((s) => s.setCalendarVisible);
  const removeCalendar = useAgendaStore((s) => s.removeCalendar);
  const step = useAgendaStore((s) => s.timeStep);
  const setStep = useAgendaStore((s) => s.setTimeStep);
  const [note, setNote] = useState("");
  const eventsInput = useRef<HTMLInputElement>(null);
  const remindersInput = useRef<HTMLInputElement>(null);

  async function importFile(file: File, kind: "events" | "reminders") {
    setNote("");
    setSync({ state: "syncing" });
    await new Promise((r) => setTimeout(r, 450)); // se ve el estado "sincronizando"
    try {
      const parsed = parseICS(await file.text());
      const items = kind === "events" ? parsed.events : parsed.reminders;
      if (items.length === 0) {
        throw new Error(kind === "events" ? "No se encontraron eventos (VEVENT) en este archivo." : "No se encontraron recordatorios (VTODO) en este archivo.");
      }
      const color = CALENDAR_COLORS[useAgendaStore.getState().calendars.length % CALENDAR_COLORS.length];
      const r = importCalendar({ name: parsed.calendarName ?? file.name.replace(/\.ics$/i, ""), kind, fileName: file.name, color, items });
      setSync({ state: "idle" });
      setNote(`Listo: ${r.added} nuevos · ${r.updated} actualizados · ${r.removed} quitados.`);
    } catch (e) {
      setSync({ state: "error", message: e instanceof Error ? e.message : "No se pudo leer el archivo." });
    }
  }

  const events = calendars.filter((c) => c.kind === "events");
  const reminders = calendars.filter((c) => c.kind === "reminders");

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-40" data-testid="settings-view">
      <Card title="Calendarios" icon={<CalendarDays size={22} />}>
        <StatusLine list={events} sync={sync} kind="events" />
        <CalendarList list={events} onVisible={setVisible} onRemove={removeCalendar} />
        <ImportButton label="Importar archivo .ics" onFile={(f) => importFile(f, "events")} inputRef={eventsInput} disabled={sync.state === "syncing"} />
        {sync.state === "error" && (
          <p role="alert" className="flex items-start gap-2 text-[14px] font-semibold mt-3 px-1" style={{ color: "#ff8a80" }}>
            <AlertTriangle size={17} className="shrink-0 mt-0.5" /> {sync.message}
          </p>
        )}
        {note && <p role="status" className="text-[14px] font-semibold mt-3 px-1" style={{ color: "rgba(255,255,255,0.65)" }}>{note}</p>}
        <div className="mt-4 flex flex-col gap-2">
          {CALENDAR_PROVIDERS.filter((p) => !p.available).map((p) => (
            <div key={p.id} className="rounded-2xl p-3.5 opacity-70" style={{ background: CARD }} data-provider={p.id}>
              <p className="flex items-center gap-2 text-[16px] font-extrabold"><Lock size={15} /> {p.label} <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: CHIP }}>No disponible aún</span></p>
              <p className="text-[13px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{p.reason}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Permisos: {p.permissions}</p>
            </div>
          ))}
        </div>
        <p className="text-[13px] font-semibold mt-3 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          Los eventos se traen en una sola dirección y son de solo lectura (puedes cambiar su color e icono). Al volver a importar el mismo archivo se actualizan sin duplicarse.
        </p>
      </Card>

      <Card title="Recordatorios" icon={<ListTodo size={22} />}>
        <StatusLine list={reminders} sync={sync} kind="reminders" />
        <CalendarList list={reminders} onVisible={setVisible} onRemove={removeCalendar} />
        <ImportButton label="Importar recordatorios (.ics)" onFile={(f) => importFile(f, "reminders")} inputRef={remindersInput} disabled={sync.state === "syncing"} />
        <p className="text-[13px] font-semibold mt-3 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          Los recordatorios sin fecha entran a la Bandeja; los que tienen fecha y hora aparecen en la línea de tiempo con una campana.
        </p>
      </Card>

      <Card title="Paleta de colores">
        <PaletteManager />
      </Card>

      <Card title="Rueda de hora">
        <div className="flex gap-2" role="radiogroup" aria-label="Intervalo de la rueda de hora">
          {STEPS.map((s) => (
            <button key={s} role="radio" aria-checked={step === s} onClick={() => setStep(s)} className="flex-1 h-11 rounded-full text-[15px] font-extrabold cursor-pointer" style={{ background: step === s ? "#fff" : CHIP, color: step === s ? "#111" : "rgba(255,255,255,0.75)" }}>
              {s} min
            </button>
          ))}
        </div>
      </Card>

      <Card title="Alertas">
        <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
          Cada tarea guarda sus propias alertas (hasta 5, a la hora, minutos, horas o días antes). La configuración ya funciona y se guarda; el aviso en el teléfono llegará en la siguiente fase.
        </p>
      </Card>
    </div>
  );
}

function StatusLine({ list, sync, kind }: { list: AgendaCalendar[]; sync: { state: string }; kind: "events" | "reminders" }) {
  const noun = kind === "events" ? "calendario" : "lista";
  const text =
    sync.state === "syncing"
      ? "Sincronizando…"
      : list.length === 0
        ? "Desconectado · nada importado todavía"
        : `Conectado · ${list.length} ${list.length === 1 ? noun : noun === "lista" ? "listas" : "calendarios"} (${list.reduce((n, c) => n + c.count, 0)} elementos)`;
  return (
    <p data-testid={`status-${kind}`} className="flex items-center gap-2 text-[15px] font-bold mb-3" style={{ color: list.length ? "#7ee787" : "rgba(255,255,255,0.55)" }}>
      {sync.state === "syncing" ? <Loader2 size={16} className="animate-spin" /> : <span className="w-2.5 h-2.5 rounded-full" style={{ background: list.length ? "#7ee787" : "rgba(255,255,255,0.35)" }} />}
      {text}
    </p>
  );
}

function CalendarList({ list, onVisible, onRemove }: { list: AgendaCalendar[]; onVisible: (id: string, v: boolean) => void; onRemove: (id: string) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-3">
      {list.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: CARD }} data-calendar={c.name}>
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-extrabold truncate">{c.name}</p>
            <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{c.count} elementos · {format(c.importedAt, "d MMM HH:mm", { locale: es }).replace(".", "")}</p>
          </div>
          <button role="switch" aria-checked={c.visible} aria-label={`Mostrar ${c.name}`} onClick={() => onVisible(c.id, !c.visible)} className="w-12 h-7 rounded-full relative cursor-pointer shrink-0" style={{ background: c.visible ? "#fff" : "#3a3a3d" }}>
            <span className="absolute top-1 w-5 h-5 rounded-full transition-all" style={{ left: c.visible ? "calc(100% - 1.5rem)" : "0.25rem", background: c.visible ? "#111" : "#fff" }} />
          </button>
          <button aria-label={`Quitar ${c.name}`} onClick={() => onRemove(c.id)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shrink-0" style={{ background: CHIP }}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ImportButton({ label, onFile, inputRef, disabled }: { label: string; onFile: (f: File) => void; inputRef: React.RefObject<HTMLInputElement | null>; disabled?: boolean }) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".ics,text/calendar"
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button disabled={disabled} onClick={() => inputRef.current?.click()} className="flex items-center justify-center gap-2 w-full h-12 rounded-full text-[16px] font-extrabold cursor-pointer disabled:opacity-50" style={{ background: "#f4f4f5", color: "#111" }}>
        {disabled ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={3} />} {label}
      </button>
    </>
  );
}

