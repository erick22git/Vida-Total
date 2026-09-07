"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Trash2, Pencil, Wallet, Plus } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import {
  useFinanceStore,
  useCurrencySymbol,
  formatMoney,
  todayISO,
  CATEGORIES,
  getCategory,
} from "@/lib/store/financeStore";
import { financeIcon } from "@/lib/finance-utils";
import type { Transaction, TransactionType } from "@/lib/types/finance";

type FilterType = "todas" | "ingreso" | "gasto";

export default function TransaccionesPage() {
  const symbol = useCurrencySymbol();
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const [filterType, setFilterType] = useState<FilterType>("todas");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => filterType === "todas" || t.type === filterType)
      .filter((t) => !filterCategory || t.categoryId === filterCategory)
      .filter((t) => !search || (t.note ?? "").toLowerCase().includes(search.toLowerCase()))
      .filter((t) => !dateFrom || t.date >= dateFrom)
      .filter((t) => !dateTo || t.date <= dateTo)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [transactions, filterType, filterCategory, search, dateFrom, dateTo]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const categoriesForFilter =
    filterType === "todas" ? CATEGORIES : CATEGORIES.filter((c) => c.type === filterType);

  function dayTotal(items: Transaction[]) {
    return items.reduce((sum, t) => sum + (t.type === "ingreso" ? t.amount : -t.amount), 0);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/finanzas" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-col gap-1">
          <p className="text-white/50 text-sm md:text-base">Finanzas</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Transacciones</h1>
        </div>
      </header>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["todas", "ingreso", "gasto"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilterType(f);
                setFilterCategory(null);
              }}
              className="flex-1 rounded-2xl py-2 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: filterType === f ? "var(--finanzas)22" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filterType === f ? "var(--finanzas)" : "rgba(255,255,255,0.08)"}`,
                color: filterType === f ? "var(--finanzas)" : "rgba(255,255,255,0.6)",
              }}
            >
              {f === "todas" ? "Todas" : f === "ingreso" ? "Ingresos" : "Gastos"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCategory(null)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: !filterCategory ? "var(--finanzas)22" : "rgba(255,255,255,0.04)",
              border: `1px solid ${!filterCategory ? "var(--finanzas)" : "rgba(255,255,255,0.08)"}`,
              color: !filterCategory ? "var(--finanzas)" : "rgba(255,255,255,0.6)",
            }}
          >
            Todas las categorías
          </button>
          {categoriesForFilter.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: filterCategory === c.id ? `${c.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${filterCategory === c.id ? c.color : "rgba(255,255,255,0.08)"}`,
                color: filterCategory === c.id ? c.color : "rgba(255,255,255,0.6)",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <GlassInput
          icon={<Search size={16} />}
          placeholder="Buscar en notas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <GlassInput
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Desde"
          />
          <GlassInput
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Hasta"
          />
        </div>
      </GlassCard>

      {grouped.length === 0 ? (
        <GlassCard accentColor="var(--finanzas)" className="flex flex-col items-center gap-2 py-10">
          <Wallet size={28} className="text-white/25" />
          <p className="text-sm text-white/45">No hay transacciones con estos filtros.</p>
        </GlassCard>
      ) : (
        grouped.map(([date, items]) => (
          <GlassCard key={date} accentColor="var(--finanzas)" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white/85">
                {new Date(date + "T00:00:00").toLocaleDateString("es-PE", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <span
                className="text-sm font-semibold"
                style={{ color: dayTotal(items) >= 0 ? "#22c55e" : "#ef4444" }}
              >
                {dayTotal(items) >= 0 ? "+" : ""}
                {formatMoney(dayTotal(items), symbol)}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {items.map((t) => {
                const cat = getCategory(t.categoryId);
                const Icon = financeIcon(cat?.icon ?? "MoreHorizontal");
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2.5 group">
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
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 md:opacity-60 transition-opacity">
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))
      )}

      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        onClick={() => setCreating(true)}
        className="fixed bottom-24 md:bottom-8 right-6 md:right-10 z-40 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer"
        style={{
          background: "linear-gradient(135deg, var(--finanzas), #f59e0bcc)",
          boxShadow: "0 8px 28px #f59e0b66, inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        <Plus size={26} color="#fff" />
      </motion.button>

      <GlassModal open={creating} onClose={() => setCreating(false)} title="Nuevo movimiento">
        <TransactionForm
          onSave={(patch) => {
            addTransaction({
              type: patch.type ?? "gasto",
              amount: patch.amount ?? 0,
              categoryId: patch.categoryId ?? "",
              note: patch.note,
              date: patch.date ?? todayISO(),
            });
            setCreating(false);
          }}
        />
      </GlassModal>

      <GlassModal open={!!editing} onClose={() => setEditing(null)} title="Editar transacción">
        {editing && (
          <TransactionForm
            transaction={editing}
            onSave={(patch) => {
              updateTransaction(editing.id, patch);
              setEditing(null);
            }}
          />
        )}
      </GlassModal>
    </div>
  );
}

function TransactionForm({
  transaction,
  onSave,
}: {
  transaction?: Transaction;
  onSave: (patch: Partial<Transaction>) => void;
}) {
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ?? CATEGORIES.find((c) => c.type === (transaction?.type ?? "gasto"))?.id ?? "",
  );
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "gasto");

  const categoriesForType = CATEGORIES.filter((c) => c.type === type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["gasto", "ingreso"] as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setType(t);
              setCategoryId(CATEGORIES.find((c) => c.type === t)?.id ?? categoryId);
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
      <GlassInput type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
      <GlassInput type="text" placeholder="Nota" value={note} onChange={(e) => setNote(e.target.value)} />
      <GlassInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <GlassButton
        accentColor="var(--finanzas)"
        className="w-full"
        onClick={() => {
          const value = parseFloat(amount);
          if (!value || value <= 0 || !categoryId) return;
          onSave({ amount: value, note: note.trim() || undefined, date, categoryId, type });
        }}
      >
        {transaction ? "Guardar cambios" : "Registrar movimiento"}
      </GlassButton>
    </div>
  );
}
