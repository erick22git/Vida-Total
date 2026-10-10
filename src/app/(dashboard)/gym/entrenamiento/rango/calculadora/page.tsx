"use client";

/**
 * Calculadora de rango (botón «+» de la pantalla de Rango): ¿qué rango tendría con este peso y estas repeticiones?
 * Mismo patrón que crear hábito / configurar alimento: X y «n / total» arriba, título grande, «Continuar» abajo.
 * Pasos: ejercicio -> peso (solo si el ejercicio se mide en kg) -> repeticiones -> (sexo y peso corporal, solo si faltan)
 * -> resultado. NO guarda ninguna marca: es una simulación. Solo si faltan sexo o peso corporal los guarda en el perfil
 * (con `updateGymProfileFields`, que mergea; nunca `saveGymProfile`), porque el rango los necesita.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Search, X, AlertTriangle, Check } from "lucide-react";
import { RankIcon } from "@/components/gym/rank-icon";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { useBodyInfo } from "@/lib/gym/use-rank";
import { useGymStore } from "@/lib/store/gymStore";
import { MUSCLE_LABEL } from "@/lib/gym/rank-config";
import { REPS_CAP, estimate1RM, rankFromValue, standardForExercise, weightForOneRepMax } from "@/lib/gym/rank-engine";
import type { Sex } from "@/lib/gym/rank-standards";
import { MONO_FONT } from "@/lib/ui/mono-font";

type Step = "ejercicio" | "peso" | "reps" | "cuerpo" | "resultado";

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
const Title = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-[28px] leading-[1.05] font-black tracking-tight uppercase">{children}</h1>
);

function NumberField({ label, value, onChange, unit, placeholder }: { label: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-white/40">
        {label} <span className="text-white/25">({unit})</span>
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        type="number"
        autoFocus
        className="w-full bg-transparent outline-none text-white text-3xl font-semibold placeholder:text-white/20 border-b border-white/15 focus:border-white/50 transition-colors py-1.5"
      />
    </div>
  );
}

export default function CalculadoraRangoPage() {
  const router = useRouter();
  const allExercises = useAllExercises();
  const { body, missing } = useBodyInfo();
  const gymProfile = useGymStore((s) => s.gymProfile);
  const updateGymProfileFields = useGymStore((s) => s.updateGymProfileFields);
  const rankOverrides = useGymStore((s) => s.rankOverrides);
  const setRankOverride = useGymStore((s) => s.setRankOverride);
  const clearRankOverride = useGymStore((s) => s.clearRankOverride);

  const [query, setQuery] = useState("");
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [peso, setPeso] = useState("");
  const [reps, setReps] = useState("");
  const [sexoLocal, setSexoLocal] = useState<Sex | null>(null);
  const [pesoCorp, setPesoCorp] = useState("");
  const [step, setStep] = useState(0);

  const rankable = useMemo(() => allExercises.filter((e) => standardForExercise(e.id)), [allExercises]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rankable.filter((e) => e.nombre.toLowerCase().includes(q)) : rankable;
  }, [rankable, query]);

  const exercise = exerciseId ? allExercises.find((e) => e.id === exerciseId) : undefined;
  const resolved = exerciseId ? standardForExercise(exerciseId) : null;
  const isKg = resolved?.standard.kind === "kg";
  const needBody = missing.length > 0;

  const steps = useMemo<Step[]>(() => ["ejercicio", ...(isKg || !resolved ? (["peso"] as Step[]) : []), "reps", ...(needBody ? (["cuerpo"] as Step[]) : []), "resultado"], [isKg, resolved, needBody]);
  const kind = steps[step];

  const pesoNum = parseFloat(peso);
  const repsNum = parseFloat(reps);
  const pesoCorpNum = parseFloat(pesoCorp);
  const bodyUsed = useMemo(
    () => body ?? (sexoLocal && pesoCorpNum > 0 ? { sexo: sexoLocal, pesoKg: pesoCorpNum } : null),
    [body, sexoLocal, pesoCorpNum],
  );

  const valid =
    kind === "ejercicio" ? !!exerciseId :
    kind === "peso" ? pesoNum > 0 :
    kind === "reps" ? repsNum >= 1 :
    kind === "cuerpo" ? (gymProfile?.sexo || sexoLocal) && (gymProfile?.pesoKg || parseFloat(pesoCorp) > 0) :
    true;

  const result = useMemo(() => {
    if (!resolved || !bodyUsed || !(repsNum >= 1)) return null;
    let value: number;
    let capped = false;
    if (resolved.standard.kind === "kg") {
      if (!(pesoNum > 0)) return null;
      const e = estimate1RM(pesoNum, repsNum);
      value = e.value;
      capped = e.capped;
    } else value = repsNum;
    return { value, capped, ...rankFromValue(resolved, value, bodyUsed) };
  }, [resolved, bodyUsed, pesoNum, repsNum]);

  function next() {
    if (!valid) return;
    if (kind === "cuerpo") {
      // Solo se completa lo que faltaba; lo que ya estaba en el perfil no se toca.
      const patch: { sexo?: Sex; pesoKg?: number } = {};
      if (!gymProfile?.sexo && sexoLocal) patch.sexo = sexoLocal;
      if (!(gymProfile?.pesoKg && gymProfile.pesoKg > 0) && parseFloat(pesoCorp) > 0) patch.pesoKg = parseFloat(pesoCorp);
      if (Object.keys(patch).length) updateGymProfileFields(patch);
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col app-bg text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={() => router.back()} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/80">
          <X size={22} />
        </button>
        <span className="text-sm text-white/50 tabular-nums" style={MONO_FONT}>
          {step + 1} / {steps.length}
        </span>
        {step > 0 && kind !== "resultado" ? (
          <button onClick={() => setStep((s) => s - 1)} aria-label="Atrás" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/50">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <span className="w-9 h-9" />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-5 overflow-y-auto no-scrollbar">
        {kind === "ejercicio" && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <Title>
              ¿Qué ejercicio
              <br />
              probamos?
            </Title>
            <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5" style={{ background: "#0d0d0d" }}>
              <Search size={16} className="text-white/40" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ejercicio…" className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/30" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-1.5">
              {filtered.map((e) => {
                const r = standardForExercise(e.id)!;
                const sel = e.id === exerciseId;
                return (
                  <button
                    key={e.id}
                    onClick={() => setExerciseId(e.id)}
                    className="text-left rounded-2xl px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors"
                    style={{ background: sel ? "#fff" : "#0d0d0d", color: sel ? "#000" : "#fff" }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{e.nombre}</span>
                      <span className="block text-xs" style={{ color: sel ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.45)" }}>
                        {MUSCLE_LABEL[e.categoria] ?? e.categoria}
                        {r.estimated ? " · estimado" : ""}
                        {r.standard.kind === "reps" ? " · peso corporal" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-white/40 text-center py-8">No hay ejercicios con ese nombre que se puedan calificar.</p>}
            </div>
          </div>
        )}

        {kind === "peso" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>
              Peso
              <br />
              levantado
            </Title>
            <p className="text-xs text-white/45">
              {exercise?.nombre}. En mancuernas, el peso de UNA mancuerna. Incluye el peso de la barra.
            </p>
            <NumberField label="Peso" value={peso} onChange={setPeso} unit="kg" placeholder="60" />
          </div>
        )}

        {kind === "reps" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>Repeticiones</Title>
            <p className="text-xs text-white/45">{isKg ? "Las que lograste con ese peso en una serie, sin parar." : "Las máximas que lograste en una sola serie."}</p>
            <NumberField label="Repeticiones" value={reps} onChange={setReps} unit="reps" placeholder="8" />
            {repsNum > REPS_CAP && isKg && (
              <div className="flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs" style={{ background: "#f59e0b1f", color: "#fbbf24" }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Con más de {REPS_CAP} repeticiones la estimación sobreestima tu fuerza. Se calcula como si fueran {REPS_CAP}; para un número más fiable usa una serie de 5 a 10.
                </span>
              </div>
            )}
          </div>
        )}

        {kind === "cuerpo" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>
              Tu sexo y
              <br />
              peso corporal
            </Title>
            <p className="text-xs text-white/45">El rango compara lo que levantas con tu peso corporal y tu sexo. Se guardan en tu perfil.</p>
            {!gymProfile?.sexo && (
              <div className="flex gap-2">
                {(["hombre", "mujer"] as Sex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSexoLocal(s)}
                    className="flex-1 rounded-2xl py-3.5 text-sm font-semibold cursor-pointer transition-colors capitalize"
                    style={{ background: sexoLocal === s ? "#fff" : "#0d0d0d", color: sexoLocal === s ? "#000" : "#fff" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {!(gymProfile?.pesoKg && gymProfile.pesoKg > 0) && <NumberField label="Peso corporal" value={pesoCorp} onChange={setPesoCorp} unit="kg" placeholder="75" />}
          </div>
        )}

        {kind === "resultado" && (
          <div className="flex-1 flex flex-col gap-4">
            <Title>Tu rango</Title>
            {result && exercise ? (
              <>
                <div className="rounded-3xl p-5 flex items-center gap-4" style={{ background: "#0d0d0d" }}>
                  <RankIcon tierKey={result.rank.tier.key} level={result.rank.level} size={84} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.1em] text-white/40 truncate" style={MONO_FONT}>
                      {exercise.nombre}
                    </span>
                    <span className="text-[24px] font-black leading-none tracking-wide" style={{ color: result.rank.tier.color }}>
                      {result.rank.label}
                    </span>
                    <span className="text-xs text-white/50">
                      Más fuerte que el {Math.round(result.rank.percentile)} % de quienes entrenan{resolved?.estimated ? " · estimado" : ""}
                    </span>
                  </div>
                </div>
                <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: "#0d0d0d" }}>
                  {isKg ? (
                    <Row label="1RM estimado (Epley)" value={`${fmt(result.value)} kg`} />
                  ) : (
                    <Row label="Repeticiones" value={`${fmt(result.value)}`} />
                  )}
                  {result.next ? (
                    <>
                      <Row label="Siguiente nivel" value={result.next.label} />
                      <Row
                        label="Te falta"
                        value={isKg ? `${fmt(result.next.missing)} kg de 1RM` : `${Math.max(1, Math.ceil(result.next.missing))} repeticiones más`}
                      />
                      {isKg && <Row label="Equivale a" value={`≈ ${fmt(weightForOneRepMax(result.next.value, 5))} kg × 5 reps`} />}
                    </>
                  ) : (
                    <Row label="Siguiente nivel" value="Rango máximo" />
                  )}
                </div>
                {result.capped && (
                  <p className="text-[11px] text-amber-300/80">Tu serie pasa de {REPS_CAP} repeticiones: la estimación puede quedar alta.</p>
                )}
                {resolved?.estimated && (
                  <p className="text-[11px] text-white/40">Este ejercicio no tiene tabla propia: se estima a partir de «{resolved.standard.name}». Es orientativo.</p>
                )}
                <p className="text-[11px] text-white/35">
                  Esto es una simulación: no se guarda ninguna marca. Si tu rango real de este ejercicio quedó mal (por
                  ejemplo, anotaste un peso equivocado en algún entrenamiento), puedes reemplazarlo por este cálculo sin
                  borrar ni tocar nada de tu historial — es opcional, solo pasa si lo tocas abajo.
                </p>
                {exerciseId && rankOverrides[exerciseId] ? (
                  <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: "#22c55e1a", border: "1px solid #22c55e44" }}>
                    <span className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                      <Check size={14} /> Ya reemplazaste el rango con este cálculo
                    </span>
                    <button
                      onClick={() => clearRankOverride(exerciseId)}
                      className="text-xs font-semibold text-white/50 hover:text-white cursor-pointer shrink-0"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      exerciseId &&
                      setRankOverride(exerciseId, { peso: isKg ? pesoNum : 0, reps: repsNum, value: result.value, setAt: Date.now() })
                    }
                    className="w-full rounded-full py-3 text-sm font-semibold cursor-pointer border border-white/20 text-white/85 hover:bg-white/5 transition-colors"
                  >
                    Reemplazar en el rango
                  </button>
                )}
                <button onClick={() => router.back()} className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black">
                  Listo
                </button>
                <button onClick={() => setStep(0)} className="w-full py-2 text-xs font-medium cursor-pointer text-white/50">
                  Probar otro ejercicio
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-white/55">Faltan datos para calcular tu rango.</p>
                <Link href="/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/rango/calculadora" className="rounded-full py-3 text-sm font-semibold text-center bg-white text-black">
                  Completar mi perfil
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {kind !== "resultado" && (
        <div className="px-6 pb-[max(env(safe-area-inset-bottom),18px)] shrink-0">
          <button
            onClick={next}
            disabled={!valid}
            className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-30 bg-white text-black"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-white/50 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}
