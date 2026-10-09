"use client";

/**
 * Agua: segunda vista del stack vertical (vaso → FECHA → por bebida/tendencia). Mismo mecanismo de
 * swipe/rueda que el vaso (`/gym/agua/page.tsx`): deslizar o girar hacia arriba avanza (a Por bebida),
 * hacia abajo retrocede (al vaso). El contenido es `WaterYearView` (ver ese archivo).
 */
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { WaterYearView } from "@/components/gym/water-year-view";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { useGymStore } from "@/lib/store/gymStore";

const SWIPE_Y = 60;
const PREV_HREF = "/gym/agua";
const NEXT_HREF = "/gym/agua/estadisticas";

export default function AguaFechaPage() {
  const router = useRouter();
  const waterEntries = useGymStore((s) => s.waterEntries);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden touch-none"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const st = start.current;
        start.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (Math.abs(dy) <= Math.abs(dx) * 1.4) return;
        if (dy < -SWIPE_Y) router.push(NEXT_HREF);
        else if (dy > SWIPE_Y) router.push(PREV_HREF);
      }}
      onPointerCancel={() => (start.current = null)}
      onWheel={(e) => {
        if (wheelLock.current || Math.abs(e.deltaY) < 30) return;
        wheelLock.current = true;
        setTimeout(() => (wheelLock.current = false), 800);
        router.push(e.deltaY > 0 ? NEXT_HREF : PREV_HREF);
      }}
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.push(PREV_HREF)}
          aria-label="Volver"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[20px] uppercase tracking-[0.12em]" style={MONO_FONT}>
          Agua
        </h1>
        <span className="w-10 h-10 -mr-2 flex items-center justify-center" aria-hidden>
          <SettingsGlyph />
        </span>
      </header>

      <div className="flex-1 min-h-0">
        <WaterYearView waterEntries={waterEntries} waterGoalMl={waterGoalMl} todayISO={todayISO} viewIndex={1} viewCount={3} />
      </div>
    </div>
  );
}
