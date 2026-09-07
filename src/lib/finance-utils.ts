import {
  Car,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Shirt,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Briefcase,
  Zap,
  PiggyBank,
  Plane,
  Smartphone,
  Gamepad2,
  Baby,
  Dog,
  Gem,
  Target,
  type LucideIcon,
} from "lucide-react";

export const FINANCE_ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  Film,
  HeartPulse,
  GraduationCap,
  Shirt,
  MoreHorizontal,
  Wallet,
  Laptop,
  TrendingUp,
  Gift,
  Briefcase,
  PiggyBank,
  Plane,
  Smartphone,
  Gamepad2,
  Baby,
  Dog,
  Gem,
  Target,
};

export const GOAL_ICON_OPTIONS = [
  "PiggyBank",
  "Plane",
  "Smartphone",
  "Gamepad2",
  "Home",
  "Car",
  "Gem",
  "Target",
  "Gift",
  "GraduationCap",
];

export const GOAL_COLOR_OPTIONS = [
  "var(--finanzas)",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
];

export function financeIcon(name: string): LucideIcon {
  return FINANCE_ICON_MAP[name] ?? MoreHorizontal;
}

/** Color de progreso de presupuesto: verde <70%, amarillo 70-90%, rojo >90%. */
export function budgetColor(pct: number) {
  if (pct > 90) return "#ef4444";
  if (pct >= 70) return "#eab308";
  return "#22c55e";
}
