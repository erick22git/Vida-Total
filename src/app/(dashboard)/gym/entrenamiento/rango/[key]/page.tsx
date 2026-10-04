"use client";

/**
 * Lista de ejercicios de un músculo o grupo con el rango del usuario en cada uno (ícono + nombre + 1RM estimado), ordenada por
 * rango. `[key]` es la clave de un grupo (brazos, piernas…) o un músculo (Pecho, Biceps…). Es una lista normal (con scroll); la
 * pantalla sin scroll es la de /rango.
 */
import { use, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RankIcon } from "@/components/gym/rank-icon";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useRankProfile } from "@/lib/gym/use-rank";
import { MUSCLE_LABEL, NO_RANK_COLOR, RANK_GROUPS } from "@/lib/gym/rank-config";
import { standardForExercise } from "@/lib/gym/rank-engine";
import { MONO_FONT } from "@/lib/ui/mono-font";

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export default function RangoListaPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = use(params);
  const key = decodeURIComponent(rawKey);
  const allExercises = useAllExercises();
  const { profile, missing } = useRankProfile();

  const group = RANK_GROUPS.find((g) => g.key === key && g.key !== "cuerpo");
  const categories = group ? group.categories : MUSCLE_LABEL[key] ? [key] : [];
  const title = group ? group.label : (MUSCLE_LABEL[key] ?? "Ejercicios");
  const aggregate = group ? profile?.byGroup[group.key] : profile?.byMuscle[key];
  const rank = aggregate?.rank ?? null;

  const { ranked, pending, withoutStandard } = useMemo(() => {
    const inScope = allExercises.filter((e) => categories.includes(e.categoria));
    const withRank = inScope
      .filter((e) => profile?.byExercise[e.id])
      .sort((a, b) => profile!.byExercise[b.id].rank.score - profile!.byExercise[a.id].rank.score);
    const noRank = inScope.filter((e) => !profile?.byExercise[e.id]);
    return {
      ranked: withRank,
      pending: noRank.filter((e) => standardForExercise(e.id)),
      withoutStandard: noRank.filter((e) => !standardForExercise(e.id)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExercises, profile, key]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/rango" aria-label="Volver a Rango" className="w-10 h-10 rounded-full flex items-center justify-center bg-black/60">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[16px] uppercase tracking-[0.14em]" style={MONO_FONT}>
          {title}
        </h1>
      </header>

      <div className="rounded-3xl p-4 flex items-center gap-3 bg-white/[0.05] border border-white/10">
        <RankIcon tierKey={rank?.tier.key ?? null} level={rank?.level ?? null} size={52} />
        <div className="flex-1">
          <p className="text-[15px] tracking-[0.1em]" style={{ ...MONO_FONT, color: rank ? rank.tier.color : NO_RANK_COLOR }}>
            {rank ? rank.label : "SIN RANGO"}
          </p>
          <p className="text-[11px] text-white/45">
            {aggregate ? `${aggregate.rated}/${aggregate.total} ${group ? "músculos" : "ejercicios"} con rango` : ""}
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <Link
          href={`/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/rango/${key}`}
          className="rounded-2xl px-4 py-3 text-sm bg-white text-black font-semibold text-center"
        >
          Completa tu {missing.join(" y tu ")} para ver tus rangos
        </Link>
      )}

      {ranked.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-white/40 px-1" style={MONO_FONT}>
            Tus rangos
          </h2>
          {ranked.map((e) => {
            const r = profile!.byExercise[e.id];
            return (
              <Link
                key={e.id}
                href={`/gym/entrenamiento/${e.id}?tab=rango`}
                className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 bg-white/[0.05] border border-white/[0.07]"
              >
                <RankIcon tierKey={r.rank.tier.key} level={r.rank.level} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.nombre}</p>
                  <p className="text-[11px] text-white/45">
                    {r.kind === "kg" ? `1RM estimado ${fmt(r.performance.value)} kg` : `${r.performance.reps} repeticiones`}
                    {r.estimated ? " · estimado" : ""}
                    {r.performance.capped ? " · muchas reps" : ""}
                  </p>
                </div>
                <span className="text-[11px] tracking-[0.08em] shrink-0" style={{ ...MONO_FONT, color: r.rank.tier.color }}>
                  {r.rank.label}
                </span>
                <ChevronRight size={14} className="text-white/30 shrink-0" />
              </Link>
            );
          })}
        </section>
      )}

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-white/40 px-1" style={MONO_FONT}>
            Sin rango todavía
          </h2>
          {pending.map((e) => (
            <Link
              key={e.id}
              href={`/gym/entrenamiento/${e.id}?tab=rango`}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="w-9 flex justify-center">
                <RankIcon tierKey={null} level={null} size={28} />
              </div>
              <p className="flex-1 text-sm text-white/65 truncate">{e.nombre}</p>
              <ChevronRight size={14} className="text-white/25 shrink-0" />
            </Link>
          ))}
        </section>
      )}

      {withoutStandard > 0 && (
        <p className="text-[11px] text-white/35 px-1">
          {withoutStandard} ejercicio{withoutStandard === 1 ? "" : "s"} de este grupo no tiene{withoutStandard === 1 ? "" : "n"} estándar de fuerza confiable y no se
          califica{withoutStandard === 1 ? "" : "n"}.
        </p>
      )}
      {categories.length === 0 && <p className="text-sm text-white/45 text-center py-10">No encontramos ese músculo.</p>}
    </div>
  );
}
