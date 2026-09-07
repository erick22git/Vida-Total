"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  ChevronRight,
  PiggyBank,
  BarChart3,
  ListChecks,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassBadge } from "@/components/glass/glass-badge";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import {
  useFinanceStore,
  useMonthSummary,
  useCategorySpending,
  useCurrencySymbol,
  useMonthTrend,
  useRecentTransactions,
  formatMoney,
  currentMonth,
  todayISO,
  CATEGORIES,
  getCategory,
} from "@/lib/store/financeStore";
import { financeIcon } from "@/lib/finance-utils";
import type { TransactionType } from "@/lib/types/finance";

export default function FinanzasHubPage() {
  const symbol = useCurrencySymbol();
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const month = currentMonth();
  const summary = useMonthSummary(month);
  const { pct: trendPct } = useMonthTrend(month);
  const categorySpending = useCategorySpending(month);
  const recent = useRecentTransactions(5);

  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("gasto");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES.find((c) => c.type === "gasto")?.id ?? "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());

  const categoriesForType = CATEGORIES.filter((c) => c.type === type);

  const pieData = categorySpending.slice(0, 6).map((c) => ({
    name: c.category?.name ?? "Otros",
    value: c.amount,
    color: c.category?.color ?? "#6b7280",
  }));

  function resetForm() {
    setType("gasto");
    setAmount("");
    setCategoryId(CATEGORIES.find((c) => c.type === "gasto")?.id ?? "");
    setNote("");
    setDate(todayISO());
  }

  function handleSubmit() {
    const value = parseFloat(amount);
    if (!value || value <= 0 || !categoryId) return;
    addTransaction({ type, amount: value, categoryId, note: note.trim() || undefined, date });
    resetForm();
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 relative pb-20">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Wallet style={{ color: "var(--finanzas)" }} /> Control de Plata
        </h1>
      </header>

      <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">Balance del mes</p>
          <GlassBadge color={trendPct >= 0 ? "#22c55e" : "#ef4444"}>
            {trendPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trendPct).toFixed(0)}% vs mes anterior
          </GlassBadge>
        </div>
        <p
          className="text-3xl md:text-4xl font-semibold"
          style={{ color: summary.balance >= 0 ? "#fff" : "#ef4444" }}
        >
          {formatMoney(summary.balance, symbol)}
        </p>
      </GlassCard>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard accentColor="#22c55e" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <TrendingUp size={16} style={{ color: "#22c55e" }} />
            Ingresos del mes
          </div>
          <p className="text-2xl font-semibold text-[#22c55e]">
            {formatMoney(summary.ingresos, symbol)}
          </p>
        </GlassCard>
        <GlassCard accentColor="#ef4444" glow className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <TrendingDown size={16} style={{ color: "#ef4444" }} />
            Gastos del mes
          </div>
          <p className="text-2xl font-semibold text-[#ef4444]">
            {formatMoney(summary.gastos, symbol)}
          </p>
        </GlassCard>
      </section>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/85">Gastos por categoría</p>
        {pieData.length > 0 ? (
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,25,0.9)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  formatter={(value) => formatMoney(Number(value), symbol)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-white/45 py-6 text-center">
            Aún no hay gastos registrados este mes.
          </p>
        )}
        {pieData.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pieData.map((c) => (
              <GlassBadge key={c.name} color={c.color}>
                {c.name} · {formatMoney(c.value, symbol)}
              </GlassBadge>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/85">Transacciones recientes</p>
          <Link href="/finanzas/transacciones" className="text-xs text-white/50 flex items-center gap-1">
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-white/45 py-4 text-center">Sin movimientos todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((t) => {
              const cat = getCategory(t.categoryId);
              const Icon = financeIcon(cat?.icon ?? "MoreHorizontal");
              return (
                <div key={t.id} className="flex items-center gap-3 py-1.5">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ background: `${cat?.color ?? "#6b7280"}22` }}
                  >
                    <Icon size={16} style={{ color: cat?.color ?? "#6b7280" }} />
                  </div>
                  <div className="flex flex-col min-w-0 grow">
                    <span className="text-sm text-white/85 truncate">{cat?.name ?? "Otros"}</span>
                    {t.note && <span className="text-xs text-white/40 truncate">{t.note}</span>}
                  </div>
                  <span
                    className="text-sm font-semibold shrink-0"
                    style={{ color: t.type === "ingreso" ? "#22c55e" : "#ef4444" }}
                  >
                    {t.type === "ingreso" ? "+" : "-"}
                    {formatMoney(t.amount, symbol)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/finanzas/presupuestos">
          <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl" style={{ background: "var(--finanzas)22" }}>
                <ListChecks size={20} style={{ color: "var(--finanzas)" }} />
              </div>
              <ChevronRight size={18} className="text-white/30" />
            </div>
            <p className="text-lg font-semibold">Presupuestos</p>
            <p className="text-sm text-white/55">Controla tus límites por categoría</p>
          </GlassCard>
        </Link>
        <Link href="/finanzas/metas">
          <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl" style={{ background: "var(--finanzas)22" }}>
                <PiggyBank size={20} style={{ color: "var(--finanzas)" }} />
              </div>
              <ChevronRight size={18} className="text-white/30" />
            </div>
            <p className="text-lg font-semibold">Metas</p>
            <p className="text-sm text-white/55">Ahorra para tus objetivos</p>
          </GlassCard>
        </Link>
        <Link href="/finanzas/reportes">
          <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl" style={{ background: "var(--finanzas)22" }}>
                <BarChart3 size={20} style={{ color: "var(--finanzas)" }} />
              </div>
              <ChevronRight size={18} className="text-white/30" />
            </div>
            <p className="text-lg font-semibold">Reportes</p>
            <p className="text-sm text-white/55">Tendencias y análisis</p>
          </GlassCard>
        </Link>
      </section>

      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        onClick={() => setModalOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-6 md:right-10 z-40 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer"
        style={{
          background: "linear-gradient(135deg, var(--finanzas), #f59e0bcc)",
          boxShadow: "0 8px 28px #f59e0b66, inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        <Plus size={26} color="#fff" />
      </motion.button>

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar movimiento">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["gasto", "ingreso"] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setCategoryId(CATEGORIES.find((c) => c.type === t)?.id ?? "");
                }}
                className="flex-1 rounded-2xl py-2.5 text-sm font-medium transition-colors cursor-pointer"
                style={{
                  background: type === t ? "var(--finanzas)22" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${type === t ? "var(--finanzas)" : "rgba(255,255,255,0.08)"}`,
                  color: type === t ? "var(--finanzas)" : "rgba(255,255,255,0.6)",
                }}
              >
                {t === "gasto" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          <GlassInput
            type="number"
            inputMode="decimal"
            placeholder={`Monto (${symbol})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            {categoriesForType.map((c) => {
              const Icon = financeIcon(c.icon);
              const selected = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background: selected ? `${c.color}22` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selected ? c.color : "rgba(255,255,255,0.08)"}`,
                    color: selected ? c.color : "rgba(255,255,255,0.6)",
                  }}
                >
                  <Icon size={14} />
                  {c.name}
                </button>
              );
            })}
          </div>

          <GlassInput
            type="text"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <GlassInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <GlassButton accentColor="var(--finanzas)" onClick={handleSubmit} className="w-full">
            Guardar movimiento
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
