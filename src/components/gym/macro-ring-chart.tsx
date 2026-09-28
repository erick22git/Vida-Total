"use client";

/**
 * Anillo de distribución de macros (imagen de referencia: "MACROS 100%" con el anillo blanco y la
 * lista de porcentajes al lado) — reemplaza a la barra horizontal que había antes en esta pantalla.
 */
const MACRO_COLORS = { proteina: "#ffffff", carbos: "rgba(255,255,255,0.35)", grasas: "rgba(255,255,255,0.6)" };

export function MacroRingChart({
  proteinaPct,
  carbosPct,
  grasasPct,
}: {
  proteinaPct: number;
  carbosPct: number;
  grasasPct: number;
}) {
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const segments: { pct: number; color: string }[] = [
    { pct: proteinaPct, color: MACRO_COLORS.proteina },
    { pct: carbosPct, color: MACRO_COLORS.carbos },
    { pct: grasasPct, color: MACRO_COLORS.grasas },
  ];
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const dash = (s.pct / 100) * circumference;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-wide text-white/40">Macros</span>
          <span className="text-lg font-bold text-white tabular-nums">
            {Math.round(proteinaPct + carbosPct + grasasPct)}%
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs">
        <MacroRow color={MACRO_COLORS.proteina} label="Proteínas" pct={proteinaPct} />
        <MacroRow color={MACRO_COLORS.carbos} label="Carbohidratos" pct={carbosPct} />
        <MacroRow color={MACRO_COLORS.grasas} label="Grasas" pct={grasasPct} />
      </div>
    </div>
  );
}

function MacroRow({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <span className="flex items-center gap-2 text-white/70">
      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
      <span className="ml-auto text-white/45 tabular-nums">{Math.round(pct)}%</span>
    </span>
  );
}
