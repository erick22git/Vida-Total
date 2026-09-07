"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, PiggyBank, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useFinanceStore, useCurrencySymbol, formatMoney } from "@/lib/store/financeStore";
import { financeIcon, GOAL_ICON_OPTIONS, GOAL_COLOR_OPTIONS } from "@/lib/finance-utils";

export default function MetasPage() {
  const symbol = useCurrencySymbol();
  const goals = useFinanceStore((s) => s.goals);
  const addGoal = useFinanceStore((s) => s.addGoal);
  const deleteGoal = useFinanceStore((s) => s.deleteGoal);
  const addToGoal = useFinanceStore((s) => s.addToGoal);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState(GOAL_ICON_OPTIONS[0]);
  const [color, setColor] = useState(GOAL_COLOR_OPTIONS[0]);

  const [addFor, setAddFor] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");

  function resetForm() {
    setName("");
    setTarget("");
    setDeadline("");
    setIcon(GOAL_ICON_OPTIONS[0]);
    setColor(GOAL_COLOR_OPTIONS[0]);
  }

  function handleSubmit() {
    const value = parseFloat(target);
    if (!name.trim() || !value || value <= 0) return;
    addGoal({
      name: name.trim(),
      targetAmount: value,
      deadline: deadline || undefined,
      icon,
      color,
    });
    resetForm();
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
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Metas de ahorro</h1>
        </div>
      </header>

      {goals.length === 0 ? (
        <GlassCard accentColor="var(--finanzas)" className="flex flex-col items-center gap-2 py-10">
          <PiggyBank size={28} className="text-white/25" />
          <p className="text-sm text-white/45">Aún no tienes metas de ahorro.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const Icon = financeIcon(g.icon);
            const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
            return (
              <GlassCard key={g.id} accentColor={g.color} glow className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-2xl shrink-0"
                    style={{ background: `${g.color}22` }}
                  >
                    <Icon size={20} style={{ color: g.color }} />
                  </div>
                  <div className="flex flex-col min-w-0 grow">
                    <span className="text-base font-semibold truncate">{g.name}</span>
                    {g.deadline && (
                      <span className="text-xs text-white/40">
                        Meta: {new Date(g.deadline + "T00:00:00").toLocaleDateString("es-PE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <ProgressBar
                  value={g.currentAmount}
                  max={g.targetAmount}
                  color={g.color}
                  label={formatMoney(g.currentAmount, symbol)}
                  sublabel={`de ${formatMoney(g.targetAmount, symbol)} (${Math.round(pct)}%)`}
                />

                <GlassButton
                  accentColor={g.color}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAddFor(g.id);
                    setAddAmount("");
                  }}
                >
                  Agregar ahorro
                </GlassButton>
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

      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva meta">
        <div className="flex flex-col gap-4">
          <GlassInput placeholder="Nombre de la meta" value={name} onChange={(e) => setName(e.target.value)} />
          <GlassInput
            type="number"
            inputMode="decimal"
            placeholder={`Monto objetivo (${symbol})`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <GlassInput
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="Fecha límite (opcional)"
          />
          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/50">Ícono</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_ICON_OPTIONS.map((opt) => {
                const OptIcon = financeIcon(opt);
                const selected = icon === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setIcon(opt)}
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors cursor-pointer"
                    style={{
                      background: selected ? `${color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
                      color: selected ? color : "rgba(255,255,255,0.6)",
                    }}
                  >
                    <OptIcon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/50">Color</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setColor(opt)}
                  className="w-8 h-8 rounded-full cursor-pointer transition-transform"
                  style={{
                    background: opt,
                    transform: color === opt ? "scale(1.15)" : "scale(1)",
                    border: color === opt ? "2px solid white" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
          </div>
          <GlassButton accentColor="var(--finanzas)" onClick={handleSubmit} className="w-full">
            Crear meta
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={!!addFor} onClose={() => setAddFor(null)} title="Agregar ahorro">
        <div className="flex flex-col gap-4">
          <GlassInput
            type="number"
            inputMode="decimal"
            placeholder={`Monto a agregar (${symbol})`}
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
          />
          <GlassButton
            accentColor="var(--finanzas)"
            className="w-full"
            onClick={() => {
              const value = parseFloat(addAmount);
              if (!addFor || !value || value <= 0) return;
              addToGoal(addFor, value);
              setAddFor(null);
            }}
          >
            Agregar
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
