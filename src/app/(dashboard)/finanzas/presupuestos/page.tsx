"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, ListChecks } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  useFinanceStore,
  useBudgetProgress,
  useCurrencySymbol,
  formatMoney,
  currentMonth,
  CATEGORIES,
} from "@/lib/store/financeStore";
import { financeIcon, budgetColor } from "@/lib/finance-utils";

export default function PresupuestosPage() {
  const symbol = useCurrencySymbol();
  const month = currentMonth();
  const addBudget = useFinanceStore((s) => s.addBudget);
  const budgets = useFinanceStore((s) => s.budgets);
  const progress = useBudgetProgress(month);

  const [modalOpen, setModalOpen] = useState(false);
  const gastoCategories = CATEGORIES.filter((c) => c.type === "gasto");
  const availableCategories = gastoCategories.filter(
    (c) => !budgets.some((b) => b.categoryId === c.id && b.month === month),
  );
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id ?? "");
  const [limit, setLimit] = useState("");

  const totalBudgeted = progress.reduce((sum, p) => sum + p.budget.monthlyLimit, 0);
  const totalSpent = progress.reduce((sum, p) => sum + p.spent, 0);

  function handleSubmit() {
    const value = parseFloat(limit);
    if (!value || value <= 0 || !categoryId) return;
    addBudget({ categoryId, monthlyLimit: value, month });
    setLimit("");
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/finanzas" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-col gap-1">
          <p className="text-white/50 text-sm md:text-base">Finanzas</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Presupuestos</h1>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-2">
          <p className="text-sm text-white/60">Total presupuestado</p>
          <p className="text-2xl font-semibold">{formatMoney(totalBudgeted, symbol)}</p>
        </GlassCard>
        <GlassCard accentColor="var(--finanzas)" glow className="flex flex-col gap-2">
          <p className="text-sm text-white/60">Total gastado</p>
          <p className="text-2xl font-semibold" style={{ color: totalSpent > totalBudgeted ? "#ef4444" : "#fff" }}>
            {formatMoney(totalSpent, symbol)}
          </p>
        </GlassCard>
      </section>

      {progress.length === 0 ? (
        <GlassCard accentColor="var(--finanzas)" className="flex flex-col items-center gap-2 py-10">
          <ListChecks size={28} className="text-white/25" />
          <p className="text-sm text-white/45">Aún no tienes presupuestos este mes.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {progress.map(({ budget, category, spent, pct }) => {
            const Icon = financeIcon(category?.icon ?? "MoreHorizontal");
            const color = budgetColor(pct);
            return (
              <GlassCard key={budget.id} accentColor={category?.color} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ background: `${category?.color ?? "#6b7280"}22` }}
                  >
                    <Icon size={16} style={{ color: category?.color ?? "#6b7280" }} />
                  </div>
                  <div className="flex flex-col min-w-0 grow">
                    <span className="text-sm font-medium text-white/85 truncate">{category?.name ?? "Otros"}</span>
                    <span className="text-xs text-white/40">
                      {formatMoney(spent, symbol)} / {formatMoney(budget.monthlyLimit, symbol)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color }}>
                    {Math.round(pct)}%
                  </span>
                </div>
                <ProgressBar value={spent} max={budget.monthlyLimit} color={color} />
              </GlassCard>
            );
          })}
        </div>
      )}

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

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo presupuesto">
        <div className="flex flex-col gap-4">
          {availableCategories.length === 0 ? (
            <p className="text-sm text-white/45">
              Ya creaste presupuestos para todas las categorías de gasto este mes.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((c) => {
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
                type="number"
                inputMode="decimal"
                placeholder={`Límite mensual (${symbol})`}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              <GlassButton accentColor="var(--finanzas)" onClick={handleSubmit} className="w-full">
                Crear presupuesto
              </GlassButton>
            </>
          )}
        </div>
      </GlassModal>
    </div>
  );
}
