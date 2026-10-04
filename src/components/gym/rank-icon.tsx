"use client";

/**
 * Ícono de rango. Si existe la imagen de ese rango+nivel en `public/ranks` (la genera
 * `tools/ranks/build_rank_icons.mjs` a partir de `img vida toal/RANGOS` y la lista en `manifest.json`) se
 * muestra tal cual; si falta, se dibuja un ícono GENÉRICO del mismo tamaño teñido con el color del rango.
 * Cuando agregues la imagen que falta y corras el script, se reemplaza sola, sin tocar código.
 * Las coronas, alas y estrellas ya vienen dibujadas en los PNG; acá no se programan.
 */
import manifest from "../../../public/ranks/manifest.json";
import { NO_RANK_COLOR, RANK_TIER_DEFS } from "@/lib/gym/rank-config";

const ICONS = manifest.icons as Record<string, { aspect: number }>;
const SMALL = 128;
const BIG = 384;

/** ¿Hay imagen real para este rango y nivel? */
export function hasRankImage(tierKey: string, level: number | null): boolean {
  return `${tierKey}-${level ?? 0}` in ICONS;
}

export function RankIcon({
  tierKey,
  level,
  size = 24,
  className,
}: {
  /** key del rango (`RANK_TIER_DEFS[i].key`); null = sin rango (gris). */
  tierKey: string | null;
  level: 1 | 2 | 3 | null;
  /** Alto en px (el ancho respeta la proporción de la imagen). */
  size?: number;
  className?: string;
}) {
  const tier = tierKey ? RANK_TIER_DEFS.find((t) => t.key === tierKey) : undefined;
  const id = tierKey ? `${tierKey}-${level ?? 0}` : "";
  const meta = id ? ICONS[id] : undefined;

  if (tier && meta) {
    // Pantallas con densidad doble usan la versión grande; el navegador escoge con srcSet.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/ranks/${id}-${size > 64 ? BIG : SMALL}.webp`}
        srcSet={`/ranks/${id}-${SMALL}.webp 128w, /ranks/${id}-${BIG}.webp 384w`}
        sizes={`${Math.round(size * meta.aspect)}px`}
        alt={`Rango ${tier.name}${level ? ` ${level}` : ""}`}
        draggable={false}
        className={className}
        style={{ height: size, width: "auto", aspectRatio: String(meta.aspect), objectFit: "contain", userSelect: "none" }}
      />
    );
  }

  // Genérico teñido (también para "sin rango": gris).
  const color = tier?.color ?? NO_RANK_COLOR;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={tier ? `Rango ${tier.name}${level ? ` ${level}` : ""}` : "Sin rango"}
      className={className}
      style={{ userSelect: "none" }}
    >
      <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill={color} fillOpacity={0.22} stroke={color} strokeWidth={5} strokeLinejoin="round" />
      <polygon points="50,20 80,36 80,64 50,80 20,64 20,36" fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={3} strokeLinejoin="round" />
      <polygon
        points="50,34 55,46 68,46 58,54 62,66 50,59 38,66 42,54 32,46 45,46"
        fill={color}
        fillOpacity={tier ? 0.9 : 0.45}
      />
      {level
        ? Array.from({ length: level }, (_, i) => (
            <circle key={i} cx={50 + (i - (level - 1) / 2) * 11} cy={84} r={3.2} fill={color} />
          ))
        : null}
    </svg>
  );
}
