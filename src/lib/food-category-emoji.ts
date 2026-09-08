const CATEGORY_EMOJI: Record<string, string> = {
  Fruta: "🍎",
  Frutas: "🍎",
  Verdura: "🥦",
  Verduras: "🥦",
  Proteína: "🍗",
  Proteínas: "🍗",
  Lácteo: "🥛",
  Lácteos: "🥛",
  "Lácteo vegetal": "🥛",
  Cereal: "🌾",
  Granos: "🌾",
  Snack: "🍿",
  Snacks: "🍿",
  Bebida: "🥤",
  Bebidas: "🥤",
  Grasa: "🥑",
  Legumbre: "🫘",
  Tubérculo: "🥔",
  "Fruto seco": "🥜",
  Semilla: "🌱",
  Suplemento: "💪",
  "Comida rápida": "🍔",
  "Plato preparado": "🍽️",
  Desayuno: "🍳",
  Postre: "🍰",
  Endulzante: "🍯",
  Otros: "🍴",
};

export function categoryEmoji(categoria: string): string {
  return CATEGORY_EMOJI[categoria] ?? "🍴";
}
