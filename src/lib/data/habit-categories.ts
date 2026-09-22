/**
 * Biblioteca propia de categorías de hábito — íconos de lucide-react
 * (`getHabitIcon` en `@/lib/habits-utils` ya sabe resolverlos), no emojis.
 * Mismo patrón que `MUSCLE_GROUPS` en `src/lib/data/gym-meta.ts`.
 */
import type { Category } from "@/lib/types/habits";

export const HABIT_CATEGORIES: Category[] = [
  { id: "gym", label: "Gym", icon: "Dumbbell", color: "#f97362" },
  { id: "agua", label: "Agua", icon: "Droplets", color: "#5b8def" },
  { id: "sueno", label: "Sueño", icon: "BedDouble", color: "#a970ff" },
  { id: "lectura", label: "Lectura", icon: "BookOpen", color: "#f6c744" },
  { id: "comida", label: "Comida", icon: "Utensils", color: "#4ade80" },
  { id: "meditacion", label: "Meditación", icon: "Sparkles", color: "#34d399" },
  { id: "trabajo", label: "Trabajo", icon: "Briefcase", color: "#fb923c" },
  { id: "estudio", label: "Estudio", icon: "GraduationCap", color: "#22d3ee" },
  { id: "movilidad", label: "Movilidad", icon: "Activity", color: "#84cc16" },
  { id: "higiene", label: "Higiene", icon: "Heart", color: "#ec4899" },
  { id: "finanzas", label: "Finanzas", icon: "Wallet", color: "#c084fc" },
];

export function getCategory(id: string | undefined): Category | undefined {
  return id ? HABIT_CATEGORIES.find((c) => c.id === id) : undefined;
}
