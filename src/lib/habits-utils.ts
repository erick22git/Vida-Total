import {
  Activity,
  BedDouble,
  Book,
  BookOpen,
  Briefcase,
  Brush,
  CheckCircle2,
  Coffee,
  Dumbbell,
  FileText,
  Flame,
  GraduationCap,
  Heart,
  Home,
  ListChecks,
  Music,
  Phone,
  Pencil,
  Droplets,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Target,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { TaskPriority } from "@/lib/types/habits";

export const HABIT_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  BedDouble,
  Book,
  BookOpen,
  Briefcase,
  Brush,
  CheckCircle2,
  Coffee,
  Dumbbell,
  FileText,
  Flame,
  GraduationCap,
  Heart,
  Home,
  ListChecks,
  Music,
  Phone,
  Pencil,
  Droplets,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Target,
  Utensils,
};

export const ICON_PICKER_OPTIONS = Object.keys(HABIT_ICON_MAP);

export const BLOCK_COLOR_OPTIONS = [
  "var(--habitos)",
  "#f59e0b",
  "#ef4444",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  alta: "#ef4444",
  media: "#f59e0b",
  baja: "#22c55e",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function getHabitIcon(name: string): LucideIcon {
  return HABIT_ICON_MAP[name] ?? Star;
}

export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 23;

export function timelineHours(): number[] {
  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) hours.push(h);
  return hours;
}

export function formatHour(hour: number): string {
  const h = hour % 24;
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}
