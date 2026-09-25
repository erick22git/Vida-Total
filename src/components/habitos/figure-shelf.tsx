"use client";

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import type { FigureState } from "@/lib/3d/scene-collection";
import type { SceneIcon } from "@/lib/3d/scene-registry";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;

/** Iconos de línea propios (uno por figura). */
export function FigureIcon({ icon, size = 26 }: { icon: SceneIcon; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {icon === "forest" && <path {...common} d="M12 3 7.5 10H10l-4 6h5v5h2v-5h5l-4-6h2.5z" />}
      {icon === "castle" && <path {...common} d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12zM10 21v-4a2 2 0 0 1 4 0v4" />}
      {icon === "house" && <path {...common} d="M3 11.5 12 4l9 7.5M5.5 10v11h13V10M10 21v-6h4v6" />}
      {icon === "windmill" && <path {...common} d="M9 21l1.2-9h3.6L15 21zM12 12 6 5.5M12 12l6.5 5M12 12l5.5-6.5M12 12 5.5 17.5" />}
      {icon === "room" && <path {...common} d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />}
    </svg>
  );
}

/**
 * Fila inferior con las figuras de la colección. Solo la figura ya desbloqueada se puede elegir; las
 * futuras se ven bloqueadas y al tocarlas hacen un pequeño temblor (no cambian de escena).
 */
export function FigureShelf({
  figures,
  icons,
  names,
  selectedIndex,
  onSelect,
  onLockedTap,
  shake,
  justUnlockedId,
}: {
  figures: FigureState[];
  icons: SceneIcon[];
  names: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onLockedTap: (index: number) => void;
  /** { index, n }: n cambia en cada toque bloqueado para reiniciar el temblor. */
  shake: { index: number; n: number } | null;
  justUnlockedId: string | null;
}) {
  return (
    <div className="flex items-end justify-center gap-4">
      {figures.map((f) => {
        const selected = f.index === selectedIndex;
        const locked = !f.unlocked;
        const fresh = justUnlockedId === f.id;
        return (
          <motion.button
            key={`${f.id}-${shake && shake.index === f.index ? shake.n : 0}`}
            onClick={() => (locked ? onLockedTap(f.index) : onSelect(f.index))}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={locked ? `${names[f.index]} (bloqueada)` : `${names[f.index]}${f.status === "complete" ? " (completa)" : ""}`}
            aria-disabled={locked}
            className="relative flex flex-col items-center gap-1.5 cursor-pointer"
            style={{ color: selected ? "#fff" : locked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.62)", WebkitTapHighlightColor: "transparent" }}
            animate={
              shake && shake.index === f.index
                ? { x: [0, -5, 5, -3, 3, 0] }
                : fresh
                  ? { scale: [1, 1.28, 0.94, 1.08, 1] }
                  : { x: 0, scale: 1 }
            }
            transition={{ duration: fresh ? 0.7 : 0.38, ease: "easeOut" }}
          >
            <span className="relative w-9 h-9 flex items-center justify-center">
              <FigureIcon icon={icons[f.index]} />
              {locked && (
                <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#1c1c1c" }}>
                  <Lock size={10} strokeWidth={2.4} />
                </span>
              )}
              {f.status === "complete" && (
                <span className="absolute -right-0.5 -top-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[#f5b301] text-black">
                  <Check size={10} strokeWidth={3.2} />
                </span>
              )}
            </span>
            <span className="h-[2px] w-6 rounded-full transition-colors" style={{ background: selected ? "#f5b301" : "transparent" }} />
            <span className="sr-only" style={MONO}>
              {names[f.index]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
