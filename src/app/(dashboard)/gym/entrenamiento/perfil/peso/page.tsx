"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { WeightEntryModal } from "@/components/gym/weight-entry-modal";
import { useGymStore } from "@/lib/store/gymStore";

const PERIODS = [
  { label: "3 Meses", months: 3 },
  { label: "6 Meses", months: 6 },
  { label: "1 Año", months: 12 },
];

export default function WeightTrackerPage() {
  const weightEntries = useGymStore((s) => s.weightEntries);
  const addWeightEntry = useGymStore((s) => s.addWeightEntry);
  const removeWeightEntry = useGymStore((s) => s.removeWeightEntry);
  const [period, setPeriod] = useState(PERIODS[1]);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const cutoff = subMonths(new Date(), period.months);
    return weightEntries
      .filter((w) => new Date(w.date) >= cutoff)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weightEntries, period]);

  const chartData = filtered.map((w) => ({ date: format(new Date(w.date), "d MMM", { locale: es }), kg: w.kg }));
  const min = filtered.length ? Math.min(...filtered.map((w) => w.kg)) : 0;
  const max = filtered.length ? Math.max(...filtered.map((w) => w.kg)) : 0;
  const latest = weightEntries[0]?.kg ?? 70;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Peso Corporal</h1>
      </header>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriod(p)}
            className="flex-1 rounded-xl py-1.5 text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: period.label === p.label ? "var(--gym-2)" : "rgba(255,255,255,0.05)",
              color: period.label === p.label ? "white" : "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <GlassCard interactive={false} className="h-52 flex flex-col gap-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="kg" stroke="var(--gym-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gym-2)" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-white/30">Sin registros en este período</div>
        )}
      </GlassCard>

      <div className="flex justify-around text-center">
        <div>
          <p className="text-lg font-bold">{min || "—"}</p>
          <p className="text-xs text-white/45">Mín</p>
        </div>
        <div>
          <p className="text-lg font-bold">{max || "—"}</p>
          <p className="text-xs text-white/45">Máx</p>
        </div>
      </div>

      <GlassButton accentColor="var(--gym-2)" size="lg" onClick={() => setModalOpen(true)}>
        <Plus size={16} /> Registrar Peso
      </GlassButton>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold text-white/85">Registros</h3>
        {weightEntries.length === 0 ? (
          <p className="text-sm text-white/35">Aún no hay registros de peso.</p>
        ) : (
          weightEntries.map((w) => (
            <GlassCard key={w.id} padding="sm" interactive={false} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{w.kg} kg</p>
                <p className="text-xs text-white/40">{format(new Date(w.date), "EEEE d MMM yyyy", { locale: es })}</p>
              </div>
              <button onClick={() => removeWeightEntry(w.id)} className="text-white/30 hover:text-red-400 cursor-pointer p-1.5">
                <Trash2 size={15} />
              </button>
            </GlassCard>
          ))
        )}
      </div>

      <WeightEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialKg={latest}
        onSave={(kg, date) => addWeightEntry(kg, date)}
      />
    </div>
  );
}
