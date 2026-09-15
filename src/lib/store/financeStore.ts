import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";
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
import { getCurrentUserId } from "./user-scope";
import {
  syncInsertTransaction,
  syncUpdateTransaction,
  syncDeleteTransaction,
  syncUpsertBudget,
  syncDeleteBudget,
  syncInsertGoal,
  syncUpdateGoal,
  syncDeleteGoal,
  hydrateFinanceStoreFromSupabase,
  type FinanceHydratedState,
} from "@/lib/sync/finance-sync";

export const CATEGORIES = rawCategories as Category[];

/**
 * Id único usado tanto como key local como primary key de la fila remota en
 * Supabase (columnas `uuid` — ver supabase/migrations/0002_module_data_sync.sql).
 * Antes generaba un string base36 corto que no era un UUID válido; se
 * cambió a `crypto.randomUUID()` por el mismo motivo que gymStore.ts (ver
 * `uid()` ahí) — el mismo id sirve como key local y remota, sin mapeo.
 */
function uid() {
  return crypto.randomUUID();
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

  // ---------- Remote sync (Supabase) — interno, no UI pública ----------
  /** Reemplaza slices del estado con lo traído de Supabase al loguearse.
   * Ver `hydrateFinanceStoreFromSupabase` (src/lib/sync/finance-sync.ts) y
   * su único llamador en `UserScopeScript`. Mismo patrón que
   * `_hydrateFromRemote` en gymStore.ts. */
  _hydrateFromRemote: (patch: Partial<FinanceState>) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      // Config
      currency: "PEN",
      setCurrency: (currency) => set({ currency }),

      // Transacciones
      transactions: [],
      addTransaction: (tx) => {
        const created: Transaction = {
          ...tx,
          id: uid(),
          currency: tx.currency ?? get().currency,
        };
        set((state) => ({
          transactions: [created, ...state.transactions],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertTransaction(created, uidUser);
      },
      updateTransaction: (id, patch) => {
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateTransaction(id, patch, uidUser);
      },
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteTransaction(id, uidUser);
      },

      // Presupuestos
      budgets: [],
      addBudget: (budget) => {
        const created: Budget = { ...budget, id: uid() };
        set((state) => ({
          budgets: [...state.budgets, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpsertBudget(created, uidUser);
      },
      updateBudget: (id, patch) => {
        let updated: Budget | null = null;
        set((state) => ({
          budgets: state.budgets.map((b) => {
            if (b.id !== id) return b;
            updated = { ...b, ...patch };
            return updated;
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && updated) syncUpsertBudget(updated, uidUser);
      },
      deleteBudget: (id) => {
        set((state) => ({
          budgets: state.budgets.filter((b) => b.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteBudget(id, uidUser);
      },

      // Metas de ahorro
      goals: [],
      addGoal: (goal) => {
        const created: SavingsGoal = { ...goal, id: uid(), currentAmount: goal.currentAmount ?? 0 };
        set((state) => ({
          goals: [...state.goals, created],
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncInsertGoal(created, uidUser);
      },
      updateGoal: (id, patch) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncUpdateGoal(id, patch, uidUser);
      },
      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser) syncDeleteGoal(id, uidUser);
      },
      addToGoal: (id, amount) => {
        let nextCurrentAmount: number | null = null;
        set((state) => ({
          goals: state.goals.map((g) => {
            if (g.id !== id) return g;
            nextCurrentAmount = Math.max(0, g.currentAmount + amount);
            return { ...g, currentAmount: nextCurrentAmount };
          }),
        }));
        const uidUser = getCurrentUserId();
        if (uidUser && nextCurrentAmount !== null) {
          syncUpdateGoal(id, { currentAmount: nextCurrentAmount }, uidUser);
        }
      },

      // Remote sync (Supabase)
      _hydrateFromRemote: (patch) => set(patch),
    }),
    {
      name: "vida-total-finance-store",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-finance-store")),
    },
  ),
);

// ============================================================================
// Remote sync (Supabase) — hidratación (login / segundo dispositivo)
// ============================================================================
//
// Mismo mecanismo que `hydrateGymStore` en gymStore.ts: se trae lo que haya
// en Supabase para el usuario y se MEZCLA (nunca reemplaza) con lo que ya
// hay en el store, para no perder historial local en el primer login de un
// usuario que ya venía usando la app antes de que existiera esta capa de
// sync (Supabase arranca sin filas para él). Lo que era solo local se sube
// (backfill) para que también quede en la nube.

/**
 * Mezcla un array remoto con uno local por `id`: conserva TODAS las filas
 * remotas y agrega las locales que el remoto todavía no conoce. Idéntica a
 * `mergeById` en gymStore.ts (no se comparte el helper entre stores porque
 * ninguno de los dos exporta el suyo; ver gymStore.ts para la explicación
 * completa de por qué NUNCA se reemplaza el array local por el remoto).
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  return { merged: [...remote, ...localOnly], localOnly };
}

/** Clave natural de un presupuesto: coincide con el `unique(user_id,
 * category_id, budget_month)` de la tabla `budgets` — un presupuesto es
 * el mismo si tiene la misma categoría y mes, sin importar qué `id` haya
 * generado cada dispositivo. */
function budgetKey(b: Budget): string {
  return `${b.categoryId}__${b.month}`;
}

/**
 * Igual que `mergeById`, pero para `budgets`: se mezcla por (categoryId,
 * month) en vez de por `id`, porque dos presupuestos creados para la misma
 * categoría+mes en dispositivos distintos representan el MISMO presupuesto
 * (la tabla remota los colapsaría igual vía su `unique`) — mezclar por `id`
 * los duplicaría en la UI (que asume un presupuesto por categoría+mes, ver
 * `presupuestos/page.tsx`). Ante conflicto, el remoto gana (mismo criterio
 * que `mergeById`: el remoto siempre se conserva tal cual).
 */
function mergeBudgets(remote: Budget[], local: Budget[]): { merged: Budget[]; localOnly: Budget[] } {
  const remoteKeys = new Set(remote.map(budgetKey));
  const localOnly = local.filter((l) => !remoteKeys.has(budgetKey(l)));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * Trae las 3 tablas de Finanzas de Supabase para `userId`, las MEZCLA
 * (nunca reemplaza) con lo que ya hay en el store, y sube (backfill)
 * cualquier dato que solo existiera localmente. Pensado para llamarse UNA
 * vez por sesión de login, apenas se conoce el userId (ver
 * `UserScopeScript`). Tolerante a fallos: si Supabase no responde, cada
 * tabla cae de vuelta a `[]` y el merge deja todo el estado local intacto.
 */
export async function hydrateFinanceStore(userId: string): Promise<void> {
  const remote: FinanceHydratedState = await hydrateFinanceStoreFromSupabase(userId);
  const local = useFinanceStore.getState();

  const transactions = mergeById(remote.transactions, local.transactions);
  const budgets = mergeBudgets(remote.budgets, local.budgets);
  const goals = mergeById(remote.goals, local.goals);

  const patch: Partial<FinanceState> = {
    transactions: transactions.merged,
    budgets: budgets.merged,
    goals: goals.merged,
  };
  useFinanceStore.getState()._hydrateFromRemote(patch);

  // Backfill: sube a Supabase lo que era solo local.
  for (const tx of transactions.localOnly) syncInsertTransaction(tx, userId);
  for (const budget of budgets.localOnly) syncUpsertBudget(budget, userId);
  for (const goal of goals.localOnly) syncInsertGoal(goal, userId);
}

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
