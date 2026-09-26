"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, addMonths, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Globe, Inbox, RotateCcw, Search, Sparkles, SunMedium, X, Check, History } from "lucide-react";
import { AGENDA_ICONS, getAgendaIcon, matchIcons, searchIcons } from "@/lib/agenda/icons";
import { getLoadedIcons, isLucideKey, loadAllIcons, lucideKey, lucideName, searchAllIcons } from "@/lib/agenda/all-icons";
import { DEFAULT_DURATION_PRESETS, useAgendaStore } from "@/lib/agenda/store";
import { durationLabel, toISODate } from "@/lib/agenda/time";
import { CARD, CHIP, RoundButton, Sheet } from "./sheet";
import { AgendaIcon } from "./agenda-icon";
import { PaletteManager } from "./palette";
import { WheelPicker } from "./wheel-picker";

/* ---------------------------------- Duración ---------------------------------- */
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 }, (_, m) => m);

export function DurationSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: number; onChange: (min: number) => void }) {
  const presets = useAgendaStore((s) => s.durationPresets);
  const setPresets = useAgendaStore((s) => s.setDurationPresets);
  const h = Math.floor(value / 60);
  const m = value % 60;
  const set = (nh: number, nm: number) => onChange(Math.max(1, nh * 60 + nm));
  return (
    <Sheet open={open} onClose={onClose} title="Duración">
      <div className="grid grid-cols-2 gap-2">
        <WheelPicker
          variant="soft"
          items={HOURS.map((x) => ({ value: x, label: x === h ? `${x}  horas` : String(x) }))}
          value={h}
          onChange={(x) => set(x, m)}
          itemHeight={40}
          ariaLabel="Horas"
        />
        <WheelPicker
          variant="soft"
          items={MINUTES.map((x) => ({ value: x, label: x === m ? `${x}  min` : String(x) }))}
          value={m}
          onChange={(x) => set(h, x)}
          itemHeight={40}
          ariaLabel="Minutos"
        />
      </div>
      <div className="flex items-center justify-between mt-5 mb-3">
        <h3 className="text-[20px] font-extrabold">Preajustes</h3>
        <button
          onClick={() => setPresets(DEFAULT_DURATION_PRESETS)}
          className="flex items-center gap-2 h-10 px-4 rounded-full text-[15px] font-bold cursor-pointer"
          style={{ background: CHIP }}
        >
          <RotateCcw size={16} /> Restablecer
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {presets.map((p) => (
          <div key={p} className="flex items-center justify-between h-12 pl-4 pr-3 rounded-full text-[16px] font-bold" style={{ background: "#232326" }}>
            <button onClick={() => onChange(p)} className="cursor-pointer">
              {durationLabel(p)}
            </button>
            <button aria-label={`Quitar ${durationLabel(p)}`} onClick={() => presets.length > 1 && setPresets(presets.filter((x) => x !== p))} className="cursor-pointer opacity-70">
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        ))}
        {!presets.includes(value) && (
          <button onClick={() => setPresets([...presets, value])} className="flex items-center justify-center gap-1 h-12 rounded-full text-[15px] font-bold cursor-pointer" style={{ background: "#232326", border: "1px dashed rgba(255,255,255,0.3)" }}>
            + {durationLabel(value)}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------ Fecha ----------------------------------- */
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function DatePickerSheet({ open, onClose, value, onPick, allowNone }: { open: boolean; onClose: () => void; value: string | null; onPick: (date: string | null) => void; allowNone?: boolean }) {
  const [month, setMonth] = useState(() => startOfMonth(value ? new Date(`${value}T12:00:00`) : new Date()));
  const [menu, setMenu] = useState(false);
  const today = toISODate(new Date());
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const lead = (getDay(first) + 6) % 7; // lunes = 0
    const days = endOfMonth(month).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
  }, [month]);
  const pick = (d: string | null) => {
    onPick(d);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {toISODate(month).slice(0, 7) !== today.slice(0, 7) && (
            <button aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))} className="cursor-pointer -ml-1 mr-1">
              <ChevronLeft size={24} strokeWidth={3} />
            </button>
          )}
          <button onClick={() => setMonth(addMonths(month, 1))} className="flex items-center gap-1 text-[24px] font-extrabold tracking-tight cursor-pointer" aria-label="Mes siguiente">
            {format(month, "MMM yyyy", { locale: es }).replace(".", "")} <ChevronRight size={24} strokeWidth={3} />
          </button>
        </div>
        <div className="flex items-center gap-2 relative">
          <RoundButton label="Atajos de fecha" onClick={() => setMenu((v) => !v)}>
            <span className="text-[18px] leading-none tracking-widest">•••</span>
          </RoundButton>
          <RoundButton label="Cerrar" onClick={onClose}>
            <X size={20} strokeWidth={2.6} />
          </RoundButton>
          {menu && (
            <div className="absolute right-0 top-12 z-10 w-48 rounded-2xl p-1.5" style={{ background: "#3a3a3d", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              <MenuRow onClick={() => pick(today)} icon={<SunMedium size={18} />}>Hoy</MenuRow>
              <MenuRow onClick={() => pick(toISODate(addDays(new Date(), 1)))} icon={<CalendarDays size={18} />}>Mañana</MenuRow>
              {allowNone && <MenuRow onClick={() => pick(null)} icon={<Inbox size={18} />}>Sin fecha</MenuRow>}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[15px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const iso = format(new Date(month.getFullYear(), month.getMonth(), d), "yyyy-MM-dd");
          const sel = iso === value;
          return (
            <button key={iso} onClick={() => pick(iso)} className="flex items-center justify-center h-12 cursor-pointer">
              <span
                className="flex items-center justify-center w-11 h-11 rounded-full text-[19px] font-extrabold"
                style={{ background: sel ? "#fff" : "transparent", color: sel ? "#111" : "#fff", boxShadow: !sel && iso === today ? "inset 0 0 0 2px rgba(255,255,255,0.45)" : undefined }}
              >
                {d}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ------------------------------------ Menú ------------------------------------ */
export function MenuRow({ icon, children, onClick, disabled, chevron }: { icon: ReactNode; children: ReactNode; onClick?: () => void; disabled?: boolean; chevron?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl text-[17px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 leading-tight">{children}</span>
      {chevron && <ChevronRight size={18} />}
    </button>
  );
}

const STEPS = [5, 10, 15, 30];

/** Menú "•••" de Tiempo: cambiar día, todo el día, bandeja y paso de la rueda. */
export function TimeMoreMenu({
  open, onClose, top = 300, allDay, onChangeDay, onToggleAllDay, onInbox,
}: { open: boolean; onClose: () => void; top?: number; allDay: boolean; onChangeDay: () => void; onToggleAllDay: () => void; onInbox: () => void }) {
  const step = useAgendaStore((s) => s.timeStep);
  const setStep = useAgendaStore((s) => s.setTimeStep);
  const [sub, setSub] = useState(false);
  if (!open) return null;
  const close = () => {
    setSub(false);
    onClose();
  };
  return (
    <div className="absolute inset-0 z-[75]" onClick={close}>
      <div className="absolute right-4 w-[262px] rounded-[28px] p-2" style={{ top, background: "rgba(38,38,41,0.96)", boxShadow: "0 16px 50px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        {!sub ? (
          <>
            <MenuRow icon={<CalendarDays size={22} />} onClick={() => { close(); onChangeDay(); }}>Cambiar día</MenuRow>
            <MenuRow icon={<Globe size={22} />} disabled>Establecer zona horaria</MenuRow>
            <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            <MenuRow icon={<Clock3 size={22} />} onClick={() => { close(); onToggleAllDay(); }}>{allDay ? "Cambiar a Con hora" : "Cambiar a Todo el día"}</MenuRow>
            <MenuRow icon={<Inbox size={22} />} onClick={() => { close(); onInbox(); }}>Añadir a la bandeja de entrada</MenuRow>
            <div className="h-px mx-3 my-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            <MenuRow icon={<Clock3 size={22} />} chevron onClick={() => setSub(true)}>Selección de tiempo</MenuRow>
          </>
        ) : (
          <>
            <button onClick={() => setSub(false)} className="flex items-center gap-2 px-3 py-2 text-[15px] font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.6)" }}>
              <ChevronLeft size={18} /> Intervalo de la rueda
            </button>
            {STEPS.map((s) => (
              <MenuRow key={s} icon={step === s ? <Check size={20} /> : <span className="w-5" />} onClick={() => { setStep(s); close(); }}>
                {s} min
              </MenuRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Color e icono -------------------------------- */
const PAGE = 120;

export function ColorIconSheet({
  open, onClose, title, color, icon, onColor, onIcon,
}: { open: boolean; onClose: () => void; title: string; color: string; icon: string; onColor: (c: string) => void; onIcon: (k: string) => void }) {
  const recents = useAgendaStore((s) => s.recentIcons);
  const pushRecent = useAgendaStore((s) => s.pushRecentIcon);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Record<string, unknown> | null>(getLoadedIcons());
  const [browse, setBrowse] = useState(false);
  const [shown, setShown] = useState(PAGE);
  // La biblioteca completa (~1800 iconos) se carga solo al buscar o al explorar.
  useEffect(() => {
    if ((q || browse) && !all) loadAllIcons().then((m) => setAll(m));
  }, [q, browse, all]);
  const names = useMemo(() => (all ? Object.keys(all) : []), [all]);
  const suggestions = useMemo(() => {
    const m = matchIcons(title).slice(0, 3);
    const rest = AGENDA_ICONS.filter((i) => !m.includes(i)).slice(0, Math.max(0, 3 - m.length));
    return [...m, ...rest];
  }, [title]);
  const curatedHits = q ? searchIcons(q).map((i) => i.key) : [];
  const libHits = q ? searchAllIcons(q, names).map(lucideKey) : browse ? names.map(lucideKey) : [];
  const results = q ? [...new Set([...curatedHits, ...libHits])] : browse ? libHits.slice(0, shown) : AGENDA_ICONS.map((i) => i.key);
  const pick = (k: string) => {
    onIcon(k);
    pushRecent(k);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Color e icono" maxHeight="82%">
      <PaletteManager value={color} onPick={onColor} />
      {!q && (
        <>
          <Label icon={<Sparkles size={16} />}>Sugerencias</Label>
          <IconRow keys={suggestions.map((i) => i.key)} value={icon} onPick={pick} />
          {recents.length > 0 && (
            <>
              <Label icon={<History size={16} />}>Recientes</Label>
              <IconRow keys={recents} value={icon} onPick={pick} />
            </>
          )}
        </>
      )}
      <Label icon={<Search size={16} />}>{q ? `Resultados (${results.length})` : browse ? "Toda la biblioteca" : "Populares"}</Label>
      {q && results.length === 0 && (all ? <p className="text-[15px] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Sin resultados. Prueba con otra palabra.</p> : <p className="text-[15px] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Buscando…</p>)}
      <div className="grid grid-cols-6 gap-2.5 mb-3" data-testid="icon-grid">
        {results.map((k) => (
          <IconButton key={k} k={k} selected={icon === k} onPick={pick} />
        ))}
      </div>
      {!q && !browse && (
        <button onClick={() => setBrowse(true)} className="w-full h-11 rounded-full text-[15px] font-extrabold cursor-pointer mb-3" style={{ background: CHIP }}>
          Ver toda la biblioteca
        </button>
      )}
      {browse && !q && names.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE)} className="w-full h-11 rounded-full text-[15px] font-extrabold cursor-pointer mb-3" style={{ background: CHIP }}>
          Ver más
        </button>
      )}
      <label className="flex items-center gap-3 h-12 px-4 rounded-full sticky bottom-0" style={{ background: "#3b3b3f" }}>
        <Search size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar icono" placeholder="Buscar (comida, gym, viaje…)" className="flex-1 bg-transparent outline-none text-[17px] font-semibold placeholder:text-white/60" />
      </label>
    </Sheet>
  );
}

function Label({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <div className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[15px] font-extrabold mb-2.5 mt-1" style={{ background: "#232326" }}>
      {icon}
      {children}
    </div>
  );
}

function IconButton({ k, selected, onPick }: { k: string; selected: boolean; onPick: (k: string) => void }) {
  const label = isLucideKey(k) ? lucideName(k) : getAgendaIcon(k).label;
  return (
    <button aria-label={label} aria-pressed={selected} data-icon={k} onClick={() => onPick(k)} className="flex items-center justify-center aspect-square rounded-full cursor-pointer" style={{ background: selected ? "#fff" : "#1d1d20", color: selected ? "#111" : "#fff" }}>
      <AgendaIcon k={k} size={22} />
    </button>
  );
}

function IconRow({ keys, value, onPick }: { keys: string[]; value: string; onPick: (k: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2.5 mb-3">
      {keys.map((k) => (
        <IconButton key={k} k={k} selected={value === k} onPick={onPick} />
      ))}
    </div>
  );
}

export { CARD };
