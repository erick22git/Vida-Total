import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";
import { isUserVisible } from "@/lib/account/module-catalog";

export type ModuleAccessMap = Record<ModuleKey, boolean>;

/** Todos los módulos habilitados — lo que ve un admin (nunca depende de `user_module_access`: ver
 * `(dashboard)/layout.tsx`, que usa esto en vez de `buildModuleAccess` cuando `role === "admin"`). */
export function allModulesEnabled(): ModuleAccessMap {
  return MODULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {} as ModuleAccessMap);
}

/** Default para un usuario NUEVO (sin ninguna fila todavía en `user_module_access`): NADA habilitado —
 * ni siquiera Entrenamiento. El admin habilita módulo por módulo a mano desde `/admin/usuarios`. Antes
 * el default era "todo habilitado" (y, por un momento, "solo Entrenamiento"); corregido a pedido
 * explícito: "lo importante es que [el usuario nuevo] me aparezca, yo le habilito qué puede ver". */
export function defaultModuleAccess(): ModuleAccessMap {
  return MODULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {} as ModuleAccessMap);
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
      return access.gym_calorias || access.gym_agua || access.gym_entrenamiento || access.gym_kegel;
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

/** Para un usuario normal, "Home" se reemplaza por "Mis módulos": no hay Home genérico (mostraba datos de
 * módulos que quizá ni tiene habilitados). El admin conserva su Home. */
export function resolveNavModule<T extends { id: string; label: string; href: string }>(mod: T, isAdmin: boolean): T {
  if (mod.id === "home" && !isAdmin) return { ...mod, label: "Mis módulos", href: "/mis-modulos" };
  return mod;
}

/** Para un usuario normal, los módulos en mantenimiento quedan SIEMPRE apagados, aunque la base diga otra cosa (p. ej. cuentas
 * anteriores a la restricción, que tenían todo habilitado): no los ve ni los puede pedir. El admin nunca pasa por acá. */
export function restrictForUsers(map: ModuleAccessMap): ModuleAccessMap {
  const out = { ...map };
  for (const key of MODULE_KEYS) if (!isUserVisible(key)) out[key] = false;
  return out;
}
