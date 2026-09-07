"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Star, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { differenceInCalendarDays, format } from "date-fns";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassModal } from "@/components/glass/glass-modal";
import { usePazMentalStore, todayISO } from "@/lib/store/pazMentalStore";
import type { SkinCondition } from "@/lib/types/paz-mental";

const CONDITIONS: SkinCondition[] = ["Acné", "Rosácea", "Manchas", "General"];
const SKIN_EMOJIS = ["😖", "😕", "😐", "🙂", "✨"];

export default function PielPage() {
  const [conditionFilter, setConditionFilter] = useState<SkinCondition>("General");

  const products = usePazMentalStore((s) => s.skincareProducts);
  const addSkincareProduct = usePazMentalStore((s) => s.addSkincareProduct);
  const removeSkincareProduct = usePazMentalStore((s) => s.removeSkincareProduct);
  const skincareLogs = usePazMentalStore((s) => s.skincareLogs);
  const addSkincareLog = usePazMentalStore((s) => s.addSkincareLog);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [effectiveness, setEffectiveness] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [usedToday, setUsedToday] = useState<Record<string, boolean>>({});
  const [skinToday, setSkinToday] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");

  const filteredProducts = products.filter((p) => p.condition === conditionFilter);
  const todayLog = skincareLogs.find((l) => l.date === todayISO());

  function submitProduct() {
    if (!name.trim()) return;
    addSkincareProduct({
      name: name.trim(),
      brand: brand.trim() || "Genérico",
      type: type.trim() || "General",
      condition: conditionFilter,
      isActive: true,
      effectiveness,
    });
    setName("");
    setBrand("");
    setType("");
    setEffectiveness(3);
    setModalOpen(false);
  }

  function submitDailyLog() {
    const productIds = Object.entries(usedToday)
      .filter(([, v]) => v)
      .map(([id]) => id);
    addSkincareLog({ productIds, skinCondition: skinToday, notes: notes.trim() || undefined });
    setNotes("");
  }

  const last30 = useMemo(() => {
    const now = new Date();
    return skincareLogs
      .filter((l) => differenceInCalendarDays(now, new Date(l.date)) < 30)
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((l) => ({ date: format(new Date(l.date), "dd/MM"), piel: l.skinCondition }));
  }, [skincareLogs]);

  const consistency = useMemo(() => {
    return products.map((p) => {
      const totalLogs = skincareLogs.length || 1;
      const used = skincareLogs.filter((l) => l.productIds.includes(p.id)).length;
      return { product: p, pct: Math.round((used / totalLogs) * 100) };
    });
  }, [products, skincareLogs]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Paz Mental</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--paz-mental)" }}>
            Control de Piel
          </h1>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CONDITIONS.map((c) => (
          <button
            key={c}
            onClick={() => setConditionFilter(c)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
            style={{
              background: conditionFilter === c ? "var(--paz-mental)" : "rgba(255,255,255,0.06)",
              color: conditionFilter === c ? "#04201c" : "rgba(255,255,255,0.7)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Mis productos</p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
            style={{ background: "var(--paz-mental)", color: "#04201c" }}
          >
            <Plus size={18} />
          </button>
        </div>
        {filteredProducts.length === 0 ? (
          <GlassCard className="text-center py-8">
            <p className="text-sm text-white/45">Sin productos en esta categoría.</p>
          </GlassCard>
        ) : (
          filteredProducts.map((p) => (
            <GlassCard key={p.id} padding="sm" className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-white/45">{p.brand} · {p.type}</p>
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      fill={i < p.effectiveness ? "var(--paz-mental)" : "none"}
                      color={i < p.effectiveness ? "var(--paz-mental)" : "rgba(255,255,255,0.25)"}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => removeSkincareProduct(p.id)}
                className="text-white/30 hover:text-red-400 transition-colors cursor-pointer p-1"
              >
                <Trash2 size={16} />
              </button>
            </GlassCard>
          ))
        )}
      </section>

      {products.length > 0 && (
        <GlassCard accentColor="var(--paz-mental)" glow className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-white/85">Registro diario</p>
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center justify-between text-sm cursor-pointer">
                <span className="text-white/70">{p.name}</span>
                <input
                  type="checkbox"
                  checked={!!usedToday[p.id]}
                  onChange={(e) => setUsedToday((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                  className="w-4 h-4 accent-[var(--paz-mental)]"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/50">Estado de piel hoy</p>
            <div className="flex justify-between">
              {SKIN_EMOJIS.map((emoji, i) => {
                const level = (i + 1) as 1 | 2 | 3 | 4 | 5;
                return (
                  <button
                    key={i}
                    onClick={() => setSkinToday(level)}
                    className="text-2xl rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
                    style={{
                      background: skinToday === level ? "var(--paz-mental)22" : "transparent",
                      border: `1px solid ${skinToday === level ? "var(--paz-mental)" : "transparent"}`,
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
          <GlassInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" />
          <GlassButton accentColor="var(--paz-mental)" onClick={submitDailyLog} className="w-full">
            Guardar registro de hoy
          </GlassButton>
          {todayLog && (
            <p className="text-xs text-white/40 text-center">Ya registraste tu piel hoy. Guardar de nuevo lo actualizará.</p>
          )}
        </GlassCard>
      )}

      <GlassCard accentColor="var(--paz-mental)" className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/80">Progreso</p>
        {last30.length === 0 ? (
          <p className="text-sm text-white/45 text-center py-8">Sin datos suficientes todavía.</p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last30}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis domain={[1, 5]} stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="piel" stroke="var(--paz-mental)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {consistency.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <p className="text-xs text-white/50">Consistencia por producto</p>
            {consistency.map(({ product, pct }) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{product.name}</span>
                <span className="text-white/40">{pct}%</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Agregar producto">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Nombre</label>
            <GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Marca</label>
            <GlassInput value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Tipo</label>
            <GlassInput value={type} onChange={(e) => setType(e.target.value)} placeholder="Sérum, crema, limpiador..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Efectividad</label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setEffectiveness((i + 1) as 1 | 2 | 3 | 4 | 5)}
                  className="cursor-pointer"
                >
                  <Star
                    size={22}
                    fill={i < effectiveness ? "var(--paz-mental)" : "none"}
                    color={i < effectiveness ? "var(--paz-mental)" : "rgba(255,255,255,0.25)"}
                  />
                </button>
              ))}
            </div>
          </div>
          <GlassButton accentColor="var(--paz-mental)" onClick={submitProduct} className="w-full">
            Guardar producto
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
