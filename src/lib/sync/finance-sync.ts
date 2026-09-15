/**
 * Capa de sincronización Supabase para el store de Finanzas (Transacciones,
 * Presupuestos, Metas de ahorro). Mismo patrón que
 * `src/lib/sync/gym-sync.ts` — ver ese archivo para el diseño general
 * (fire-and-forget, `console.warn` en vez de excepciones, filas `XRow`
 * escritas a mano porque no hay tipos `Database` generados).
 *
 * Nota sobre `finance_categories`: la tabla existe en la migración
 * (`supabase/migrations/0002_module_data_sync.sql`) para soportar categorías
 * creadas por el usuario, pero `financeStore.ts` HOY solo tiene un catálogo
 * fijo de categorías embebido en código (`CATEGORIES`, desde
 * `src/lib/data/finance-categories.json`) y no expone ninguna acción para
 * crear/editar/borrar categorías. Como no hay nada que sincronizar (no
 * existen categorías creadas por el usuario en el store), esta capa NO
 * sincroniza `finance_categories` — no hay filas locales que subir ni un
 * campo del store donde aplicar filas remotas. Si en el futuro se agrega
 * soporte de categorías personalizadas al store, esta tabla ya está lista
 * en la migración y solo faltaría instrumentarla acá siguiendo el mismo
 * patrón que el resto de este archivo.
 *
 * Nota sobre ids: igual que Gym, `uid()` en financeStore.ts generaba un
 * string corto no-UUID; se cambió a `crypto.randomUUID()` porque las
 * columnas `id` de estas tablas son `uuid`.
 *
 * Nota sobre `budgets`: la tabla tiene `unique(user_id, category_id,
 * budget_month)` — un presupuesto está identificado de verdad por
 * (categoría, mes), no por su `id` propio (la UI de Presupuestos ya evita
 * crear dos presupuestos para la misma categoría+mes, ver
 * `src/app/(dashboard)/finanzas/presupuestos/page.tsx`). Por eso
 * `syncUpsertBudget` hace upsert con `onConflict` en esa clave natural en
 * vez de en `id`, y la mezcla en `hydrateFinanceStore` (financeStore.ts)
 * también agrupa por (categoryId, month) en vez de por `id` — así un
 * presupuesto creado en dos dispositivos distintos para la misma
 * categoría+mes converge en una sola fila en vez de duplicarse.
 */

import { createClient } from "@/lib/supabase/client";
import type { Budget, CurrencyCode, SavingsGoal, Transaction, TransactionType } from "@/lib/types/finance";

// ============================================================================
// Helpers genéricos (igual que gym-sync.ts)
// ============================================================================

async function safeWrite(
  label: string,
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await fn();
    if (error) console.warn(`[finance-sync] ${label} falló:`, error.message);
  } catch (err) {
    console.warn(`[finance-sync] ${label} lanzó una excepción:`, err);
  }
}

