"use client";

import { useEffect, useRef, useState } from "react";

interface WheelPickerProps<T extends string | number> {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  itemHeight?: number;
  /** Cuántas filas se ven (impar). */
  rows?: number;
  /** "pill": el elemento central va sobre una píldora blanca con texto oscuro (rueda de hora). "soft": píldora translúcida. */
  variant?: "pill" | "soft";
  align?: "center" | "right" | "left";
  ariaLabel?: string;
}

/** Rueda vertical con snap (como el selector de hora): el elemento del centro es el valor. */
export function WheelPicker<T extends string | number>({ items, value, onChange, itemHeight = 40, rows = 5, variant = "pill", align = "center", ariaLabel }: WheelPickerProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, items.findIndex((i) => i.value === value));
  const [active, setActive] = useState(idx);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScrolling = useRef(false);
  const height = itemHeight * rows;
  const pad = (height - itemHeight) / 2;

  // Coloca la rueda en el valor externo (al abrir o cuando cambia desde afuera).
  useEffect(() => {
    const el = ref.current;
    if (!el || userScrolling.current) return;
    el.scrollTo({ top: idx * itemHeight });
    setActive(idx);
  }, [idx, itemHeight]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    userScrolling.current = true;
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / itemHeight)));
    setActive(i);
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => {
      userScrolling.current = false;
      if (items[i] && items[i].value !== value) onChange(items[i].value);
    }, 120);
  }

  const justify = align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";
  return (
    <div className="relative w-full" style={{ height }} role="listbox" aria-label={ariaLabel}>
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: pad,
          height: itemHeight,
          borderRadius: itemHeight / 2,
          background: variant === "pill" ? "#fff" : "rgba(255,255,255,0.13)",
        }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="relative h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: pad,
          paddingBottom: pad,
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)",
          maskImage: "linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)",
        }}
      >
        {items.map((it, i) => {
          const d = Math.abs(i - active);
          const selected = d === 0;
          return (
            <div
              key={String(it.value)}
              role="option"
              aria-selected={selected}
              onClick={() => ref.current?.scrollTo({ top: i * itemHeight, behavior: "smooth" })}
              className="flex items-center cursor-pointer select-none"
              style={{
                height: itemHeight,
                scrollSnapAlign: "center",
                justifyContent: justify,
                paddingInline: 18,
                fontSize: selected ? 20 : d === 1 ? 18 : 16,
                fontWeight: selected ? 800 : 600,
                color: selected && variant === "pill" ? "#111" : "#fff",
                opacity: selected ? 1 : d === 1 ? 0.6 : d === 2 ? 0.32 : 0.15,
                whiteSpace: "nowrap",
                transition: "opacity 120ms, font-size 120ms",
              }}
            >
              {it.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
