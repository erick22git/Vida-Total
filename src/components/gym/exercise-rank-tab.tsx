"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, Medal, Gem, Trophy, Crown, ChevronLeft, ToggleLeft, ToggleRight, ArrowUp, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { RANK_TIER_DEFS, type RankTierDef } from "@/lib/gym/rank-config";
import { REPS_CAP, standardForExercise, weightForOneRepMax } from "@/lib/gym/rank-engine";
import { useRankProfile } from "@/lib/gym/use-rank";
import { useGymStore } from "@/lib/store/gymStore";

const TIER_ICONS: Record<string, LucideIcon> = {
  hierro: Shield,
  cobre: Medal,
  plata: Medal,
  oro: Medal,
  platino: Medal,
  esmeralda: Medal,
  diamante: Gem,
  campeon: Trophy,
  simetrico: Crown,
};

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export function ExerciseRankTab({ exerciseId }: { exerciseId: string }) {
  const excluded = useGymStore((s) => s.excludedFromGlobalRank);
  const toggleGlobal = useGymStore((s) => s.toggleExerciseGlobalRank);
  const { profile, missing } = useRankProfile();

  const [view, setView] = useState<"detail" | "pyramid">("detail");

  const result = profile?.byExercise[exerciseId] ?? null;
  const standard = standardForExercise(exerciseId);
  const includedInGlobal = !excluded.includes(exerciseId);
  const tier = result?.rank.tier;

  if (view === "pyramid") {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setView("detail")} className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white cursor-pointer">
          <ChevronLeft size={16} /> Volver al detalle
        </button>
        <div className="flex flex-col gap-2">
          {[...RANK_TIER_DEFS].reverse().map((t) => (
            <PyramidRow key={t.key} tier={t} isCurrent={t.key === tier?.key} />
          ))}
        </div>
      </div>
    );
  }

  if (!standard) {
    return (
      <GlassCard className="flex flex-col gap-2 py-6 text-center">
        <p className="text-sm font-semibold text-white/80">Este ejercicio no tiene rango</p>
        <p className="text-xs text-white/45">
          Los rangos se calculan comparando lo que levantas con estándares de fuerza. Para este ejercicio no hay un estándar confiable, así
          que no se califica.
        </p>
      </GlassCard>
    );
  }

  if (missing.length > 0) {
    return (
      <GlassCard className="flex flex-col gap-3 py-6 text-center items-center">
        <p className="text-sm font-semibold text-white/80">Falta tu {missing.join(" y tu ")}</p>
        <p className="text-xs text-white/45">Tu rango se calcula con cuánto levantas respecto a tu peso corporal y tu sexo.</p>
        <Link
          href={`/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/${exerciseId}`}
          className="rounded-full px-5 py-2.5 text-sm font-semibold bg-white text-black"
        >
          Completar mi perfil
        </Link>
      </GlassCard>
    );
  }

  if (!result || !tier) {
    return (
      <GlassCard className="flex flex-col gap-2 py-6 text-center">
        <p className="text-sm font-semibold text-white/80">Sin rango todavía</p>
        <p className="text-xs text-white/45">
          Completa una serie de este ejercicio{standard.standard.kind === "kg" ? " con peso" : ""} y aparece tu rango.
        </p>
        {standard.estimated && <p className="text-[11px] text-white/35">Estimado a partir de: {standard.standard.name}.</p>}
      </GlassCard>
    );
  }

  const Icon = TIER_ICONS[tier.key] ?? Medal;
  const perf = result.performance;
  const isReps = result.kind === "reps";

  return (
    <div className="flex flex-col gap-5">
      <GlassCard accentColor={tier.color} glow className="flex flex-col items-center gap-3 py-8 text-center">
        <div
          className="flex items-center justify-center w-24 h-24 rounded-full"
          style={{ background: `${tier.color}22`, boxShadow: `0 0 40px ${tier.color}55` }}
        >
          <Icon size={48} style={{ color: tier.color }} />
        </div>
        <h2 className="text-3xl font-extrabold tracking-wide uppercase" style={{ color: tier.color, textShadow: `0 0 24px ${tier.color}66` }}>
          {result.rank.label}
        </h2>
        <p className="text-xs text-white/45">
          Más fuerte que el {Math.round(result.rank.percentile)} % de quienes entrenan
          {result.estimated ? " · estimado" : ""}
        </p>
        <button onClick={() => setView("pyramid")} className="text-xs text-white/45 underline mt-1 cursor-pointer">
          Ver pirámide completa
        </button>
      </GlassCard>

      {perf.capped && (
        <div className="flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs" style={{ background: "#f59e0b1f", color: "#fbbf24" }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Tu mejor serie tiene más de {REPS_CAP} repeticiones. Para el cálculo se usan {REPS_CAP}, porque la fórmula sobreestima con muchas
            repeticiones: con series de 5 a 10 el resultado es más fiable.
          </span>
        </div>
      )}

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Detalles del rango</p>
        <Detail label="Mejor serie" value={isReps ? `${perf.reps} repeticiones` : `${fmt(perf.peso)} kg x ${perf.reps}`} />
        {!isReps && <Detail label="1RM estimado" value={`${fmt(perf.value)} kg`} />}
        <Detail label="Siguiente nivel" value={result.next?.label ?? "Rango máximo alcanzado"} />
        {result.next && (
          <Detail
            label="Te falta"
            value={
              isReps
                ? `${Math.max(1, Math.ceil(result.next.missing))} repeticiones más`
                : `${fmt(result.next.missing)} kg de 1RM (≈ ${fmt(weightForOneRepMax(result.next.value, 5))} kg x 5)`
            }
          />
        )}
        {result.estimated && (
          <p className="text-[11px] text-white/35">
            Sin tabla propia: se estima a partir de «{standard.standard.name}». Tómalo como orientativo.
          </p>
        )}
        <button
          onClick={() => toggleGlobal(exerciseId)}
          className="flex items-center justify-between rounded-2xl px-3.5 py-2.5 mt-1 bg-white/[0.04] glass-specular-ring cursor-pointer"
        >
          <span className="text-sm text-white/75">Incluir en rango global</span>
          {includedInGlobal ? <ToggleRight size={26} className="text-[var(--gym-2)]" /> : <ToggleLeft size={26} className="text-white/30" />}
        </button>
      </GlassCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/50 shrink-0">{label}</span>
      <span className="font-medium text-white text-right">{value}</span>
    </div>
  );
}

function PyramidRow({ tier, isCurrent }: { tier: RankTierDef; isCurrent: boolean }) {
  const Icon = TIER_ICONS[tier.key] ?? Medal;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
      style={{
        background: isCurrent ? `${tier.color}1f` : "rgba(255,255,255,0.03)",
        border: `1px solid ${isCurrent ? tier.color : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full shrink-0" style={{ background: `${tier.color}26` }}>
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