async function safeFetchList<T>(
  label: string,
  fn: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[finance-sync] fetch ${label} falló:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[finance-sync] fetch ${label} lanzó una excepción:`, err);
    return [];
  }
}

// ============================================================================
// transactions
// ============================================================================

export interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category_id: string;
  note: string | null;
  entry_date: string;
  currency: CurrencyCode;
  created_at: string;
}

function transactionToRow(t: Transaction, userId: string): TransactionRow {
  return {
    id: t.id,
    user_id: userId,
    type: t.type,
    amount: t.amount,
    category_id: t.categoryId,
    note: t.note ?? null,
    entry_date: t.date,
    currency: t.currency,
    created_at: new Date().toISOString(),
  };
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    note: row.note ?? undefined,
    date: row.entry_date,
    currency: row.currency,
  };
}

async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const rows = await safeFetchList<TransactionRow>("transactions", () =>
    createClient().from("transactions").select("*").eq("user_id", userId),
  );
  return rows.map(rowToTransaction);
}

export function syncInsertTransaction(tx: Transaction, userId: string): void {
  void safeWrite("insert transactions", () =>
    createClient().from("transactions").insert(transactionToRow(tx, userId)),
  );
}

export function syncUpdateTransaction(id: string, patch: Partial<Transaction>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.date !== undefined) row.entry_date = patch.date;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update transactions", () =>
    createClient().from("transactions").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteTransaction(id: string, userId: string): void {
  void safeWrite("delete transactions", () =>
    createClient().from("transactions").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// budgets (identificado de verdad por (user_id, category_id, budget_month))
// ============================================================================

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  budget_month: string;
}

function budgetToRow(b: Budget, userId: string): BudgetRow {
  return {
    id: b.id,
    user_id: userId,
    category_id: b.categoryId,
    monthly_limit: b.monthlyLimit,
    budget_month: b.month,
  };
}

function rowToBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    monthlyLimit: row.monthly_limit,
    month: row.budget_month,
  };
}

async function fetchBudgets(userId: string): Promise<Budget[]> {
  const rows = await safeFetchList<BudgetRow>("budgets", () =>
    createClient().from("budgets").select("*").eq("user_id", userId),
  );
  return rows.map(rowToBudget);
}

/** Upsert por la clave natural (categoría, mes) — no por `id` — para que un
 * mismo presupuesto editado desde dos dispositivos converja en una fila en
 * vez de duplicarse (ver nota de diseño arriba). Cubre tanto `addBudget`
 * como `updateBudget` del store. */
export function syncUpsertBudget(budget: Budget, userId: string): void {
  void safeWrite("upsert budgets", () =>
    createClient()
      .from("budgets")
      .upsert(budgetToRow(budget, userId), { onConflict: "user_id,category_id,budget_month" }),
  );
}

export function syncDeleteBudget(id: string, userId: string): void {
  void safeWrite("delete budgets", () =>
    createClient().from("budgets").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// savings_goals
// ============================================================================

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string | null;
  color: string | null;
}

function goalToRow(g: SavingsGoal, userId: string): SavingsGoalRow {
  return {
    id: g.id,
    user_id: userId,
    name: g.name,
    target_amount: g.targetAmount,
    current_amount: g.currentAmount,
    deadline: g.deadline ?? null,
    icon: g.icon ?? null,
    color: g.color ?? null,
  };
}

function rowToGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline ?? undefined,
    icon: row.icon ?? "",
    color: row.color ?? "",
  };
}

async function fetchGoals(userId: string): Promise<SavingsGoal[]> {
  const rows = await safeFetchList<SavingsGoalRow>("savings_goals", () =>
    createClient().from("savings_goals").select("*").eq("user_id", userId),
  );
  return rows.map(rowToGoal);
}

export function syncInsertGoal(goal: SavingsGoal, userId: string): void {
  void safeWrite("insert savings_goals", () =>
    createClient().from("savings_goals").insert(goalToRow(goal, userId)),
  );
}

export function syncUpdateGoal(id: string, patch: Partial<SavingsGoal>, userId: string): void {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.targetAmount !== undefined) row.target_amount = patch.targetAmount;
  if (patch.currentAmount !== undefined) row.current_amount = patch.currentAmount;
  if (patch.deadline !== undefined) row.deadline = patch.deadline;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.color !== undefined) row.color = patch.color;
  if (Object.keys(row).length === 0) return;
  void safeWrite("update savings_goals", () =>
    createClient().from("savings_goals").update(row).eq("id", id).eq("user_id", userId),
  );
}

export function syncDeleteGoal(id: string, userId: string): void {
  void safeWrite("delete savings_goals", () =>
    createClient().from("savings_goals").delete().eq("id", id).eq("user_id", userId),
  );
}

// ============================================================================
// Hidratación completa desde Supabase (login / segundo dispositivo)
// ============================================================================

export interface FinanceHydratedState {
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
}

/**
 * Trae las 3 tablas de Finanzas para `userId` y devuelve un objeto listo
 * para mezclar (merge) en el estado del store. No escribe nada — el store
 * decide cómo aplicar el patch (ver `hydrateFinanceStore` en
 * financeStore.ts). Cada tabla se trae de forma independiente y tolerante a
 * fallos, igual que `hydrateGymStoreFromSupabase`.
 */
export async function hydrateFinanceStoreFromSupabase(userId: string): Promise<FinanceHydratedState> {
  const [transactions, budgets, goals] = await Promise.all([
    fetchTransactions(userId),
    fetchBudgets(userId),
    fetchGoals(userId),
  ]);
  return { transactions, budgets, goals };
}
