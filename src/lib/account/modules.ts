import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";

export type ModuleAccessMap = Record<ModuleKey, boolean>;

/** Sin fila en `user_module_access` = habilitado (default documentado en la migración 0001). */
export function allModulesEnabled(): ModuleAccessMap {
  return MODULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {} as ModuleAccessMap);
}

export function buildModuleAccess(rows: { module: string; enabled: boolean }[] | null | undefined): ModuleAccessMap {
  const map = allModulesEnabled();
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
