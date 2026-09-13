"use client";

import { useState } from "react";
import { Shield, Medal, Gem, Trophy, Crown, ChevronLeft, ToggleLeft, ToggleRight, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  RANK_TIERS,
  getBestSet,
  getExerciseSP,
  getRankStanding,
  type RankTier,
} from "@/lib/gym-utils";
import { useGymStore } from "@/lib/store/gymStore";

const TIER_ICONS: Record<string, LucideIcon> = {
  hierro: Shield,
  bronce: Medal,
  plata: Medal,
  oro: Medal,
  platino: Medal,
  esmeralda: Medal,
  diamante: Gem,
  campeon: Trophy,
  simetrico: Crown,
};

export function ExerciseRankTab({ exerciseId }: { exerciseId: string }) {
  const sessions = useGymStore((s) => s.sessions);
  const excluded = useGymStore((s) => s.excludedFromGlobalRank);
  const toggleGlobal = useGymStore((s) => s.toggleExerciseGlobalRank);

  const [view, setView] = useState<"detail" | "pyramid">("detail");

  const sp = getExerciseSP(exerciseId, sessions);
  const standing = getRankStanding(sp);
  const bestSet = getBestSet(exerciseId, sessions);
  const includedInGlobal = !excluded.includes(exerciseId);

  if (view === "pyramid") {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setView("detail")}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white cursor-pointer"
        >
          <ChevronLeft size={16} /> Volver al detalle
        </button>
        <div className="flex flex-col gap-2">
          {[...RANK_TIERS].reverse().map((tier) => (
            <PyramidRow key={tier.key} tier={tier} isCurrent={tier.key === standing.tier.key} />
          ))}
        </div>
      </div>
    );
  }

  const Icon = TIER_ICONS[standing.tier.key] ?? Medal;

  return (
    <div className="flex flex-col gap-5">
      <GlassCard accentColor={standing.tier.color} glow className="flex flex-col items-center gap-3 py-8 text-center">
        <div
          className="flex items-center justify-center w-24 h-24 rounded-full"
          style={{ background: `${standing.tier.color}22`, boxShadow: `0 0 40px ${standing.tier.color}55` }}
        >
          <Icon size={48} style={{ color: standing.tier.color }} />
        </div>
        <h2
          className="text-3xl font-extrabold tracking-wide uppercase"
          style={{ color: standing.tier.color, textShadow: `0 0 24px ${standing.tier.color}66` }}
        >
          {standing.tier.name}
        </h2>
        {standing.tier.topPct && <p className="text-xs text-white/45">TOP {standing.tier.topPct}%</p>}

        <div className="w-full flex items-center gap-2 mt-2">
          <Icon size={18} style={{ color: standing.tier.color }} />
          <div className="flex-1 h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: standing.spForNextTier
                  ? `${Math.min(100, (standing.spIntoTier / standing.spForNextTier) * 100)}%`
                  : "100%",
                background: `linear-gradient(90deg, ${standing.tier.color}, ${standing.nextTier?.color ?? standing.tier.color})`,
              }}
            />
          </div>
          {standing.nextTier ? (
            (() => {
              const NextIcon = TIER_ICONS[standing.nextTier.key] ?? Medal;
              return <NextIcon size={18} style={{ color: standing.nextTier.color }} />;
            })()
          ) : (
            <Icon size={18} style={{ color: standing.tier.color }} />
          )}
        </div>
        <p className="text-xs text-white/50">
          {standing.spIntoTier}/{standing.spForNextTier || standing.sp} SP
        </p>

        <button
          onClick={() => setView("pyramid")}
          className="text-xs text-white/45 underline mt-1 cursor-pointer"
        >
          Ver pirámide completa
        </button>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Detalles del rango</p>
        <Detail label="Mejor serie" value={bestSet ? `${bestSet.peso} kg x ${bestSet.reps}` : "Sin datos"} />
        <Detail
          label="Serie para siguiente rango"
          value={
            standing.nextTier
              ? `+${Math.max(1, Math.round((standing.spForNextTier - standing.spIntoTier) / 0.6))} kg de volumen`
              : "Rango máximo alcanzado"
          }
        />
        <Detail label="Siguiente Rango" value={standing.nextTier?.name ?? "—"} />
        <button
          onClick={() => toggleGlobal(exerciseId)}
          className="flex items-center justify-between rounded-2xl px-3.5 py-2.5 mt-1 bg-white/[0.04] glass-specular-ring cursor-pointer"
        >
          <span className="text-sm text-white/75">Incluir en rango global</span>
          {includedInGlobal ? (
            <ToggleRight size={26} className="text-[var(--gym-2)]" />
          ) : (
            <ToggleLeft size={26} className="text-white/30" />
          )}
        </button>
      </GlassCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function PyramidRow({ tier, isCurrent }: { tier: RankTier; isCurrent: boolean }) {
  const Icon = TIER_ICONS[tier.key] ?? Medal;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
      style={{
        background: isCurrent ? `${tier.color}1f` : "rgba(255,255,255,0.03)",
        border: `1px solid ${isCurrent ? tier.color : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
        style={{ background: `${tier.color}26` }}
      >
        <Icon size={18} style={{ color: tier.color }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{tier.name}</p>
        <p className="text-[11px] text-white/40">{tier.topPct ? `Top ${tier.topPct}%` : "Rango base"}</p>
      </div>
      {isCurrent && (
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tier.color, color: "#0a0a0f" }}>
          <ArrowUp size={11} /> Tú
        </span>
      )}
    </div>
  );
}
