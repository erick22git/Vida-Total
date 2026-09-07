import {
  Cloud,
  CloudRain,
  Footprints,
  Gem,
  Shirt,
  Snowflake,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type {
  ClothingCategory,
  ClothingSeason,
  OutfitOccasion,
  WeatherCondition,
} from "@/lib/types/outfit";

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  camisas: "Camisas",
  pantalones: "Pantalones",
  zapatos: "Zapatos",
  abrigos: "Abrigos",
  accesorios: "Accesorios",
  ropa_interior: "Ropa interior",
};

export const CATEGORY_ICONS: Record<ClothingCategory, LucideIcon> = {
  camisas: Shirt,
  pantalones: Shirt,
  zapatos: Footprints,
  abrigos: Shirt,
  accesorios: Gem,
  ropa_interior: Shirt,
};

export const CATEGORY_ORDER: ClothingCategory[] = [
  "abrigos",
  "camisas",
  "pantalones",
  "zapatos",
  "accesorios",
  "ropa_interior",
];

export const SEASON_LABELS: Record<ClothingSeason, string> = {
  verano: "Verano",
  invierno: "Invierno",
  todo: "Todo el año",
};

export const OCCASION_LABELS: Record<OutfitOccasion, string> = {
  casual: "Casual",
  formal: "Formal",
  deporte: "Deporte",
  fiesta: "Fiesta",
};

export const OCCASIONS: OutfitOccasion[] = ["casual", "formal", "deporte", "fiesta"];

export const WEATHER_CONDITION_LABELS: Record<WeatherCondition, string> = {
  soleado: "Soleado",
  nublado: "Nublado",
  lluvioso: "Lluvioso",
  nevado: "Nevado",
  ventoso: "Ventoso",
};

export const WEATHER_ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
};

export function getWeatherIcon(name: string): LucideIcon {
  return WEATHER_ICON_MAP[name] ?? Sun;
}

// Paleta curada de swatches predefinidos para elegir el color de una prenda.
export const COLOR_SWATCHES = [
  "#000000",
  "#ffffff",
  "#6b7280",
  "#8b5e3c",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];
