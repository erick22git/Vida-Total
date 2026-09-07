export type TransactionType = "ingreso" | "gasto";

export interface Category {
  id: string;
  name: string;
  icon: string; // lucide icon name
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string; // ISO date (yyyy-MM-dd)
  currency: CurrencyCode;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  month: string; // YYYY-MM
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO date
  icon: string;
  color: string;
}

export type CurrencyCode = "PEN" | "USD" | "EUR";

export interface CurrencyDef {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "PEN", symbol: "S/", label: "Sol peruano" },
  { code: "USD", symbol: "$", label: "Dólar estadounidense" },
  { code: "EUR", symbol: "€", label: "Euro" },
];
