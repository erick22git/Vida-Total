export type ClothingCategory =
  | "camisas"
  | "pantalones"
  | "zapatos"
  | "abrigos"
  | "accesorios"
  | "ropa_interior";

export type ClothingSeason = "verano" | "invierno" | "todo";

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  season: ClothingSeason;
  imageUrl: string; // base64 / data URL, empty string when no photo
  timesWorn: number;
  lastWorn?: string; // ISO date string
  cost?: number;
  dateAdded: string; // ISO date string
}

export type OutfitOccasion = "casual" | "formal" | "deporte" | "fiesta";

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  occasion: OutfitOccasion;
  createdAt: string; // ISO date string
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string; // ISO date string (Monday of the week)
  dayOutfits: Record<number, string>; // day 1-7 (Mon-Sun) -> outfitId
}

export type WeatherCondition = "soleado" | "nublado" | "lluvioso" | "nevado" | "ventoso";

export interface WeatherDay {
  date: string; // ISO date string
  temp: number;
  condition: WeatherCondition;
  icon: string; // lucide-react icon name
}
