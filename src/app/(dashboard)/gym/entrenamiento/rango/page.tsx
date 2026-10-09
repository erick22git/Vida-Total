"use client";

/**
 * Rango — vista 3 del inicio de Entrenamiento (hoy / año / rango). Pantalla de ALTO FIJO, sin scroll vertical: 8 páginas
 * (cuerpo completo + 7 grupos) con el cuerpo 3D en el centro, pintado con el color del rango de cada músculo.
 *
 * Gestos: sobre el cuerpo, arrastrar lo gira y tocar una región la elige (un segundo toque abre su lista de ejercicios);
 * fuera del cuerpo, deslizar a los lados cambia de página y deslizar hacia abajo vuelve a la vista de año. También se
 * puede tocar un ícono de abajo o usar las flechas del teclado. Sin datos de sexo o peso no se calcula nada (gris).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, RotateCw, SlidersHorizontal } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { RankBody3D, type RankBodyHandle } from "@/components/gym/rank-body-3d";
import { MuscleGroupIcon } from "@/components/gym/muscle-group-icon";
import { RankIcon } from "@/components/gym/rank-icon";
import { useRankProfile } from "@/lib/gym/use-rank";
import { MUSCLE_LABEL, NO_RANK_COLOR, RANK_GROUPS } from "@/lib/gym/rank-config";
import { REPS_CAP, type AggregateRank } from "@/lib/gym/rank-engine";
import type { RegionStyle } from "@/lib/3d/rank-body";
import { MONO_FONT } from "@/lib/ui/mono-font";

const SWIPE_X = 60;
const SWIPE_Y = 90;
const GOLD = "#f5a800";
const ALL_MUSCLES = Object.keys(MUSCLE_LABEL);

/** Hacia dónde mira el cuerpo en cada página (0 = de frente, π = de espaldas). */
const PAGE_YAW: Record<string, number> = {
  cuerpo: 0,
  brazos: 0.45,
  piernas: 0,
  espalda: Math.PI,
  pecho: 0,
  gluteos: Math.PI,
  abdomen: 0,
  hombros: 0.35,
};

