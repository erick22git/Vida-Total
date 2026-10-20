import { MODULE_KEYS, type ModuleKey } from "@/lib/types/profile";

/**
 * ÚNICA fuente de verdad de los módulos que el admin puede habilitar por usuario. Cada uno es
 * independiente: no hay un interruptor "Gym" que prenda varios a la vez ni jerarquía oculta entre ellos.
 * Para agregar un módulo nuevo: sumar su clave en `MODULE_KEYS` (types/profile.ts), una entrada acá, y la
 * migración que amplía el CHECK de `user_module_access.module` — el gate de rutas, "Mis módulos", los
 * toggles del admin y los textos de los pedidos de acceso salen de esta lista, sin tocar nada más.
 */
export interface ModuleCatalogEntry {
  /** Nombre real que se muestra en toda la app (toggles, pedidos de acceso, avisos). */
  label: string;
  /** Una línea para la pantalla "Mis módulos". */
  description: string;
  /** Pantalla de entrada del módulo. */
  href: string;
  /** Rutas que pertenecen a este módulo (prefijos): `ModuleAccessGate` las corta si no está habilitado. */
  pathPrefixes: string[];
  /** Nombre de ícono de lucide (se resuelve en la interfaz, así este archivo no importa React). */
  icon: "Flame" | "Droplets" | "Dumbbell" | "Sparkles" | "CalendarCheck2" | "Shirt" | "Leaf" | "Wallet" | "Mic";
  color: string;
  /** false = módulo en mantenimiento: SOLO lo ve el admin. Un usuario normal no lo ve en ningún lado (ni en la navegación, ni en "Mis módulos", ni como pedido de acceso). */
  userVisible: boolean;
}

export const MODULE_CATALOG: Record<ModuleKey, ModuleCatalogEntry> = {
  gym_calorias: {
    label: "Calorías",
    description: "Anotá lo que comés y seguí tu meta de calorías y macros.",
    href: "/gym/calorias",
    pathPrefixes: ["/gym/calorias", "/gym/nutriologo"],
    icon: "Flame",
    color: "var(--gym)",
    userVisible: true,
  },
  gym_agua: {
    label: "Agua",
    description: "Registrá cuánta agua tomás en el día.",
    href: "/gym/agua",
    pathPrefixes: ["/gym/agua"],
    icon: "Droplets",
    color: "var(--gym)",
    userVisible: true,
  },
  gym_entrenamiento: {
    label: "Entrenamiento",
    description: "Tu rutina, tus series y tu progreso.",
    href: "/gym/entrenamiento",
    pathPrefixes: ["/gym/entrenamiento"],
    icon: "Dumbbell",
    color: "var(--gym)",
    userVisible: true,
  },
  gym_kegel: {
    label: "Kegel",
    description: "Ejercicios de suelo pélvico con racha y niveles.",
    href: "/gym/kegel",
    pathPrefixes: ["/gym/kegel"],
    icon: "Sparkles",
    color: "var(--paz-mental)",
    userVisible: false,
  },
  habitos: {
    label: "Hábitos",
    description: "Tus hábitos de cada día.",
    href: "/habitos",
    pathPrefixes: ["/habitos"],
    icon: "CalendarCheck2",
    color: "var(--habitos)",
    userVisible: true,
  },
  outfit: {
    label: "Outfit",
    description: "Tu ropa y qué ponerte según el clima.",
    href: "/outfit",
    pathPrefixes: ["/outfit"],
    icon: "Shirt",
    color: "var(--outfit)",
    userVisible: false,
  },
  paz_mental: {
    label: "Paz Mental",
    description: "Ánimo, diario y meditación.",
    href: "/paz-mental",
    pathPrefixes: ["/paz-mental"],
    icon: "Leaf",
    color: "var(--paz-mental)",
    userVisible: false,
  },
  finanzas: {
    label: "Finanzas",
    description: "Gastos, ingresos y metas de ahorro.",
    href: "/finanzas",
    pathPrefixes: ["/finanzas"],
    icon: "Wallet",
    color: "var(--finanzas)",
    userVisible: false,
  },
  voz: {
    label: "Voz",
    description: "Lecciones y práctica de voz.",
    href: "/voz",
    pathPrefixes: ["/voz"],
    icon: "Mic",
    color: "var(--voz)",
    userVisible: false,
  },
};

/** Módulos que ve un usuario normal (hoy: Calorías, Agua, Entrenamiento y Hábitos). El resto está en mantenimiento y es solo del admin. */
export const USER_MODULE_KEYS: ModuleKey[] = MODULE_KEYS.filter((k) => MODULE_CATALOG[k].userVisible);

export function isUserVisible(key: ModuleKey): boolean {
  return MODULE_CATALOG[key].userVisible;
}

/** Dentro de Hábitos el usuario solo tiene los hábitos: agenda, línea de tiempo, tareas y workspace son solo del admin por ahora. */
const ADMIN_ONLY_PATHS = ["/habitos/agenda", "/habitos/timeline", "/habitos/tareas", "/habitos/workspace"];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Módulo al que pertenece una ruta; `null` = ruta libre (configuración, mis módulos, administración, etc.). */
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const key of MODULE_KEYS) {
    if (MODULE_CATALOG[key].pathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return key;
  }
  return null;
}

export function moduleLabel(key: string): string {
  return key in MODULE_CATALOG ? MODULE_CATALOG[key as ModuleKey].label : key;
}
