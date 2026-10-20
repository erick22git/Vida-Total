import type { ModuleKey } from "@/lib/types/profile";
import { MODULE_CATALOG } from "@/lib/account/module-catalog";

/**
 * Etiqueta humana + color de acento de cada `ModuleKey`, derivadas del catálogo único
 * (`lib/account/module-catalog.ts`). Cada módulo es independiente: `group` es el propio nombre del módulo
 * (no hay una agrupación "Gym" con un solo interruptor).
 */
export const MODULE_LABELS = Object.fromEntries(
  (Object.entries(MODULE_CATALOG) as [ModuleKey, (typeof MODULE_CATALOG)[ModuleKey]][]).map(([key, m]) => [
    key,
    { label: m.label, group: m.label, color: m.color },
  ]),
) as Record<ModuleKey, { label: string; group: string; color: string }>;
