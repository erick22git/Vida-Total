"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Download, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import {
  useFinanceStore,
  useCurrencySymbol,
  formatMoney,
  getCategory,
  currentMonth,
} from "@/lib/store/financeStore";
import { financeIcon } from "@/lib/finance-utils";

type Period = "mes" | "trimestre" | "anio";

const PERIOD_MONTHS: Record<Period, number> = {
  mes: 1,
  trimestre: 3,
  anio: 12,
};

const PERIOD_LABEL: Record<Period, string> = {
  mes: "Mes",
  trimestre: "Trimestre",
  anio: "Año",
};

function monthsBack(n: number): string[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), "yyyy-MM"));
  }
  return months;
}

export default function ReportesPage() {
  const symbol = useCurrencySymbol();
  const transactions = useFinanceStore((s) => s.transactions);
  const [period, setPeriod] = useState<Period>("trimestre");

  const months = useMemo(() => monthsBack(PERIOD_MONTHS[period]), [period]);

  const monthlyData = useMemo(() => {
    return months.map((m) => {
      const txs = transactions.filter((t) => t.date.startsWith(m));
      const ingresos = txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
      const gastos = txs.filter((t) => t.type === "gasto").reduce((s, t) => s + t.amount, 0);
      return {
        month: m,
        label: format(new Date(m + "-01T00:00:00"), "MMM yy", { locale: es }),
        ingresos,
        gastos,
        balance: ingresos - gastos,
      };
    });
  }, [months, transactions]);

  const trendData = useMemo(() => {
    return monthlyData.reduce<{ label: string; acumulado: number }[]>((acc, d) => {
      const prevAcumulado = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
      acc.push({ label: d.label, acumulado: prevAcumulado + d.balance });
      return acc;
    }, []);
  }, [monthlyData]);

  const periodTransactions = useMemo(
    () => transactions.filter((t) => months.includes(t.date.slice(0, 7))),
    [transactions, months],
  );

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTransactions.filter((t) => t.type === "gasto")) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, category: getCategory(categoryId), amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [periodTransactions]);

  function exportCSV() {
    const header = ["Fecha", "Tipo", "Categoria", "Monto", "Nota"];
    const rows = periodTransactions
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((t) => [
        t.date,
        t.type,
        getCategory(t.categoryId)?.name ?? "Otros",
        t.amount.toFixed(2),
        (t.note ?? "").replace(/"/g, '""'),
      ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-${period}-${currentMonth()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/finanzas" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex flex-col gap-1">
          <p className="text-white/50 text-sm md:text-base">Finanzas</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Reportes</h1>
        </div>
      </header>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["mes", "trimestre", "anio"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 rounded-2xl py-2 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: period === p ? "var(--finanzas)22" : "rgba(255,255,255,0.04)",
                border: `1px solid ${period === p ? "var(--finanzas)" : "rgba(255,255,255,0.08)"}`,
                color: period === p ? "var(--finanzas)" : "rgba(255,255,255,0.6)",
              }}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <GlassButton accentColor="var(--finanzas)" variant="outline" onClick={exportCSV} className="w-full">
          <Download size={16} /> Exportar CSV
        </GlassButton>
      </GlassCard>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/85">Ingresos vs gastos por mes</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "rgba(20,20,25,0.9)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  color: "#fff",
                }}
                formatter={(value) => formatMoney(Number(value), symbol)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-white/85">Tendencia de balance acumulado</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "rgba(20,20,25,0.9)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  color: "#fff",
                }}
                formatter={(value) => formatMoney(Number(value), symbol)}
              />
              <Line
                type="monotone"
                dataKey="acumulado"
                name="Balance acumulado"
                stroke="var(--finanzas)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard accentColor="var(--finanzas)" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/85">Top 5 categorías de gasto</p>
        {topCategories.length === 0 ? (
          <p className="text-sm text-white/45 py-4 text-center flex items-center justify-center gap-2">
            <BarChart3 size={16} className="text-white/25" /> Sin gastos en este período.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {topCategories.map((c) => {
              const Icon = financeIcon(c.category?.icon ?? "MoreHorizontal");
              return (
                <div key={c.categoryId} className="flex items-center gap-3 py-1.5">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ background: `${c.category?.color ?? "#6b7280"}22` }}
                  >
                    <Icon size={16} style={{ color: c.category?.color ?? "#6b7280" }} />
                  </div>
                  <span className="text-sm text-white/85 grow">{c.category?.name ?? "Otros"}</span>
                  <span className="text-sm font-semibold text-white/85">{formatMoney(c.amount, symbol)}</span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
