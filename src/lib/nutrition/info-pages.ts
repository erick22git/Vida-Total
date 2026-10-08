/**
 * Páginas del bloque de nutrientes de la pantalla de alimento (/gym/calorias/editar/[id] y /alimento/[id]).
 * El bloque tiene ALTURA FIJA: cuántas filas caben por página se calcula de esa altura (`rowsThatFit`), y los grupos que
 * no caben se parten en más páginas. Los puntos de la pantalla salen de `pages.length`. Un nutriente sin dato sale
 * como «sin dato» (value `undefined`), nunca como 0 ni se omite. Módulo puro.
 */
import type { ScaledNutrition } from "@/lib/food-utils";

export interface InfoRow {
  key: string;
  label: string;
  /** `undefined` = sin dato. */
  value: number | undefined;
  unit: string;
  /** Fila destacada (las kcal). */
  big?: boolean;
  /** Clave en `DAILY_VALUES` para mostrar «/ valor de referencia», si la hay. */
  dvKey?: string;
}

export interface InfoPage {
  id: string;
  title: string;
  rows: InfoRow[];
}

/** Cuántas filas de `rowH` px con separación `gap` entran en `areaH` px (mínimo 1). */
export function rowsThatFit(areaH: number, rowH: number, gap: number): number {
  return Math.max(1, Math.floor((areaH + gap) / (rowH + gap)));
}

type Micro = Record<string, number> | undefined;

interface GroupDef {
  id: string;
  title: string;
  rows: (n: ScaledNutrition, m: Micro) => InfoRow[];
}

const nut = (key: string, label: string, unit: string, v: number | undefined, dvKey?: string): InfoRow => ({ key, label, value: v, unit, dvKey });
const mic = (m: Micro, key: string, label: string, unit: string): InfoRow => ({ key, label, value: m?.[key], unit });

const GROUPS: GroupDef[] = [
  {
    id: "macros",
    title: "Calorías y macros",
    rows: (n) => [
      { key: "calorias", label: "Kcal", value: Math.round(n.calorias), unit: "", big: true },
      { key: "proteina", label: "Proteínas", value: Math.round(n.proteina), unit: " g" },
      { key: "carbos", label: "Carbohidratos", value: Math.round(n.carbos), unit: " g" },
      { key: "grasas", label: "Grasas", value: Math.round(n.grasas), unit: " g" },
    ],
  },
  {
    id: "grasas",
    title: "Grasas detalladas",
    rows: (n) => [
      nut("grasasSaturadas", "Grasas saturadas", "g", n.grasasSaturadas, "grasasSaturadas"),
      nut("grasasTrans", "Grasas trans", "g", n.grasasTrans),
      nut("grasasMonoinsaturadas", "Grasas monoinsaturadas", "g", n.grasasMonoinsaturadas),
      nut("grasasPoliinsaturadas", "Grasas poliinsaturadas", "g", n.grasasPoliinsaturadas),
      nut("colesterol", "Colesterol", "mg", n.colesterol, "colesterol"),
    ],
  },
  {
    id: "carbos",
    title: "Carbohidratos, fibra y sodio",
    rows: (n) => [
      nut("fibra", "Fibra", "g", n.fibra, "fibra"),
      nut("azucares", "Azúcares", "g", n.azucares, "azucares"),
      nut("azucaresAnadidos", "Azúcares añadidos", "g", n.azucaresAnadidos, "azucaresAnadidos"),
      nut("sodio", "Sodio", "mg", n.sodio, "sodio"),
    ],
  },
  {
    id: "vit-liposolubles",
    title: "Vitaminas liposolubles",
    rows: (_n, m) => [mic(m, "vitaminaA", "Vitamina A", "mcg"), mic(m, "vitaminaD", "Vitamina D", "mcg"), mic(m, "vitaminaE", "Vitamina E", "mg"), mic(m, "vitaminaK", "Vitamina K", "mcg")],
  },
  {
    id: "vit-b-c",
    title: "Vitaminas B y C",
    rows: (_n, m) => [
      mic(m, "vitaminaB1", "Vitamina B1", "mg"),
      mic(m, "vitaminaB2", "Vitamina B2", "mg"),
      mic(m, "vitaminaB3", "Vitamina B3", "mg"),
      mic(m, "vitaminaB5", "Vitamina B5", "mg"),
      mic(m, "vitaminaB6", "Vitamina B6", "mg"),
      mic(m, "vitaminaB12", "Vitamina B12", "mcg"),
      mic(m, "folato", "Folato", "mcg"),
      mic(m, "vitaminaC", "Vitamina C", "mg"),
    ],
  },
  {
    id: "minerales",
    title: "Minerales",
    rows: (_n, m) => [
      mic(m, "calcio", "Calcio", "mg"),
      mic(m, "hierro", "Hierro", "mg"),
      mic(m, "magnesio", "Magnesio", "mg"),
      mic(m, "fosforo", "Fósforo", "mg"),
      mic(m, "potasio", "Potasio", "mg"),
      mic(m, "zinc", "Zinc", "mg"),
      mic(m, "selenio", "Selenio", "mcg"),
      mic(m, "cobre", "Cobre", "mg"),
      mic(m, "manganeso", "Manganeso", "mg"),
    ],
  },
  {
    id: "otros",
    title: "Otros",
    rows: (n, m) => [
      nut("agua", "Agua", "g", n.agua),
      mic(m, "colina", "Colina", "mg"),
      nut("omega3Ala", "Omega-3 (ALA)", "g", n.omega3Ala),
      nut("omega6Linoleico", "Omega-6 (linoleico)", "g", n.omega6Linoleico),
      nut("ceniza", "Ceniza", "g", n.ceniza),
    ],
  },
];

/** Todas las páginas del bloque para este alimento; cada grupo se parte en trozos de `rowsPerPage` filas. */
export function buildInfoPages(n: ScaledNutrition, micro: Micro, rowsPerPage: number): InfoPage[] {
  const per = Math.max(1, Math.floor(rowsPerPage));
  const pages: InfoPage[] = [];
  for (const g of GROUPS) {
    const rows = g.rows(n, micro);
    const parts = Math.ceil(rows.length / per);
    for (let i = 0; i < parts; i++) {
      pages.push({
        id: parts === 1 ? g.id : `${g.id}-${i + 1}`,
        title: parts === 1 ? g.title : `${g.title} (${i + 1}/${parts})`,
        rows: rows.slice(i * per, (i + 1) * per),
      });
    }
  }
  return pages;
}

/** Texto del valor de una fila: «sin dato» o el número con su unidad (y la referencia diaria si existe). */
export function formatInfoValue(row: InfoRow, dv?: number): string {
  if (row.value === undefined) return "sin dato";
  const v = Math.round(row.value * 10) / 10;
  const unit = row.unit.startsWith(" ") ? row.unit : row.unit ? ` ${row.unit}` : "";
  return `${v}${unit}${dv ? ` / ${dv}${row.unit.trim()}` : ""}`;
}
