import type { ModuleDef } from "./types";

export const MODULES: ModuleDef[] = [
  { id: "home", label: "Home", href: "/", color: "--foreground", icon: "Home" },
  { id: "gym", label: "Gym", href: "/gym", color: "--gym", icon: "Dumbbell" },
  { id: "habitos", label: "Hábitos", href: "/habitos", color: "--habitos", icon: "CalendarCheck2" },
  { id: "outfit", label: "Outfit", href: "/outfit", color: "--outfit", icon: "Shirt" },
  { id: "paz-mental", label: "Paz Mental", href: "/paz-mental", color: "--paz-mental", icon: "Leaf" },
  { id: "finanzas", label: "Finanzas", href: "/finanzas", color: "--finanzas", icon: "Wallet" },
  { id: "voz", label: "Voz", href: "/voz", color: "--voz", icon: "Mic" },
];

// Modules shown in the bottom nav (mobile) — 6 max fit comfortably.
export const BOTTOM_NAV_MODULES: ModuleDef[] = MODULES.filter((m) =>
  ["home", "gym", "habitos", "outfit", "paz-mental", "finanzas"].includes(m.id)
);
