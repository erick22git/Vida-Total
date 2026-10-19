import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";

export type ModuleAccessMap = Record<ModuleKey, boolean>;

/** Todos los módulos habilitados — lo que ve un admin (nunca depende de `user_module_access`: ver
 * `(dashboard)/layout.tsx`, que usa esto en vez de `buildModuleAccess` cuando `role === "admin"`). */
export function allModulesEnabled(): ModuleAccessMap {
  return MODULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {} as ModuleAccessMap);
}

/** Default para un usuario NUEVO (sin ninguna fila todavía en `user_module_access`): solo
 * Entrenamiento, hasta que el admin le habilite el resto a mano. Antes el default era "todo
 * habilitado", lo que dejaba a cualquier cuenta nueva viendo todos los módulos sin que el admin
 * hubiera hecho nada — corregido a pedido explícito. */
function defaultModuleAccess(): ModuleAccessMap {
  const map = MODULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {} as ModuleAccessMap);
  map.gym_entrenamiento = true;
  return map;
}

export function buildModuleAccess(rows: { module: string; enabled: boolean }[] | null | undefined): ModuleAccessMap {
  const map = defaultModuleAccess();
  for (const row of rows ?? []) {
    if ((MODULE_KEYS as readonly string[]).includes(row.module)) map[row.module as ModuleKey] = row.enabled;
  }
  return map;
}

/** Ids de `MODULES` (src/lib/constants.ts) que el usuario debe ver en la navegación. Home siempre se ve. */
export function isNavModuleVisible(navId: string, access: ModuleAccessMap): boolean {
  switch (navId) {
    case "gym":
      return access.gym_calorias || access.gym_entrenamiento;
    case "habitos":
      return access.habitos;
    case "outfit":
      return access.outfit;
    case "paz-mental":
      return access.paz_mental;
    case "finanzas":
      return access.finanzas;
    case "voz":
      return access.voz;
    default:
      return true;
  }
}
