"use client";

/**
 * Vista de progreso Kegel — se activa deslizando al tercer panel (view=2).
 * Muestra: racha actual/récord, días por semana (últimas 4), totales, nivel.
 * Diseño: fondo oscuro con grilla de barras de semana, mismo estilo que el año.
 */
import { useMemo } from "react";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { computeKegelStreak, localDayKey } from "@/lib/gym/kegel-dates";
import { fullyDoneDays } from "@/lib/store/kegelPlanStore";
import { LEVEL_DAY_THRESHOLDS } from "@/lib/gym/kegel-plan";
import { useGymStore } from "@/lib/store/gymStore";
import { useKegelPlanStore } from "@/lib/store/kegelPlanStore";

const DAYS_ES = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKS_BACK = 8;

function getWeekGrid(doneDays: Set<string>, todayKey: string): { key: string; done: boolean; partial: boolean }[][] {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=lunes
  const weeks: { key: string; done: boolean; partial: boolean }[][] = [];

  for (let w = WEEKS_BACK - 1; w >= 0; w--) {
    const week: { key: string; done: boolean; partial: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + (6 - dayOfWeek) - d;
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      week.push({ key: k, done: doneDays.has(k), partial: false });
    }
    weeks.push(week);
  }
  return weeks;
}

function DayDot({ done, partial, isToday }: { done: boolean; partial: boolean; isToday: boolean }) {
  return (
    <div
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
      style={{
        background: done ? "#fff" : partial ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.07)",
        border: isToday ? "2px solid rgba(255,255,255,0.7)" : "none",
      }}
    />
  );
}

export function KegelProgressView({
  viewIndex,
  viewCount,
}: {
  viewIndex: number;
  viewCount: number;
}) {
  const todayKey = localDayKey();
  const completed = useKegelPlanStore((s) => s.completed);
  const totalSessions = useGymStore((s) => s.kegelTotalSessions);
  const level = useGymStore((s) => s.kegelLevel);

  const doneDays = useMemo(() => fullyDoneDays(completed), [completed]);
  const streak = useMemo(() => computeKegelStreak(doneDays, todayKey), [doneDays, todayKey]);
  const weekGrid = useMemo(() => getWeekGrid(doneDays, todayKey), [doneDays, todayKey]);

  const doneDaysCount = doneDays.size;
  const nextLevel = Math.min(10, level + 1);
  const nextThreshold = LEVEL_DAY_THRESHOLDS[nextLevel] ?? 0;
  const currentThreshold = LEVEL_DAY_THRESHOLDS[level] ?? 0;
  const levelProgress = nextThreshold > currentThreshold
    ? (doneDaysCount - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  return (
    <div className="absolute inset-0 overflow-y-auto flex flex-col items-center px-5 pt-4 pb-[max(env(safe-area-inset-bottom),28px)]">
      {/* Racha */}
      <div className="w-full flex gap-3 mb-5">
        <div className="flex-1 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-1" style={{ ...MONO_FONT, color: "#888" }}>Racha actual</p>
          <p className="text-[38px] font-bold leading-none">{streak.current}</p>
          <p className="text-[13px]" style={{ color: "#aab4c8" }}>días</p>
        </div>
        <div className="flex-1 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-1" style={{ ...MONO_FONT, color: "#888" }}>Récord</p>
          <p className="text-[38px] font-bold leading-none">{streak.best}</p>
          <p className="text-[13px]" style={{ color: "#aab4c8" }}>días</p>
        </div>
      </div>

      {/* Totales */}
      <div className="w-full flex gap-3 mb-5">
        <div className="flex-1 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-1" style={{ ...MONO_FONT, color: "#888" }}>Días completados</p>
          <p className="text-[38px] font-bold leading-none">{doneDaysCount}</p>
        </div>
        <div className="flex-1 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-1" style={{ ...MONO_FONT, color: "#888" }}>Sesiones</p>
          <p className="text-[38px] font-bold leading-none">{totalSessions}</p>
        </div>
      </div>

      {/* Nivel + progreso */}
      <div className="w-full rounded-[14px] p-4 mb-5" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="flex justify-between items-baseline mb-2">
          <p className="text-[11px] uppercase tracking-widest" style={{ ...MONO_FONT, color: "#888" }}>Nivel</p>
          {level < 10 && (
            <p className="text-[12px]" style={{ color: "#aab4c8" }}>
              {doneDaysCount}/{nextThreshold} días para nivel {nextLevel}
            </p>
          )}
        </div>
        <p className="text-[38px] font-bold leading-none mb-2">{level}</p>
        {level < 10 && (
          <div className="h-[6px] rounded-full w-full" style={{ background: "rgba(255,255,255,0.12)" }}>
            <div
              className="h-full rounded-full"
              style={{ background: "#fff", width: `${Math.min(1, levelProgress) * 100}%` }}
            />
          </div>
        )}
        {level >= 10 && (
          <p className="text-[13px]" style={{ color: "#aab4c8" }}>Nivel máximo alcanzado</p>
        )}
      </div>

      {/* Cuadrícula de semanas */}
      <div className="w-full rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.08)" }}>
        <p className="text-[11px] uppercase tracking-widest mb-3" style={{ ...MONO_FONT, color: "#888" }}>Últimas {WEEKS_BACK} semanas</p>
        {/* Cabecera días */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_ES.map((d) => (
            <div key={d} className="text-center text-[11px]" style={{ color: "#555", ...MONO_FONT }}>{d}</div>
          ))}
        </div>
        {/* Semanas */}
        {weekGrid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((day) => (
              <DayDot key={day.key} done={day.done} partial={day.partial} isToday={day.key === todayKey} />
            ))}
          </div>
        ))}
      </div>

      {/* Indicador de scroll */}
      <div className="flex gap-[5px] mt-5" aria-hidden>
        {Array.from({ length: viewCount }, (_, i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: i === viewIndex ? 16 : 6,
              height: 6,
              background: i === viewIndex ? "#fff" : "rgba(255,255,255,0.3)",
              transition: "width 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
