"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, Info } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassBadge } from "@/components/glass/glass-badge";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useGymStore } from "@/lib/store/gymStore";
import { ATHLETE_CONFIDENCE_LABEL, getAthletePlan } from "@/lib/data/athlete-plans";
import { athleteExerciseRest, copyAthletePlan, HEAVY_SET_GUIDE } from "@/lib/gym/athlete-plan-copy";
import { formatRest, REST_BASE_SECONDS } from "@/lib/training/rest-guidelines";
import { notifyInfo } from "@/lib/notify/use-notify";
import type { AthleteConfidence, AthleteExercise } from "@/lib/types";

const CONFIDENCE_COLOR: Record<AthleteConfidence, string> = {
  confirmado: "#22c55e",
  secundaria: "#5b8def",
  estimado: "#f59e0b",
  "no-verificado": "#ef4444",
};

function repsLabel(ex: AthleteExercise) {
  if (ex.repsPorSerie) return ex.repsPorSerie.join(" · ");
  return ex.repsMin === ex.repsMax ? `${ex.repsMax}` : `${ex.repsMin}–${ex.repsMax}`;
}

function RestLine({ ex }: { ex: AthleteExercise }) {
  const r = athleteExerciseRest(ex);
  return (
    <p className="text-[11px] text-white/50">
      Descanso: {formatRest(r.seconds)} · {r.origen === "fuente" ? "según la fuente" : `guía (${r.reason})`}
    </p>
  );
}

export default function AthletePlanPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = use(params);
  const router = useRouter();
  const allExercises = useAllExercises();
  const saveRoutine = useGymStore((s) => s.saveRoutine);
  const createPlan = useGymStore((s) => s.createPlan);
  const plan = getAthletePlan(athleteId);
  const [copied, setCopied] = useState<string | null>(null);

  if (!plan) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <Link href="/gym/entrenamiento/planificaciones" className="text-white/50 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <p className="text-sm text-white/50">No encontré esa rutina.</p>
      </div>
    );
  }

  const nameOf = (id: string) => allExercises.find((e) => e.id === id)?.nombre ?? id;

  function handleCopy() {
    if (!plan) return;
    const created = copyAthletePlan(plan, { saveRoutine, createPlan });
    setCopied(created.id);
    notifyInfo("Copiada a Mis Planes", "Ya la podés editar.");
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{plan.atleta}</h1>
          <p className="text-xs text-white/50 truncate">{plan.nombre}</p>
        </div>
      </header>

      <GlassCard interactive={false} className="flex flex-col gap-2" style={{ background: "var(--glass-bg-dark)" }}>
        <p className="text-sm text-white/80">{plan.resumen}</p>
        <p className="text-xs text-white/50">{plan.enfoque}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <GlassBadge color={CONFIDENCE_COLOR[plan.confianzaGeneral]}>{ATHLETE_CONFIDENCE_LABEL[plan.confianzaGeneral]}</GlassBadge>
          <GlassBadge>Solo lectura</GlassBadge>
        </div>
      </GlassCard>

      <GlassCard interactive={false} className="flex flex-col gap-2" style={{ background: "var(--glass-bg-dark)" }}>
        <p className="text-sm font-semibold text-white/85">Cómo leer esta rutina</p>
        <ul className="text-xs text-white/60 leading-relaxed list-disc pl-4 flex flex-col gap-1">
          <li>
            <b>Al fallo / descendente:</b> las series marcadas llegan a esos tipos al copiar la rutina, igual que en el registro de series.
          </li>
          <li>
            <b>Serie pesada:</b> cerca del fallo en las últimas 2–3 reps. No se guarda un peso: lo elegís vos.
          </li>
          <li>
            <b>Descanso:</b> si la fuente lo da, manda. Si no, es una guía por tipo de ejercicio ({formatRest(REST_BASE_SECONDS["compuesto-pesado"])} compuesto
            pesado · {formatRest(REST_BASE_SECONDS.compuesto)} compuesto · {formatRest(REST_BASE_SECONDS.aislamiento)} aislamiento), con 30 s más tras series al
            fallo o pesadas y 60 s más tras una descendente.
          </li>
          <li>
            <b>Etiquetas:</b> «Fuente secundaria» = resumen de terceros; «Estimado» = nuestra estimación; «No verificado» = sin fuente directa.
          </li>
        </ul>
      </GlassCard>

      {plan.dias.map((dia, i) => (
        <div key={dia.nombre} className="flex flex-col gap-2.5">
          <h2 className="text-base font-semibold text-white/85">
            {i + 1}. {dia.nombre}
          </h2>
          {dia.ejercicios.map((ex, j) => (
            <GlassCard key={`${ex.exerciseId}-${j}`} padding="sm" interactive={false} className="flex flex-col gap-1.5" style={{ background: "var(--glass-bg-dark)" }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{nameOf(ex.exerciseId)}</p>
                <GlassBadge color={CONFIDENCE_COLOR[ex.confianza]}>{ATHLETE_CONFIDENCE_LABEL[ex.confianza]}</GlassBadge>
              </div>
              <p className="text-xs text-white/70">
                {ex.series} {ex.series === 1 ? "serie" : "series"} × {repsLabel(ex)} reps
                {ex.seriesAlFallo ? ` · ${ex.seriesAlFallo === ex.series ? "todas" : ex.seriesAlFallo} al fallo` : ""}
                {ex.tempo ? ` · tempo ${ex.tempo}` : ""}
                {ex.grupo ? ` · superserie ${ex.grupo}` : ""}
              </p>
              <RestLine ex={ex} />
              {ex.seriePesada && <p className="text-[11px] text-white/50">{HEAVY_SET_GUIDE}</p>}
              {ex.descendente && <p className="text-[11px] text-white/50">Descendente: {ex.descendente.descripcion}</p>}
              {ex.nota && <p className="text-[11px] text-white/45 italic">{ex.nota}</p>}
            </GlassCard>
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-2.5">
        <h2 className="text-base font-semibold text-white/85 flex items-center gap-1.5">
          <Info size={15} /> Notas
        </h2>
        {plan.notas.map((n) => (
          <p key={n} className="text-xs text-white/60 leading-relaxed">
            {n}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-base font-semibold text-white/85">Fuentes</h2>
        {plan.fuentes.map((f) => (
          <a
            key={f.url}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
          >
            <ExternalLink size={12} className="mt-0.5 shrink-0" />
            <span>
              {f.titulo} · {f.tipo === "directa" ? "directa" : "secundaria"}
            </span>
          </a>
        ))}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent">
        {copied ? (
          <button
            onClick={() => router.push(`/gym/entrenamiento/planificaciones/${copied}`)}
            className="w-full rounded-full py-3 text-sm font-semibold text-white bg-white/[0.14] glass-specular-ring cursor-pointer"
          >
            Abrir mi copia
          </button>
        ) : (
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white bg-white/[0.14] hover:bg-white/[0.2] glass-specular-ring cursor-pointer transition-colors"
          >
            <Copy size={15} /> Copiar a mis rutinas
          </button>
        )}
      </div>
    </div>
  );
}
