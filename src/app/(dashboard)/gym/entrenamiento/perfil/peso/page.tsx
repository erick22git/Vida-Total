"use client";

/**
 * Peso corporal: gráfica en blanco (puntos del día + tendencia de 7 días + línea de tu meta), cambio del período,
 * progreso hacia la meta, y lista de registros con confirmación al borrar. La meta vive en el perfil
 * (`gymProfile.pesoObjetivoKg`, también se pide en el formulario del perfil de entrenamiento).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Target, Trash2 } from "lucide-react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WeightEntryModal } from "@/components/gym/weight-entry-modal";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "Todo", months: 0 },
] as const;

const WHITE = "#ffffff";

export default function WeightTrackerPage() {
  const weightEntries = useGymStore((s) => s.weightEntries);
  const addWeightEntry = useGymStore((s) => s.addWeightEntry);
  const removeWeightEntry = useGymStore((s) => s.removeWeightEntry);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const updateGymProfileFields = useGymStore((s) => s.updateGymProfileFields);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[2]);
  const [modalOpen, setModalOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const goal = gymProfile?.pesoObjetivoKg;
  const sorted = useMemo(() => [...weightEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [weightEntries]);
  const latest = weightEntries[0]?.kg ?? gymProfile?.pesoKg ?? 70;

  const { points, first, last, min, max } = useMemo(() => {
    const cutoff = period.months ? subMonths(new Date(), period.months) : null;
    const inRange = sorted.filter((w) => !cutoff || new Date(w.date) >= cutoff);
    // Tendencia: promedio de los 7 días hasta cada punto (el peso diario sube y baja por agua y sodio).
    const pts = inRange.map((w) => {
      const t = new Date(w.date).getTime();
      const win = sorted.filter((x) => {
        const xt = new Date(x.date).getTime();
        return xt <= t && xt >= t - 6 * 86400000;
      });
      const trend = win.reduce((a, x) => a + x.kg, 0) / win.length;
      return { label: format(new Date(w.date), "d MMM", { locale: es }), kg: w.kg, trend: Math.round(trend * 10) / 10 };
    });
    const kgs = inRange.map((w) => w.kg);
    return {
      points: pts,
      first: inRange[0]?.kg,
      last: inRange[inRange.length - 1]?.kg,
      min: kgs.length ? Math.min(...kgs) : undefined,
      max: kgs.length ? Math.max(...kgs) : undefined,
    };
  }, [sorted, period]);

  const delta = first !== undefined && last !== undefined ? Math.round((last - first) * 10) / 10 : null;
  const startAll = sorted[0]?.kg;
  const progressPct =
    goal && startAll !== undefined && goal !== startAll ? Math.max(0, Math.min(100, Math.round(((startAll - latest) / (startAll - goal)) * 100))) : null;
  const toGoal = goal ? Math.round((latest - goal) * 10) / 10 : null;
  const domainLo = Math.min(min ?? latest, goal ?? Infinity) - 2;
  const domainHi = Math.max(max ?? latest, goal ?? -Infinity) + 2;
  const deleting = weightEntries.find((w) => w.id === toDelete);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" aria-label="Volver al perfil" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Peso corporal</h1>
      </header>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-5xl font-extrabold tabular-nums">
            {latest} <span className="text-lg font-semibold text-white/40">kg</span>
          </p>
          <p className="text-xs text-white/45 mt-1">
            {delta === null ? "Sin cambios en este período" : `${delta > 0 ? "+" : ""}${delta} kg en este período`}
          </p>
        </div>
        <button
          onClick={() => {
            setGoalText(goal ? String(goal) : "");
            setGoalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          <Target size={14} /> {goal ? `Meta ${goal} kg` : "Poner meta"}
        </button>
      </div>

      {goal && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progressPct ?? 0}%` }} />
          </div>
          <p className="text-[11px] text-white/45">
            {toGoal !== null && Math.abs(toGoal) < 0.1 ? "¡Llegaste a tu meta!" : `Te ${toGoal! > 0 ? "faltan" : "pasaste"} ${Math.abs(toGoal!)} kg ${toGoal! > 0 ? "para" : "de"} tu meta`}
            {progressPct !== null ? ` · ${progressPct} % del camino` : ""}
          </p>
        </div>
      )}

      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-semibold cursor-pointer border transition-colors",
              period.label === p.label ? "bg-white text-black border-white" : "bg-transparent text-white/60 border-white/15",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="h-56 rounded-3xl bg-white/[0.04] p-3">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="kgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={WHITE} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={WHITE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis hide domain={[domainLo, domainHi]} />
              {goal && <ReferenceLine y={goal} stroke="rgba(255,255,255,0.55)" strokeDasharray="4 4" label={{ value: `meta ${goal}`, fill: "rgba(255,255,255,0.6)", fontSize: 10, position: "insideTopRight" }} />}
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.25)" }}
                contentStyle={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12, color: "#fff" }}
                formatter={(v, name) => [`${v} kg`, name === "trend" ? "Tendencia 7 d" : "Peso"]}
              />
              <Area type="monotone" dataKey="trend" stroke="none" fill="url(#kgFill)" />
              <Line type="monotone" dataKey="trend" stroke={WHITE} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="kg" stroke="rgba(255,255,255,0.0)" dot={{ r: 3, fill: WHITE, stroke: "#000", strokeWidth: 1 }} activeDot={{ r: 5, fill: WHITE }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-white/35">Sin registros en este período</div>
        )}
      </div>

      <div className="grid grid-cols-3 text-center">
        <Stat label="Mínimo" value={min} />
        <Stat label="Máximo" value={max} />
        <Stat label="Registros" value={points.length} suffix="" />
      </div>

      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-white text-black text-base font-bold cursor-pointer active:scale-[0.98] transition-transform"
      >
        <Plus size={18} /> Registrar peso
      </button>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-white/85">Registros</h3>
        {weightEntries.length === 0 ? (
          <p className="text-sm text-white/40">Aún no hay registros de peso.</p>
        ) : (
          weightEntries.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white tabular-nums">{w.kg} kg</p>
                <p className="text-xs text-white/45 capitalize">{format(new Date(w.date), "EEEE d MMM yyyy", { locale: es })}</p>
              </div>
              <button onClick={() => setToDelete(w.id)} aria-label="Borrar registro" className="text-white/40 hover:text-white cursor-pointer p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <WeightEntryModal key={latest} open={modalOpen} onClose={() => setModalOpen(false)} initialKg={latest} onSave={(kg, date) => addWeightEntry(kg, date)} />

      <ExpandSheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Meta de peso">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm text-white/55">Tu meta se muestra en la gráfica y en tu perfil. Déjala vacía para quitarla.</p>
          <label className="flex items-baseline justify-center gap-2">
            <input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              inputMode="decimal"
              placeholder={String(latest)}
              aria-label="Meta de peso en kilogramos"
              className="w-32 bg-transparent text-center text-5xl font-extrabold text-white outline-none tabular-nums placeholder:text-white/20"
            />
            <span className="text-lg text-white/40">kg</span>
          </label>
          <button
            onClick={() => {
              const v = parseFloat(goalText.replace(",", "."));
              updateGymProfileFields({ pesoObjetivoKg: v > 0 ? Math.round(v * 10) / 10 : undefined });
              setGoalOpen(false);
            }}
            className="w-full min-h-[52px] rounded-2xl bg-white text-black text-base font-bold cursor-pointer"
          >
            Guardar meta
          </button>
        </div>
      </ExpandSheet>

      <ExpandSheet open={!!toDelete} onClose={() => setToDelete(null)} title="¿Borrar este peso?">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm text-white/65">
            {deleting ? `Se borra el registro de ${deleting.kg} kg del ${format(new Date(deleting.date), "d MMM yyyy", { locale: es })}.` : ""} Esto no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setToDelete(null)} className="flex-1 rounded-full py-3 text-sm font-semibold text-white/80 bg-white/[0.08] cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (toDelete) removeWeightEntry(toDelete);
                setToDelete(null);
              }}
              className="flex-1 rounded-full py-3 text-sm font-semibold text-black bg-white cursor-pointer"
            >
              Sí, borrar
            </button>
          </div>
        </div>
      </ExpandSheet>
    </div>
  );
}

function Stat({ label, value, suffix = " kg" }: { label: string; value: number | undefined; suffix?: string }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">{value !== undefined ? `${value}${suffix}` : "—"}</p>
      <p className="text-xs text-white/45">{label}</p>
    </div>
  );
}
