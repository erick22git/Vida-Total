import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { format, subMonths } from "date-fns";
import {
  CURRENCIES,
  type Budget,
  type Category,
  type CurrencyCode,
  type SavingsGoal,
  type Transaction,
} from "@/lib/types/finance";
import rawCategories from "@/lib/data/finance-categories.json";

export const CATEGORIES = rawCategories as Category[];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

export function getCategory(categoryId: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === categoryId);
}

interface FinanceState {
  // ---------- Config ----------
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;

  // ---------- Transacciones ----------
  transactions: Transaction[];
  addTransaction: (
    tx: Omit<Transaction, "id" | "currency"> & { currency?: CurrencyCode },
  ) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // ---------- Presupuestos ----------
  budgets: Budget[];
  addBudget: (budget: Omit<Budget, "id">) => void;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // ---------- Metas de ahorro ----------
  goals: SavingsGoal[];
  addGoal: (goal: Omit<SavingsGoal, "id" | "currentAmount"> & { currentAmount?: number }) => void;
  updateGoal: (id: string, patch: Partial<SavingsGoal>) => void;
  deleteGoal: (id: string) => void;
  addToGoal: (id: string, amount: number) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      // Config
      currency: "PEN",
      setCurrency: (currency) => set({ currency }),

      // Transacciones
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [
            {
              ...tx,
              id: uid(),
              currency: tx.currency ?? state.currency,
            },
            ...state.transactions,
          ],
        })),
      updateTransaction: (id, patch) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      // Presupuestos
      budgets: [],
      addBudget: (budget) =>
        set((state) => ({
          budgets: [...state.budgets, { ...budget, id: uid() }],
        })),
      updateBudget: (id, patch) =>
        set((state) => ({
          budgets: state.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      deleteBudget: (id) =>
        set((state) => ({
          budgets: state.budgets.filter((b) => b.id !== id),
        })),

      // Metas de ahorro
      goals: [],
      addGoal: (goal) =>
        set((state) => ({
          goals: [
            ...state.goals,
            { ...goal, id: uid(), currentAmount: goal.currentAmount ?? 0 },
          ],
        })),
      updateGoal: (id, patch) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        })),
      addToGoal: (id, amount) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id
              ? { ...g, currentAmount: Math.max(0, g.currentAmount + amount) }
              : g,
          ),
        })),
    }),
    {
      name: "vida-total-finance-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------- Selectors / helpers ----------

export function useCurrencySymbol() {
  const currency = useFinanceStore((s) => s.currency);
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? "S/";
}

export function useMonthTransactions(month: string = currentMonth()) {
  const transactions = useFinanceStore((s) => s.transactions);
  return transactions.filter((t) => t.date.startsWith(month));
}

export function useMonthSummary(month: string = currentMonth()) {
  const txs = useMonthTransactions(month);
  const ingresos = txs
    .filter((t) => t.type === "ingreso")
    .reduce((sum, t) => sum + t.amount, 0);
  const gastos = txs
    .filter((t) => t.type === "gasto")
    .reduce((sum, t) => sum + t.amount, 0);
  return { ingresos, gastos, balance: ingresos - gastos };
}

export function formatMoney(amount: number, symbol: string) {
  return `${symbol} ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function useCategorySpending(month: string = currentMonth()) {
  const txs = useMonthTransactions(month).filter((t) => t.type === "gasto");
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  return Array.from(byCategory.entries())
    .map(([categoryId, amount]) => ({
      categoryId,
      category: getCategory(categoryId),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function previousMonth(month: string = currentMonth()) {
  const [y, m] = month.split("-").map(Number);
  return format(subMonths(new Date(y, m - 1, 1), 1), "yyyy-MM");
}

/** Balance del mes vs. balance del mes anterior, en % (positivo = mejora). */
export function useMonthTrend(month: string = currentMonth()) {
  const { balance } = useMonthSummary(month);
  const { balance: prevBalance } = useMonthSummary(previousMonth(month));
  let pct = 0;
  if (prevBalance !== 0) {
    pct = ((balance - prevBalance) / Math.abs(prevBalance)) * 100;
  } else if (balance !== 0) {
    pct = 100;
  }
  return { balance, prevBalance, pct };
}

export function useRecentTransactions(limit = 5) {
  const transactions = useFinanceStore((s) => s.transactions);
  return [...transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : -0) || b.id.localeCompare(a.id))
    .slice(0, limit);
}

export interface BudgetProgress {
  budget: Budget;
  category: Category | undefined;
  spent: number;
  pct: number;
}

export function useBudgetProgress(month: string = currentMonth()): BudgetProgress[] {
  const budgets = useFinanceStore((s) => s.budgets);
  const spending = useCategorySpending(month);
  const spentMap = new Map(spending.map((s) => [s.categoryId, s.amount]));
  return budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const spent = spentMap.get(b.categoryId) ?? 0;
      const pct = b.monthlyLimit > 0 ? Math.min(999, (spent / b.monthlyLimit) * 100) : 0;
      return { budget: b, category: getCategory(b.categoryId), spent, pct };
    });
}
