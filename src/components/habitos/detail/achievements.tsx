import { LEVEL_STEP, LEVEL_MAX, MILESTONES } from "@/lib/progress";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** 0..1 */
  progress: number;
}

/** Logros derivados del progreso (repeticiones + mejor racha) — no se
 * guardan, se calculan cada vez. */
export function buildAchievements(total: number, bestStreak: number): Achievement[] {
  const levels = Array.from({ length: LEVEL_MAX }, (_, i) => {
    const target = (i + 1) * LEVEL_STEP;
    return {
      id: `level-${target}`,
      title: `Nivel ${i + 1}`,
      description: `Completa ${target} repeticiones`,
      progress: Math.min(total / target, 1),
    };
  });
  const streaks = MILESTONES.map((m) => ({
    id: `streak-${m}`,
    title: `Racha de ${m}`,
    description: `Alcanza una racha de ${m} días`,
    progress: Math.min(bestStreak / m, 1),
  }));
  return [...levels, ...streaks];
}

/** Insignia con anillo de progreso (referencia: tarjetas de Logros). */
export function AchievementCard({ a, wide }: { a: Achievement; wide?: boolean }) {
  const pct = Math.round(a.progress * 100);
  const complete = a.progress >= 1;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`rounded-3xl p-4 flex flex-col gap-3 ${wide ? "w-full" : "w-[44%] min-w-[150px] shrink-0 snap-start"}`}
      style={{ background: "#1c1c1c" }}
    >
      <div className="relative w-[112px] h-[112px] mx-auto flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#f5b301"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - a.progress)}
          />
        </svg>
        <span className="text-[24px] font-black tabular-nums" style={{ color: complete ? "#f5b301" : "#fff" }}>
          {complete ? "✓" : `${pct}%`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[16px] font-semibold leading-tight">{a.title}</p>
        <p className="text-[14px] leading-snug text-white/55">{a.description}</p>
      </div>
    </div>
  );
}
