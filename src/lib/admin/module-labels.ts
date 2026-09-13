import type { ModuleKey } from "@/lib/types/profile";

/**
 * Etiqueta humana + color de acento (mismos tokens CSS de
 * src/app/globals.css) para cada `ModuleKey`. `gym_calorias` y
 * `gym_entrenamiento` son dos módulos de acceso independientes en el
 * schema (ver MODULE_KEYS en src/lib/types/profile.ts) pero visualmente
 * se muestran como sub-partes de "Gym" en el detalle de usuario.
 */
export const MODULE_LABELS: Record<ModuleKey, { label: string; group: string; color: string }> = {
  gym_calorias: { label: "Calorías", group: "Gym", color: "var(--gym)" },
  gym_entrenamiento: { label: "Entrenamiento", group: "Gym", color: "var(--gym)" },
  habitos: { label: "Hábitos", group: "Hábitos", color: "var(--habitos)" },
  outfit: { label: "Outfit", group: "Outfit", color: "var(--outfit)" },
  paz_mental: { label: "Paz Mental", group: "Paz Mental", color: "var(--paz-mental)" },
  finanzas: { label: "Finanzas", group: "Finanzas", color: "var(--finanzas)" },
  voz: { label: "Voz", group: "Voz", color: "var(--voz)" },
};
