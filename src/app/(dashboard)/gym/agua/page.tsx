"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { format } from "date-fns";
import { WaterBottle } from "@/components/gym/water-bottle";
import { WaterGlass3D, type WaterGlassHandle } from "@/components/gym/water-glass-3d";
import { WeekStrip } from "@/components/shared/week-strip";
import { SettingsGlyph } from "@/components/shared/settings-glyph";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { AddDrinkModal } from "@/components/gym/add-drink-modal";
import { totalsByDrink } from "@/lib/gym/water-stats";
import { waterState } from "@/lib/gym/water-state";
import { useGymStore, useTodayWaterEntries } from "@/lib/store/gymStore";
import { playEvent } from "@/lib/sound/sound-manager";

/** Chorro y salpicón del vaso: duración/volumen proporcionales a los ml, con tope en los 1,25 s que
 * dura la animación del chorro (`POUR_DUR` en `lib/3d/water-glass.ts`) para no sonar más que el vaso. */
function pourSoundFor(ml: number) {
  const durationMs = Math.max(300, Math.min(1250, ml * 2.5));
  const volumeScale = Math.max(0.6, Math.min(1.3, 0.6 + (ml / 500) * 0.7));
  return { durationMs, volumeScale };
}

const QUICK_ADDS = [150, 250, 500];
const SWIPE_Y = 60;
// Stack vertical: vaso (acá) → Fecha (año, % por día) → Por bebida/Tendencia.
const NEXT_HREF = "/gym/agua/fecha";

/** Mezcla los colores de las bebidas de hoy (ponderados por ml) para teñir el agua del vaso. */
function blendColor(parts: { color: string; ml: number }[]): string {
  let r = 0, g = 0, b = 0, w = 0;
  for (const p of parts) {
    const m = /^#?([0-9a-f]{6})$/i.exec(p.color.trim());
    if (!m || p.ml <= 0) continue;
    const n = parseInt(m[1], 16);
    r += ((n >> 16) & 255) * p.ml; g += ((n >> 8) & 255) * p.ml; b += (n & 255) * p.ml; w += p.ml;
  }
  if (w === 0) return "#3b9dff";
  const h = (v: number) => Math.round(v / w).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function AguaPage() {
  const router = useRouter();
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const waterEntries = useGymStore((s) => s.waterEntries);
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const addWater = useGymStore((s) => s.addWater);
  const todayEntries = useTodayWaterEntries();
  const [addDrinkOpen, setAddDrinkOpen] = useState(false);
  // Cada toque en un botón rápido llama directo a `pour()`: el vaso suelta el chorro con salpicón (sin esperar un re-render).
  const glassRef = useRef<WaterGlassHandle>(null);
  // Solo si WebGL o el modelo fallan se muestra la botella SVG (ya no es una opción que elija el usuario).
  const [glassFailed, setGlassFailed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const wheelLock = useRef(false);

  const todayByDrink = useMemo(() => totalsByDrink(todayEntries, drinkOverrides), [todayEntries, drinkOverrides]);
  const totalMl = todayByDrink.reduce((sum, d) => sum + d.ml, 0);
  const water = waterState(totalMl, waterGoalMl);
  const waterColor = useMemo(() => blendColor(todayByDrink.map((d) => ({ color: d.color, ml: d.ml }))), [todayByDrink]);

  // Días en que se llegó a la meta de agua -> check en la franja de abajo.
  const goalDays = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of waterEntries) {
      const k = format(new Date(e.timestamp), "yyyy-MM-dd");
      byDay.set(k, (byDay.get(k) ?? 0) + e.ml);
    }
    return new Set([...byDay].filter(([, ml]) => ml >= waterGoalMl).map(([k]) => k));
  }, [waterEntries, waterGoalMl]);
  const todayISO = format(new Date(), "yyyy-MM-dd");

  return (
    // Pantalla fija (sin scroll propio): deslizar hacia arriba / rueda hacia abajo lleva a Estadísticas.
    <div className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.push("/gym")}
          aria-label="Volver a Gym"
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

      <main
        className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-5 touch-none"
        onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const st = start.current;
          start.current = null;
          if (!st) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (dy < -SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) router.push(NEXT_HREF);
        }}
        onPointerCancel={() => (start.current = null)}
        onWheel={(e) => {
          if (wheelLock.current || e.deltaY < 30) return;
          wheelLock.current = true;
          setTimeout(() => (wheelLock.current = false), 800);
          router.push(NEXT_HREF);
        }}
      >
        {!glassFailed ? (
          <WaterGlass3D
            fraction={water.fraction}
            color={waterColor}
            ref={glassRef}
            onError={() => setGlassFailed(true)}
            className="w-full max-w-sm h-[min(26rem,44dvh)]"
          />
        ) : (
          <WaterBottle segments={todayByDrink.map((d) => ({ color: d.color, ml: d.ml }))} max={waterGoalMl} />
        )}
        <p className="text-sm text-white/60">
          {totalMl} / {waterGoalMl} ml · {Math.round(water.fraction * 100)} %
        </p>
        <div className="flex gap-4">
          {QUICK_ADDS.map((ml) => (
            <button
              key={ml}
              onClick={() => {
                addWater(ml);
                glassRef.current?.pour();
                void playEvent("button-tap");
                const { durationMs, volumeScale } = pourSoundFor(ml);
                void playEvent("water-pour", { durationMs, volumeScale });
                setTimeout(() => void playEvent("water-splash", { volumeScale }), 140);
              }}
              aria-label={`Agregar ${ml} ml`}
              className="relative rounded-2xl flex flex-col items-center justify-center w-16 h-16 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "radial-gradient(circle at 50% 30%, rgb(30,30,30) 0%, rgb(13,13,13) 55%, rgb(5,5,5) 100%)",
                boxShadow: "inset 0 2px 5px rgba(255,255,255,0.1), inset 0 -14px 26px rgba(0,0,0,0.85), 0 10px 26px rgba(0,0,0,0.55)",
              }}
            >
              <span className="text-base font-bold leading-none text-white/85">{ml}</span>
              <span className="text-[9px] leading-none text-white/40 mt-1">ml</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setAddDrinkOpen(true);
            void playEvent("button-tap");
          }}
          className="relative flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white cursor-pointer transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "radial-gradient(circle at 50% 30%, rgb(30,30,30) 0%, rgb(13,13,13) 55%, rgb(5,5,5) 100%)",
            boxShadow: "inset 0 2px 5px rgba(255,255,255,0.1), inset 0 -14px 26px rgba(0,0,0,0.85), 0 10px 26px rgba(0,0,0,0.55)",
          }}
        >
          <Plus size={16} /> Añadir una bebida
        </button>
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px] shrink-0">
        <WeekStrip doneKeys={goalDays} todayISO={todayISO} viewIndex={0} viewCount={3} />
      </div>

      <AddDrinkModal
        open={addDrinkOpen}
        onClose={() => setAddDrinkOpen(false)}
        onAdded={() =>
          window.setTimeout(() => {
            glassRef.current?.pour();
            void playEvent("water-pour", { durationMs: 700, volumeScale: 1 });
            setTimeout(() => void playEvent("water-splash", { volumeScale: 1 }), 140);
          }, 250)
        }
      />
    </div>
  );
}
