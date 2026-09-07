"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";

export function BeforeAfterSlider({
  beforeLabel = "Antes",
  afterLabel = "Después",
}: {
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pct, setPct] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const relative = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, relative)));
  }

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden select-none cursor-ew-resize"
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* "after" layer (full) */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white/25 text-sm font-medium"
        style={{ background: "linear-gradient(160deg, var(--gym-2)33, transparent)" }}
      >
        {afterLabel}
      </div>
      {/* "before" layer (clipped) */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white/25 text-sm font-medium"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.08), transparent)",
          clipPath: `inset(0 ${100 - pct}% 0 0)`,
        }}
      >
        {beforeLabel}
      </div>

      <div className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
        <div className="w-[2px] h-full bg-white/70" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white text-black shadow-lg">
          <GripVertical size={16} />
        </div>
      </div>

      <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
        {afterLabel}
      </span>
    </div>
  );
}
