import type { LucideIcon } from "lucide-react";
import { normalizeText } from "./icons";

/**
 * Biblioteca completa de iconos (Lucide, ya instalada: ~1800). Se carga bajo demanda, solo cuando se abre el
 * selector o cuando una tarea usa un icono de la biblioteca ampliada. Clave guardada en la tarea: "lucide:Nombre".
 */
export const LUCIDE_PREFIX = "lucide:";
type IconMap = Record<string, LucideIcon>;

let cache: IconMap | null = null;
let pending: Promise<IconMap> | null = null;

export function loadAllIcons(): Promise<IconMap> {
  if (!pending) {
    pending = import("lucide-react").then((m) => {
      cache = m.icons as unknown as IconMap;
      return cache;
    });
  }
  return pending;
}
export const getLoadedIcons = (): IconMap | null => cache;

export const isLucideKey = (k: string | undefined): k is string => !!k && k.startsWith(LUCIDE_PREFIX);
export const lucideKey = (name: string) => `${LUCIDE_PREFIX}${name}`;
export const lucideName = (k: string) => k.slice(LUCIDE_PREFIX.length);

/** Palabras en español (y variantes) → iconos de Lucide que las representan. */
const TERMS: Record<string, string[]> = {
  comida: ["Utensils", "UtensilsCrossed", "Pizza", "Sandwich", "Soup", "Salad", "Apple", "Beef", "Egg", "Drumstick", "Cookie", "IceCreamCone", "Croissant", "Hamburger", "Banana", "Carrot", "Fish", "ChefHat", "CookingPot"],
  comer: ["Utensils", "UtensilsCrossed", "Pizza", "Sandwich", "Soup", "Salad", "Apple"],
  cocinar: ["ChefHat", "CookingPot", "Soup", "Flame", "Utensils"],
  bebida: ["CupSoda", "Coffee", "Beer", "Wine", "GlassWater", "Milk", "Martini"],
  cafe: ["Coffee", "CupSoda"],
  agua: ["Droplets", "Droplet", "GlassWater", "Waves"],
  deporte: ["Dumbbell", "Trophy", "Bike", "Volleyball", "Goal", "Medal", "Swords", "Footprints", "Activity"],
  ejercicio: ["Dumbbell", "Activity", "Bike", "Footprints", "HeartPulse"],
  correr: ["Footprints", "Timer", "Activity"],
  natacion: ["Waves", "Fish"],
  futbol: ["Goal", "Trophy"],
  estudiar: ["BookOpen", "GraduationCap", "Library", "NotebookPen", "Pencil", "Backpack", "School"],
  leer: ["BookOpen", "Book", "BookMarked", "Library"],
  escribir: ["Pencil", "PenLine", "NotebookPen", "FileText"],
  trabajo: ["Briefcase", "Building2", "Laptop", "Monitor", "Handshake", "ClipboardList"],
  reunion: ["Users", "Handshake", "Video", "CalendarClock", "Presentation"],
  llamada: ["Phone", "PhoneCall", "Headset"],
  correo: ["Mail", "Send", "Inbox", "AtSign"],
  compras: ["ShoppingCart", "ShoppingBag", "Store", "Receipt", "Basket"],
  dinero: ["Wallet", "Banknote", "PiggyBank", "CreditCard", "Coins", "Landmark", "Receipt"],
  casa: ["House", "Home", "Sofa", "Bed", "Key", "Wrench", "Hammer"],
  limpiar: ["Brush", "SprayCan", "Sparkles", "Trash2", "WashingMachine", "Shirt"],
  ropa: ["Shirt", "WashingMachine", "Scissors"],
  dormir: ["Bed", "BedDouble", "Moon", "MoonStar", "Zzz"],
  salud: ["Heart", "HeartPulse", "Stethoscope", "Pill", "Syringe", "Cross", "Activity", "Thermometer"],
  medicina: ["Pill", "Syringe", "Stethoscope", "Cross"],
  mascota: ["PawPrint", "Dog", "Cat", "Bone", "Fish"],
  perro: ["Dog", "PawPrint", "Bone"],
  gato: ["Cat", "PawPrint"],
  viaje: ["Plane", "Luggage", "Map", "Compass", "Tent", "Ship", "TrainFront", "Globe"],
  auto: ["Car", "CarFront", "Fuel", "Wrench", "Bus", "Bike"],
  musica: ["Music", "Guitar", "Headphones", "Piano", "Mic", "Drum", "Radio"],
  peliculas: ["Film", "Clapperboard", "Popcorn", "Tv", "Video"],
  juegos: ["Gamepad2", "Dices", "Puzzle", "Joystick", "Swords"],
  foto: ["Camera", "Image", "Aperture"],
  arte: ["Palette", "Brush", "PenTool", "Paintbrush", "Shapes"],
  fiesta: ["PartyPopper", "Cake", "Gift", "Music", "Wine"],
  cumple: ["Cake", "PartyPopper", "Gift"],
  regalo: ["Gift", "PartyPopper"],
  tiempo: ["Clock", "Timer", "Hourglass", "AlarmClock", "CalendarClock"],
  tecnologia: ["Laptop", "Smartphone", "Cpu", "Code", "Wifi", "Monitor", "Server"],
  programar: ["Code", "Terminal", "Laptop", "Bug", "GitBranch"],
  naturaleza: ["Trees", "Leaf", "Flower", "Sun", "Mountain", "Sprout", "TreePine"],
  jardin: ["Sprout", "Flower", "Leaf", "Shovel", "Trees"],
  clima: ["Sun", "Cloud", "CloudRain", "Snowflake", "Wind", "Umbrella"],
  meditar: ["Brain", "Flower2", "Wind", "Sparkles", "Heart"],
  familia: ["Users", "Baby", "Heart", "House"],
  bebe: ["Baby", "Milk"],
  cita: ["CalendarClock", "CalendarCheck", "Stethoscope", "Scissors"],
  belleza: ["Scissors", "Sparkles", "Brush", "Glasses"],
  idea: ["Lightbulb", "Sparkles", "Brain"],
  meta: ["Target", "Flag", "Trophy", "Medal"],
  importante: ["Star", "Flag", "AlertTriangle", "Bookmark", "Bell"],
  ducha: ["ShowerHead", "Droplets", "Bath"],
  bano: ["Bath", "ShowerHead", "Toilet"],
};

export const ALL_TERMS = TERMS;

/** Busca en toda la biblioteca: por palabras en español y por el nombre (en inglés) del icono. */
export function searchAllIcons(query: string, names: string[], limit = 180): string[] {
  const q = normalizeText(query);
  if (!q) return [];
  const found = new Set<string>();
  for (const [term, list] of Object.entries(TERMS)) {
    if (term.includes(q) || q.includes(term)) list.forEach((n) => found.add(n));
  }
  const set = new Set(names);
  const first = [...found].filter((n) => set.has(n));
  const byName = names.filter((n) => !found.has(n) && n.toLowerCase().includes(q.replace(/\s+/g, "")));
  return [...first, ...byName].slice(0, limit);
}