export default function RangoPage() {
  const router = useRouter();
  const { profile, missing } = useRankProfile();
  const bodyRef = useRef<RankBodyHandle>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const group = RANK_GROUPS[page];
  const focusRegions = page === 0 ? null : group.categories;

  const rankOf = useCallback(
    (g: (typeof RANK_GROUPS)[number]): AggregateRank | null => (g.key === "cuerpo" ? profile?.general ?? null : profile?.byGroup[g.key] ?? null),
    [profile],
  );
  const pageRank = rankOf(group);

  const styles = useMemo(() => {
    const out: Record<string, RegionStyle> = {};
    for (const m of ALL_MUSCLES) {
      const rank = profile?.byMuscle[m]?.rank ?? null;
      out[m] = { color: rank ? rank.tier.color : null, tier: rank ? rank.tier.key : null, dim: focusRegions ? !focusRegions.includes(m) : false };
    }
    return out;
  }, [profile, focusRegions]);

  const goTo = useCallback((next: number) => {
    setPage((p) => {
      const n = Math.max(0, Math.min(RANK_GROUPS.length - 1, next));
      if (n !== p) setSelected(null);
      return n;
    });
  }, []);

  // flechas del teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(page + 1);
      else if (e.key === "ArrowLeft") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo]);

  const onPick = useCallback(
    (region: string | null) => {
      setSelected((cur) => {
        if (region && region === cur) {
          router.push(`/gym/entrenamiento/rango/${region}`);
          return cur;
        }
        return region;
      });
    },
    [router],
  );

  const sel = selected ? profile?.byMuscle[selected] ?? null : null;

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      onPointerDown={(e) => {
        start.current = (e.target as HTMLElement).closest("[data-rank-canvas]") ? null : { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const st = start.current;
        start.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (Math.abs(dx) > SWIPE_X && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(page + (dx < 0 ? 1 : -1));
        else if (dy > SWIPE_Y && Math.abs(dy) > Math.abs(dx) * 1.4) router.push("/gym/entrenamiento?view=1");
      }}
      onPointerCancel={() => (start.current = null)}
    >
      {/* Cabecera: volver, título, ajustes y los 3 puntos de las vistas de Entrenamiento */}
      <header className="shrink-0 px-5 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="flex items-center h-11">
          <Link
            href="/gym/entrenamiento"
            aria-label="Volver a Entrenamiento"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center bg-black/70 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Link>
        </div>
        <div className="flex items-center justify-between h-9">
          <Link href="/gym/entrenamiento/rango/calculadora" aria-label="Calculadora de rango" className="w-10 h-9 -ml-1 flex items-center justify-start cursor-pointer">
            <Plus size={28} strokeWidth={2.4} />
          </Link>
          <h1 className="text-[18px] uppercase tracking-[0.16em]" style={MONO_FONT}>
            Rango
          </h1>
          <button onClick={() => setSettingsOpen(true)} aria-label="Ajustes de rango" className="w-10 h-9 flex items-center justify-end cursor-pointer">
            <SlidersHorizontal size={24} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2.5 h-5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 2 ? "#fff" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>

        {/* Etiqueta del rango de la página: ícono + texto (no depende solo del color) */}
        <div className="flex flex-col items-center gap-0.5 pt-1.5 h-[64px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-center gap-0.5"
            >
              <div className="flex items-center gap-2 h-8">
                <RankIcon tierKey={pageRank?.rank?.tier.key ?? null} level={pageRank?.rank?.level ?? null} size={30} />
                <span className="text-[17px] tracking-[0.12em]" style={{ ...MONO_FONT, color: pageRank?.rank ? pageRank.rank.tier.color : "rgba(255,255,255,0.45)" }}>
                  {pageRank?.rank ? pageRank.rank.label : "SIN RANGO"}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/40" style={MONO_FONT}>
                {group.label}
                {pageRank && pageRank.total > 0 ? ` · ${pageRank.rated}/${pageRank.total} ${page === 0 ? "grupos" : "músculos"} con rango` : ""}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </header>

      {/* Escenario: el cuerpo ocupa casi todo el alto restante */}
      <main className="relative flex-1 min-h-0">
        {webglFailed ? (
          <GroupList rankOf={rankOf} onOpen={(key) => router.push(`/gym/entrenamiento/rango/${key}`)} />
        ) : (
          <div data-rank-canvas className="absolute inset-0">
            <RankBody3D
              ref={bodyRef}
              styles={styles}
              selected={selected}
              focusRegions={focusRegions}
              yaw={PAGE_YAW[group.key] ?? 0}
              onPick={onPick}
              onError={() => setWebglFailed(true)}
              className="w-full h-full"
            />
          </div>
        )}

        {!webglFailed && (
          <button
            onClick={() => bodyRef.current?.rotateBy(Math.PI)}
            aria-label="Dar la vuelta al cuerpo (frente / espalda)"
            className="absolute right-4 top-2 w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.07] text-white/70 active:scale-95 transition-transform cursor-pointer"
          >
            <RotateCw size={18} />
          </button>
        )}

        {/* Falta sexo o peso: no se calcula nada hasta completarlos */}
        {missing.length > 0 && !webglFailed && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl p-5 flex flex-col items-center gap-3 text-center bg-black/75 backdrop-blur-md border border-white/10">
            <p className="text-sm font-semibold">Falta tu {missing.join(" y tu ")}</p>
            <p className="text-xs text-white/55">Tu rango compara lo que levantas con tu peso corporal y tu sexo.</p>
            <Link
              href="/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/rango"
              className="rounded-full px-5 py-2.5 text-sm font-semibold bg-white text-black"
            >
              Completar mi perfil
            </Link>
          </div>
        )}

        {/* Músculo elegido */}
        <AnimatePresence>
          {selected && !webglFailed && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              className="absolute inset-x-5 bottom-3 rounded-3xl p-3.5 flex items-center gap-3 bg-black/80 backdrop-blur-md border border-white/10"
            >
              <RankIcon tierKey={sel?.rank?.tier.key ?? null} level={sel?.rank?.level ?? null} size={46} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{MUSCLE_LABEL[selected] ?? selected}</p>
                <p className="text-[13px] tracking-[0.1em]" style={{ ...MONO_FONT, color: sel?.rank ? sel.rank.tier.color : NO_RANK_COLOR }}>
                  {sel?.rank ? sel.rank.label : "SIN RANGO"}
                </p>
                <p className="text-[10px] text-white/40">{sel ? `${sel.rated}/${sel.total} ejercicios con rango` : ""}</p>
              </div>
              <Link
                href={`/gym/entrenamiento/rango/${selected}`}
                className="shrink-0 flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-semibold bg-white text-black"
              >
                Ver ejercicios <ChevronRight size={14} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Pie: puntos, contador, barra de avance e íconos de los 8 grupos */}
      <footer className="shrink-0 pb-[max(env(safe-area-inset-bottom),14px)] pt-1">
        <div className="flex items-center justify-center gap-2.5 h-4" aria-hidden>
          {RANK_GROUPS.map((g, i) => (
            <span key={g.key} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ background: i === page ? "#fff" : "rgba(255,255,255,0.28)" }} />
          ))}
        </div>
        <p className="text-center text-[15px] tabular-nums tracking-[0.14em] text-white/80 pt-1" style={MONO_FONT}>
          {page + 1} / {RANK_GROUPS.length}
        </p>
        <div className="mx-auto mt-2 h-[5px] w-[min(320px,60%)] rounded-full bg-white/[0.14] overflow-hidden" aria-hidden>
          <motion.div
            className="h-full rounded-full"
            style={{ background: GOLD, width: `${100 / RANK_GROUPS.length}%` }}
            animate={{ x: `${page * 100}%` }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          />
        </div>
        <nav className="flex items-center justify-between px-5 pt-3" aria-label="Grupos musculares">
          {RANK_GROUPS.map((g, i) => (
            <button
              key={g.key}
              onClick={() => goTo(i)}
              aria-label={g.label}
              aria-current={i === page}
              className="w-10 h-10 flex items-center justify-center cursor-pointer transition-all active:scale-90"
              style={{ color: i === page ? "#fff" : "rgba(255,255,255,0.45)", transform: i === page ? "scale(1.12)" : undefined }}
            >
              <MuscleGroupIcon group={g.key} size={26} />
            </button>
          ))}
        </nav>
      </footer>

      <ExpandSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Ajustes de rango">
        <div className="flex flex-col gap-3 text-sm">
          <Link
            href="/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/rango"
            className="rounded-2xl px-4 py-3 bg-white/[0.07] flex items-center justify-between"
          >
            <span>Perfil de entrenamiento (sexo, peso…)</span>
            <ChevronRight size={16} className="text-white/40" />
          </Link>
          <div className="rounded-2xl px-4 py-3 bg-white/[0.04] text-xs text-white/60 leading-relaxed flex flex-col gap-2">
            <p>
              <b className="text-white/80">Cómo se calcula:</b> con tu mejor serie de cada ejercicio (series de calentamiento no cuentan) se
              estima tu 1RM, se compara con estándares de fuerza según tu sexo y peso corporal y sale un rango con nivel I, II o III.
            </p>
            <p>
              Para el cálculo se usan como máximo {REPS_CAP} repeticiones por serie: con más, la estimación sobreestima. Los ejercicios sin tabla
              propia se marcan «estimado».
            </p>
            <p>Cada músculo promedia sus 3 mejores ejercicios; cada grupo, sus músculos con datos; el general, los grupos con datos.</p>
            <p>El cuerpo 3D es el modelo masculino (el femenino está pendiente).</p>
          </div>
        </div>
      </ExpandSheet>
    </div>
  );
}

/** Alternativa si el 3D no se puede mostrar: los 7 grupos como lista. */
function GroupList({ rankOf, onOpen }: { rankOf: (g: (typeof RANK_GROUPS)[number]) => AggregateRank | null; onOpen: (key: string) => void }) {
  return (
    <div className="absolute inset-0 px-5 py-2 flex flex-col gap-1.5 justify-center">
      <p className="text-center text-[11px] text-white/40 pb-1">No se pudo mostrar el cuerpo 3D en este dispositivo.</p>
      {RANK_GROUPS.slice(1).map((g) => {
        const r = rankOf(g)?.rank ?? null;
        return (
          <button
            key={g.key}
            onClick={() => onOpen(g.key)}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2 bg-white/[0.06] text-left cursor-pointer"
          >
            <MuscleGroupIcon group={g.key} size={22} className="text-white/70" />
            <span className="flex-1 text-sm">{g.label}</span>
            <RankIcon tierKey={r?.tier.key ?? null} level={r?.level ?? null} size={26} />
            <span className="text-[12px] tracking-[0.08em] w-24 text-right" style={{ ...MONO_FONT, color: r ? r.tier.color : "rgba(255,255,255,0.4)" }}>
              {r ? r.label : "SIN RANGO"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
