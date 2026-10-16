export interface DrinkOption {
  id: string;
  nombre: string;
  emoji: string;
  /** Color de acento para esta bebida (hex). Se usa en su selector, resaltados, etc. */
  color: string;
  /** % de equilibrio hídrico: cuánto de ese volumen cuenta como hidratación real. */
  hidratacion: number;
  /** mg de cafeína por porción típica — solo si aplica. */
  cafeinaMg?: number;
  /** g de azúcar por cada 100 ml — solo si aplica. */
  azucarG?: number;
}

export interface DrinkCategory {
  nombre: string;
  bebidas: DrinkOption[];
}

/** Cambios editables por el usuario sobre una bebida del catálogo — todos
 * opcionales, se combinan (merge) sobre los valores base al leer. */
export interface DrinkOverride {
  nombre?: string;
  emoji?: string;
  color?: string;
  hidratacion?: number;
  cafeinaMg?: number;
  azucarG?: number;
}

/** Aplica los cambios guardados por el usuario (si hay) sobre una bebida base. */
export function applyDrinkOverride(base: DrinkOption, override?: DrinkOverride): DrinkOption {
  if (!override) return base;
  return { ...base, ...override };
}

/** Accesos rápidos mostrados arriba del todo, antes de las categorías. */
export const POPULAR_DRINKS: DrinkOption[] = [
  { id: "agua", nombre: "Agua", emoji: "💧", color: "#13356d", hidratacion: 100 },
  { id: "cafe", nombre: "Café", emoji: "☕", color: "#39281b", hidratacion: 80, cafeinaMg: 73 },
  { id: "te", nombre: "Té", emoji: "🍵", color: "#50310e", hidratacion: 85, cafeinaMg: 26 },
  { id: "refresco", nombre: "Refresco", emoji: "🥤", color: "#431471", hidratacion: 60, azucarG: 10.6 },
  { id: "jugo", nombre: "Jugo", emoji: "🧃", color: "#613211", hidratacion: 55, azucarG: 9 },
  { id: "leche", nombre: "Leche", emoji: "🥛", color: "#3a352c", hidratacion: 78 },
];

