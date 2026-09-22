import type { ModuleDef } from "./types";

export const MODULES: ModuleDef[] = [
  { id: "home", label: "Home", href: "/", color: "--foreground", icon: "Home" },
  { id: "gym", label: "Gym", href: "/gym", color: "--gym", icon: "Dumbbell" },
  { id: "habitos", label: "Hábitos", href: "/habitos", color: "--habitos", icon: "CalendarCheck2" },
  { id: "rutinas", label: "Rutinas", href: "/rutinas", color: "--rutinas", icon: "ListChecks" },
  { id: "calendario", label: "Calendario", href: "/calendario", color: "--calendario", icon: "CalendarDays" },
  { id: "outfit", label: "Outfit", href: "/outfit", color: "--outfit", icon: "Shirt" },
  { id: "paz-mental", label: "Paz Mental", href: "/paz-mental", color: "--paz-mental", icon: "Leaf" },
  { id: "finanzas", label: "Finanzas", href: "/finanzas", color: "--finanzas", icon: "Wallet" },
  { id: "voz", label: "Voz", href: "/voz", color: "--voz", icon: "Mic" },
];

// Modules shown in the bottom nav (mobile). El layout es flex-1 (ver
// bottom-nav.tsx), no ancho fijo — agregar Rutinas/Calendario acá no
// rompe nada, cada ícono simplemente queda un poco más angosto. Se
// mantienen Gym/Outfit/Paz Mental/Finanzas: son módulos ya construidos y
// en uso, no "funcionalidad ficticia" — la instrucción de reducir el nav
// a solo 5 ítems no aplicaba acá (confirmado con el usuario).
export const BOTTOM_NAV_MODULES: ModuleDef[] = MODULES.filter((m) =>
  ["home", "gym", "habitos", "rutinas", "calendario", "outfit", "paz-mental", "finanzas"].includes(m.id)
);
