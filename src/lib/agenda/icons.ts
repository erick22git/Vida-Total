import {
  Apple, Bed, BookOpen, Bike, Briefcase, Brain, Bus, Cake, Camera, Car, Code, Coffee, Droplets, Dumbbell, Film,
  Footprints, Gamepad2, GraduationCap, Heart, House, Music, Phone, Pill, Pencil, Plane, ShoppingCart, ShowerHead,
  Shirt, Star, Sun, Users, Utensils, Wallet, Monitor, Moon, Salad, PawPrint, Wrench, type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de iconos de la Agenda. El icono se elige solo según lo que escribes ("clases" → libro, "gym" → mancuerna).
 * Sumar un icono = una entrada; las palabras clave van sin tildes y en minúsculas.
 */
export interface AgendaIconDef {
  key: string;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
}

export const AGENDA_ICONS: AgendaIconDef[] = [
  { key: "coffee", label: "Café", Icon: Coffee, keywords: ["desayun", "cafe", "te ", "infusion"] },
  { key: "utensils", label: "Comida", Icon: Utensils, keywords: ["almorz", "comer", "comida", "cena", "cenar", "restaurante", "lunch"] },
  { key: "apple", label: "Fruta", Icon: Apple, keywords: ["snack", "fruta", "merienda", "manzana", "colacion"] },
  { key: "salad", label: "Ensalada", Icon: Salad, keywords: ["ensalada", "dieta", "saludable", "verdura"] },
  { key: "dumbbell", label: "Gym", Icon: Dumbbell, keywords: ["gym", "gimnasio", "entren", "ejercicio", "pesas", "rutina", "workout", "fuerza"] },
  { key: "book", label: "Libro", Icon: BookOpen, keywords: ["clase", "estudi", "leer", "lectura", "libro", "curso", "tarea", "examen"] },
  { key: "graduation", label: "Universidad", Icon: GraduationCap, keywords: ["universidad", "colegio", "escuela", "tesis", "graduacion", "facultad"] },
  { key: "shower", label: "Ducha", Icon: ShowerHead, keywords: ["banar", "ducha", "aseo", "higiene"] },
  { key: "bed", label: "Dormir", Icon: Bed, keywords: ["dormir", "sueno", "siesta", "descans", "acostar"] },
  { key: "moon", label: "Noche", Icon: Moon, keywords: ["noche", "madrugada"] },
  { key: "sun", label: "Mañana", Icon: Sun, keywords: ["despertar", "amanecer", "levantar", "manana temprano"] },
  { key: "briefcase", label: "Trabajo", Icon: Briefcase, keywords: ["trabaj", "reunion", "oficina", "cliente", "junta", "proyecto"] },
  { key: "monitor", label: "Computadora", Icon: Monitor, keywords: ["computadora", "pc", "compu", "estudio en linea", "zoom", "meet"] },
  { key: "code", label: "Programar", Icon: Code, keywords: ["program", "codigo", "desarroll", "codear"] },
  { key: "phone", label: "Llamada", Icon: Phone, keywords: ["llamar", "llamada", "telefono", "celular"] },
  { key: "users", label: "Personas", Icon: Users, keywords: ["amigos", "familia", "juntada", "reunirme", "visita", "fiesta"] },
  { key: "car", label: "Auto", Icon: Car, keywords: ["auto", "manejar", "conducir", "taxi", "uber", "mecanico"] },
  { key: "bus", label: "Bus", Icon: Bus, keywords: ["bus", "micro", "colectivo", "transporte", "metro"] },
  { key: "plane", label: "Viaje", Icon: Plane, keywords: ["viaje", "vuelo", "avion", "aeropuerto", "vacaciones"] },
  { key: "bike", label: "Bici", Icon: Bike, keywords: ["bici", "ciclismo", "pedalear"] },
  { key: "footprints", label: "Caminar", Icon: Footprints, keywords: ["camin", "correr", "trotar", "paseo", "running"] },
  { key: "brain", label: "Meditar", Icon: Brain, keywords: ["medit", "respirar", "mindful", "terapia", "yoga"] },
  { key: "heart", label: "Salud", Icon: Heart, keywords: ["salud", "medico", "doctor", "cita medica", "cardio"] },
  { key: "pill", label: "Medicina", Icon: Pill, keywords: ["medicina", "pastilla", "vitamina", "suplemento", "tratamiento"] },
  { key: "droplets", label: "Agua", Icon: Droplets, keywords: ["agua", "hidrat", "beber"] },
  { key: "cart", label: "Compras", Icon: ShoppingCart, keywords: ["compra", "super", "mercado", "tienda", "pedido"] },
  { key: "wallet", label: "Dinero", Icon: Wallet, keywords: ["pagar", "pago", "banco", "factura", "presupuesto", "finanzas"] },
  { key: "shirt", label: "Ropa", Icon: Shirt, keywords: ["ropa", "lavar", "planchar", "lavanderia", "vestir", "outfit"] },
  { key: "home", label: "Casa", Icon: House, keywords: ["casa", "limpiar", "ordenar", "cocinar", "hogar", "aseo casa"] },
  { key: "wrench", label: "Arreglos", Icon: Wrench, keywords: ["arregl", "reparar", "tecnico", "mantenimiento"] },
  { key: "music", label: "Música", Icon: Music, keywords: ["music", "guitarra", "piano", "cantar", "ensayo", "concierto"] },
  { key: "film", label: "Película", Icon: Film, keywords: ["pelicula", "cine", "serie", "netflix", "video"] },
  { key: "game", label: "Juegos", Icon: Gamepad2, keywords: ["jugar", "juego", "videojuego", "gaming"] },
  { key: "camera", label: "Foto", Icon: Camera, keywords: ["foto", "camara", "grabar", "filmar"] },
  { key: "pencil", label: "Escribir", Icon: Pencil, keywords: ["escrib", "diario", "dibujar", "apuntes", "redactar"] },
  { key: "cake", label: "Celebración", Icon: Cake, keywords: ["cumple", "pastel", "celebr", "aniversario"] },
  { key: "pet", label: "Mascota", Icon: PawPrint, keywords: ["perro", "gato", "mascota", "veterinario", "pasear al"] },
  { key: "star", label: "General", Icon: Star, keywords: [] },
];

const BY_KEY = new Map(AGENDA_ICONS.map((i) => [i.key, i]));
export const DEFAULT_ICON = "star";

export const getAgendaIcon = (key: string | undefined): AgendaIconDef => BY_KEY.get(key ?? "") ?? BY_KEY.get(DEFAULT_ICON)!;

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Iconos que coinciden con lo escrito, del mejor al peor (para "Sugerencias"). */
export function matchIcons(text: string): AgendaIconDef[] {
  const q = ` ${normalizeText(text)} `;
  if (q.trim() === "") return [];
  const scored = AGENDA_ICONS.map((icon) => {
    let score = 0;
    for (const k of icon.keywords) if (q.includes(k.startsWith(" ") || k.endsWith(" ") ? k : k)) score += k.length;
    if (normalizeText(icon.label) && q.includes(normalizeText(icon.label))) score += 3;
    return { icon, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.icon);
}

/** Icono automático para un título ("clases" → libro). Sin coincidencia = icono general. */
export function iconForTitle(text: string): string {
  return matchIcons(text)[0]?.key ?? DEFAULT_ICON;
}

/** Búsqueda manual por nombre o palabra clave. */
export function searchIcons(query: string): AgendaIconDef[] {
  const q = normalizeText(query);
  if (!q) return AGENDA_ICONS;
  return AGENDA_ICONS.filter((i) => normalizeText(i.label).includes(q) || i.keywords.some((k) => k.includes(q) || q.includes(k.trim())));
}

/** Colores de fábrica; los propios del usuario (presets) se guardan aparte en el store. */
export const AGENDA_COLORS = ["#F5C037", "#79B247", "#6C9FD8", "#0E8A5F", "#DA4650", "#0B63D6", "#FFFFFF"] as const;
export const DEFAULT_COLOR = "#FFFFFF";