export const DRINK_CATEGORIES: DrinkCategory[] = [
  {
    nombre: "Café",
    bebidas: [
      { id: "latte", nombre: "Latte", emoji: "☕", color: "#453423", hidratacion: 80, cafeinaMg: 40 },
      { id: "capuchino", nombre: "Capuchino", emoji: "☕", color: "#453423", hidratacion: 78, cafeinaMg: 45 },
      { id: "cafe-con-hielo", nombre: "Café con hielo", emoji: "🧊", color: "#39281b", hidratacion: 80, cafeinaMg: 50, azucarG: 5 },
      { id: "espresso", nombre: "Espresso", emoji: "☕", color: "#332115", hidratacion: 70, cafeinaMg: 210 },
      { id: "cafe-con-leche", nombre: "Café con leche", emoji: "☕", color: "#453423", hidratacion: 80, cafeinaMg: 35 },
      { id: "cold-brew", nombre: "Cold brew", emoji: "🧊", color: "#332115", hidratacion: 85, cafeinaMg: 55 },
      { id: "frappe", nombre: "Frappé", emoji: "🥤", color: "#453423", hidratacion: 65, cafeinaMg: 75, azucarG: 14 },
      { id: "americano", nombre: "Americano", emoji: "☕", color: "#332115", hidratacion: 90, cafeinaMg: 150 },
      { id: "moca", nombre: "Moca", emoji: "☕", color: "#332014", hidratacion: 55, cafeinaMg: 95, azucarG: 12 },
      { id: "cafe-descafeinado", nombre: "Café descafeinado", emoji: "☕", color: "#453423", hidratacion: 90, cafeinaMg: 3 },
    ],
  },
  {
    nombre: "Té y cacao",
    bebidas: [
      { id: "te-helado", nombre: "Té helado", emoji: "🧊", color: "#50310e", hidratacion: 78, cafeinaMg: 12, azucarG: 6 },
      { id: "te-verde", nombre: "Té verde", emoji: "🍵", color: "#293f0b", hidratacion: 90, cafeinaMg: 18 },
      { id: "matcha", nombre: "Matcha", emoji: "🍵", color: "#293f0b", hidratacion: 85, cafeinaMg: 35 },
      { id: "infusion", nombre: "Infusión", emoji: "🍵", color: "#50310e", hidratacion: 95 },
      { id: "chocolate-caliente", nombre: "Chocolate caliente", emoji: "🍫", color: "#332114", hidratacion: 40, cafeinaMg: 22, azucarG: 9 },
      { id: "cacao", nombre: "Cacao", emoji: "🍫", color: "#332114", hidratacion: 65, cafeinaMg: 3 },
      { id: "bubble-tea", nombre: "Bubble tea", emoji: "🧋", color: "#421471", hidratacion: 55, cafeinaMg: 18, azucarG: 12 },
      { id: "mate", nombre: "Mate", emoji: "🧉", color: "#293f0b", hidratacion: 45, cafeinaMg: 3 },
    ],
  },
  {
    nombre: "Jugos",
    bebidas: [
      { id: "smoothie", nombre: "Smoothie", emoji: "🥤", color: "#6e1340", hidratacion: 60, azucarG: 18 },
      { id: "jugo-verduras", nombre: "Jugo de verduras", emoji: "🥬", color: "#293f0b", hidratacion: 85, azucarG: 4 },
      { id: "jugo-cana", nombre: "Jugo de caña", emoji: "🧃", color: "#36510e", hidratacion: 50, azucarG: 20 },
    ],
  },
  {
    nombre: "Refrescos",
    bebidas: [
      { id: "cola", nombre: "Cola", emoji: "🥤", color: "#3d1d0b", hidratacion: 60, cafeinaMg: 10, azucarG: 10.6 },
      { id: "cola-light", nombre: "Cola light", emoji: "🥤", color: "#3d1d0b", hidratacion: 80, cafeinaMg: 11 },
      { id: "limonada", nombre: "Limonada", emoji: "🍋", color: "#615111", hidratacion: 70, azucarG: 9 },
      { id: "tonica", nombre: "Tónica", emoji: "🥤", color: "#466512", hidratacion: 60, azucarG: 8 },
      { id: "ginger-ale", nombre: "Ginger ale", emoji: "🥤", color: "#664f12", hidratacion: 60, azucarG: 9 },
    ],
  },
  {
    nombre: "Deporte y bienestar",
    bebidas: [
      { id: "bebida-energetica", nombre: "Bebida energética", emoji: "⚡", color: "#5b3f10", hidratacion: 40, cafeinaMg: 34, azucarG: 11 },
      { id: "bebida-deportiva", nombre: "Bebida deportiva", emoji: "🏃", color: "#13356d", hidratacion: 85, azucarG: 6 },
      { id: "batido-proteinas", nombre: "Batido de proteínas", emoji: "💪", color: "#431471", hidratacion: 30 },
      { id: "kombucha", nombre: "Kombucha", emoji: "🍾", color: "#4a360d", hidratacion: 70, cafeinaMg: 5, azucarG: 3 },
      { id: "bebida-electrolitos", nombre: "Bebida con electrolitos", emoji: "⚡", color: "#115761", hidratacion: 95 },
      { id: "bebida-vitaminada", nombre: "Bebida vitaminada", emoji: "💊", color: "#711444", hidratacion: 75, azucarG: 7 },
      { id: "bebida-verde", nombre: "Bebida verde", emoji: "🥬", color: "#293f0b", hidratacion: 65, azucarG: 5 },
      { id: "agua-vinagre-manzana", nombre: "Agua con vinagre de manzana", emoji: "🍏", color: "#36510e", hidratacion: 90 },
    ],
  },
  {
    nombre: "Agua",
    bebidas: [
      { id: "agua-mineral", nombre: "Agua mineral", emoji: "💧", color: "#13356d", hidratacion: 100 },
      { id: "agua-con-gas", nombre: "Agua con gas", emoji: "🫧", color: "#13516d", hidratacion: 100 },
      { id: "agua-con-limon", nombre: "Agua con limón", emoji: "🍋", color: "#615111", hidratacion: 100 },
      { id: "agua-coco", nombre: "Agua de coco", emoji: "🥥", color: "#466512", hidratacion: 95, azucarG: 6 },
    ],
  },
  {
    nombre: "Leche y alternativas",
    bebidas: [
      { id: "yogur", nombre: "Yogur", emoji: "🥛", color: "#3a352c", hidratacion: 85, azucarG: 5 },
      { id: "batido", nombre: "Batido", emoji: "🥤", color: "#711444", hidratacion: 55, azucarG: 16 },
      { id: "leche-soja", nombre: "Leche de soja", emoji: "🥛", color: "#3a352c", hidratacion: 90 },
      { id: "leche-almendras", nombre: "Leche de almendras", emoji: "🥛", color: "#3a352c", hidratacion: 95 },
      { id: "leche-chocolate", nombre: "Leche con chocolate", emoji: "🍫", color: "#332114", hidratacion: 75, azucarG: 10 },
      { id: "leche-avena", nombre: "Leche de avena", emoji: "🥛", color: "#3a352c", hidratacion: 90 },
      { id: "leche-arroz", nombre: "Leche de arroz", emoji: "🥛", color: "#3a352c", hidratacion: 92 },
    ],
  },
  {
    nombre: "Alcohol",
    bebidas: [
      { id: "cerveza", nombre: "Cerveza", emoji: "🍺", color: "#50310e", hidratacion: 35 },
      { id: "vino", nombre: "Vino", emoji: "🍷", color: "#381010", hidratacion: 25 },
      { id: "alcohol-fuerte", nombre: "Alcohol fuerte", emoji: "🥃", color: "#3d1e0b", hidratacion: 10 },
      { id: "coctel-sin-alcohol", nombre: "Cóctel sin alcohol", emoji: "🍹", color: "#711444", hidratacion: 70, azucarG: 12 },
      { id: "coctel", nombre: "Cóctel", emoji: "🍸", color: "#6e1340", hidratacion: 20, azucarG: 10 },
      { id: "vino-espumoso", nombre: "Vino espumoso", emoji: "🥂", color: "#615111", hidratacion: 25 },
      { id: "sidra", nombre: "Sidra", emoji: "🍏", color: "#36510e", hidratacion: 30, azucarG: 8 },
      { id: "cerveza-sin-alcohol", nombre: "Cerveza sin alcohol", emoji: "🍺", color: "#50310e", hidratacion: 85 },
    ],
  },
  {
    nombre: "Otros",
    bebidas: [
      { id: "caldo", nombre: "Caldo", emoji: "🍲", color: "#5b3f10", hidratacion: 95 },
      { id: "sopa-miso", nombre: "Sopa de miso", emoji: "🍜", color: "#3d1d0b", hidratacion: 90 },
      { id: "otras", nombre: "Otras", emoji: "❓", color: "#38383a", hidratacion: 70 },
    ],
  },
];

/** Todas las bebidas (populares + categorías) en una sola lista plana. */
export const ALL_DRINKS: DrinkOption[] = [
  ...POPULAR_DRINKS,
  ...DRINK_CATEGORIES.flatMap((c) => c.bebidas),
];

/** Íconos entre los que se puede elegir al editar una bebida — genéricos por
 * ahora (formas de recipiente); más adelante se reemplazan por fotos reales. */
export const DRINK_ICON_OPTIONS = ["💧", "☕", "🍵", "🥤", "🧃", "🥛", "🍺", "🍷", "🧊", "🍾"];

/** Colores entre los que se puede elegir al editar una bebida. */
export const DRINK_COLOR_OPTIONS = [
  "#13356d",
  "#39281b",
  "#50310e",
  "#431471",
  "#613211",
  "#6e1340",
  "#293f0b",
  "#36510e",
  "#615111",
  "#115761",
  "#711444",
  "#381010",
  "#3d1d0b",
  "#3a352c",
  "#38383a",
];
