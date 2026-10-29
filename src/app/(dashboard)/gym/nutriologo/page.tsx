"use client";

/**
 * Nutriólogo virtual: 4ta pantalla de la cadena de swipe vertical de Calorías (comida → nutrientes →
 * año → Nutriólogo), ruta propia `/gym/nutriologo` — mismo criterio que Rango/Coach en Entrenamiento
 * (cada vista de la cadena que no es un simple panel vive en su propia página en vez de inflar un solo
 * archivo). Se llega deslizando hacia abajo desde la vista de racha (año) de Calorías, o con el botón de
 * volver de acá, que regresa directo a esa vista (`/gym/calorias?view=2`). Mismo patrón visual que el
 * Coach de Entrenamiento: 5 tarjetas con swipe horizontal (`swipe-carousel.tsx`), todo leyendo de los
 * motores puros `nutrition-care-engine.ts` y `symptom-correlation.ts` — esta pantalla solo muestra y
 * arma Aceptar/Descartar, nunca decide sola.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Check, X as XIcon, ChevronDown, Download, RefreshCw } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import { useTargetProfile, useNutrientTargets } from "@/lib/nutrition/use-targets";
import { calcCalorieGoal, OBJETIVO_LABELS } from "@/lib/gym/calorie-calc";
import { evaluateAdaptiveCalories } from "@/lib/gym/calorie-adaptive";
import {
  evaluate,
  diagnose,
  buildIntervention,
  calorieGoalIntervention,
  RECOMMENDED_WINDOW_DAYS,
  type NutritionDiagnosis,
} from "@/lib/nutrition/nutrition-care-engine";
import { dailyMicronutrientTotals, topFoodsForNutrient } from "@/lib/nutrition/nutriologo-data";
import { suggestMealPlan, formatMealPlanAsText } from "@/lib/nutrition/meal-plan-suggester";
import { correlateAllSymptoms, MIN_SYMPTOM_OCCURRENCES } from "@/lib/nutrition/symptom-correlation";
import { estimateSessionCalories } from "@/lib/gym/exercise-calorie-burn";
import { dailyActivityTotals, weeklyActivityTotals, monthlyActivityTotals } from "@/lib/gym/activity-aggregation";
import { evaluatePlanAdherence, type DayStatus } from "@/lib/nutrition/plan-adherence";
import { WalkTracker } from "@/components/gym/walk-tracker";
import { Mascot } from "@/components/agente/mascot";
import { useSwipeCarousel, SwipeCarouselStage, SwipeCarouselDots } from "@/components/shared/swipe-carousel";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { SymptomKind } from "@/lib/types";

const NUTRIOLOGO_ACCENT = "#5ac8fa";
const DISCLAIMER_MEDICO =
  "Esto no reemplaza una consulta médica ni análisis de laboratorio. Ante síntomas persistentes, consultá a un profesional de salud.";
const DISCLAIMER_SINTOMAS =
  "Esto es un patrón detectado en tu propio registro, no un diagnóstico de alergia o intolerancia. Para confirmar una intolerancia o alergia real hace falta un profesional y, si corresponde, pruebas clínicas.";

const SYMPTOM_LABELS: Record<SymptomKind, string> = {
  hinchazon: "Hinchazón",
  dolor_estomago: "Dolor de estómago",
  fatiga: "Fatiga",
  dolor_cabeza: "Dolor de cabeza",
  otro: "Otro",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] uppercase tracking-[0.12em] text-white/50" style={MONO_FONT}>
      {children}
    </h2>
  );
}

const VOLVER_A_CALORIAS = "/gym/calorias?view=2";

export default function NutriologoPage() {
  const router = useRouter();
  const [card, setCard] = useState(0);
  const CARD_COUNT = 8;
  const { direction, goTo, onDragEnd } = useSwipeCarousel({ index: card, length: CARD_COUNT, onIndexChange: setCard });

  // Última pantalla de la cadena de Calorías: solo se vuelve hacia abajo (a la racha/año), no hay nada
  // después. Mismo mecanismo pointerDown/pointerUp que Coach en Entrenamiento. Tarjetas como
  // "Sugerencias de intervención" y "Diagnósticos" tienen su propio scroll vertical interno
  // (`overflow-y-auto` en `SwipeCarouselStage`): si el gesto empieza a mitad de esa lista (scrollTop > 0),
  // un arrastre hacia abajo para volver a subir en la lista NO debe disparar también la salida a
  // Calorías — solo cuenta como "volver" cuando el gesto arranca con la tarjeta ya en el tope.
  const startY = useRef<number | null>(null);
  const startScrollTop = useRef(0);
  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    const scrollEl = (e.target as HTMLElement).closest(".overflow-y-auto") as HTMLElement | null;
    startScrollTop.current = scrollEl?.scrollTop ?? 0;
  }
  function onPointerUp(e: React.PointerEvent) {
    const dy = e.clientY - (startY.current ?? e.clientY);
    startY.current = null;
    if (dy > 70 && startScrollTop.current <= 0) router.push(VOLVER_A_CALORIAS);
  }

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <header className="shrink-0 px-5 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="flex items-center h-11">
          <Link
            href={VOLVER_A_CALORIAS}
            aria-label="Volver a Calorías"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center bg-black/70 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Link>
          <h1 className="flex-1 text-center text-[18px] uppercase tracking-[0.16em]" style={MONO_FONT}>
            Nutriólogo
          </h1>
          <span className="w-10 h-10" />
        </div>
        <div className="flex items-center justify-center gap-2.5 h-5" aria-hidden>
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === card ? "#fff" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <SwipeCarouselStage itemKey={card} direction={direction} length={CARD_COUNT} onDragEnd={onDragEnd} className="absolute inset-0 overflow-y-auto no-scrollbar px-5 pb-8 pt-2">
          {card === 0 && <ResumenCard />}
          {card === 1 && <CumplimientoCard />}
          {card === 2 && <DiagnosticosCard />}
          {card === 3 && <IntervencionesCard />}
          {card === 4 && <SintomasCard />}
          {card === 5 && <AgenteCard />}
          {card === 6 && <ActividadCard />}
          {card === 7 && <PlanComidasCard />}
        </SwipeCarouselStage>
      </main>

      <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        <SwipeCarouselDots length={CARD_COUNT} index={card} onSelect={goTo} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datos compartidos por varias tarjetas
// ---------------------------------------------------------------------------
function useEvaluation() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const customFoods = useGymStore((s) => s.customFoods);
  const perfilMetas = useTargetProfile();
  const targets = useNutrientTargets();

  const allFoods = useMemo(() => mergeFoods(customFoods), [customFoods]);

  const evaluation = useMemo(
    () => evaluate({ loggedFoods, weightEntries, profile: perfilMetas }),
    [loggedFoods, weightEntries, perfilMetas],
  );

  const microDaily = useMemo(
    () => dailyMicronutrientTotals(loggedFoods, allFoods, RECOMMENDED_WINDOW_DAYS),
    [loggedFoods, allFoods],
  );

  const diagnoses = useMemo(() => diagnose(evaluation, targets, microDaily), [evaluation, targets, microDaily]);

  return { evaluation, diagnoses, allFoods, loggedFoods };
}

// ---------------------------------------------------------------------------
// Tarjeta 1: Resumen de evaluación
// ---------------------------------------------------------------------------
function ResumenCard() {
  const { evaluation } = useEvaluation();
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const pct = Math.round(evaluation.adherenciaRegistro * 100);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Resumen de evaluación</SectionTitle>
      <div className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Ventana analizada</span>
          <span className="text-sm font-semibold tabular-nums">{evaluation.windowDays} días</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Días con registro</span>
          <span className="text-sm font-semibold tabular-nums">
            {evaluation.loggedDays} de {evaluation.windowDays} ({pct}%)
          </span>
        </div>
        {evaluation.pesoTendenciaKg !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Peso de tendencia</span>
            <span className="text-sm font-semibold tabular-nums">{evaluation.pesoTendenciaKg.toFixed(1)} kg</span>
          </div>
        )}
        {evaluation.loggedDays > 0 && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
            <span className="text-[11px] uppercase tracking-wide text-white/40 pt-2">Promedio por día registrado</span>
            {([["calorias", "Calorías", calorieGoal], ["proteina", "Proteína", proteinGoal], ["carbos", "Carbohidratos", carbsGoal], ["grasas", "Grasas", fatGoal]] as const).map(([id, label, goal]) => {
              const n = evaluation.nutrientes[id];
              const avg = Math.round(n.promedioDiario);
              return (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{label}</span>
                  <span className="font-semibold tabular-nums">
                    {avg} {n.unidad}
                    {goal > 0 && <span className="text-white/45 font-normal"> / {goal} ({Math.round((avg / goal) * 100)} %)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {evaluation.datosSuficientes && evaluation.loggedDays > 0 && (
          <p className="text-xs text-emerald-200/80">
            Datos suficientes: {evaluation.loggedDays} de {evaluation.windowDays} días con registro. Los diagnósticos y el cumplimiento del plan ya se calculan con ellos.
          </p>
        )}
        {!evaluation.datosSuficientes && (
          <p className="text-xs text-amber-200/80">
            Todavía no hay suficientes días de registro consistente para diagnosticar patrones — seguí registrando
            comidas casi todos los días.
          </p>
        )}
      </div>
      <p className="text-xs text-white/35">{DISCLAIMER_MEDICO}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta: Cumplimiento del plan calórico (desde que rige la meta actual)
// ---------------------------------------------------------------------------
const STATUS_COLOR: Record<DayStatus, string> = { cumple: "#22c55e", cerca: "#eab308", sobre: "#ef4444", bajo: "#60a5fa" };
const STATUS_LABEL: Record<DayStatus, string> = { cumple: "En meta (±10 %)", cerca: "Cerca (±20 %)", sobre: "Te pasaste", bajo: "Muy por debajo" };

function CumplimientoCard() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const calorieGoalHistory = useGymStore((s) => s.calorieGoalHistory);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const measurements = useGymStore((s) => s.bodyMeasurementHistory);
  const objetivo = useGymStore((s) => s.gymProfile?.objetivoCalorico);

  const r = useMemo(
    () => evaluatePlanAdherence({ loggedFoods, calorieGoal, goalHistory: calorieGoalHistory ?? [], weightEntries, measurements, objetivo }),
    [loggedFoods, calorieGoal, calorieGoalHistory, weightEntries, measurements, objetivo],
  );
  const maxPct = Math.max(1.3, ...r.days.map((d) => d.pct));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Cumplimiento del plan</SectionTitle>
      <div className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Meta vigente</span>
          <span className="font-semibold tabular-nums">{r.goalKcal} kcal</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Desde</span>
          <span className="font-semibold tabular-nums">
            {r.planStartKey} ({r.daysSincePlan} d){r.startIsEstimated ? " · aprox." : ""}
          </span>
        </div>
        <p className="text-sm font-semibold leading-snug">{r.verdictText}</p>

        {r.days.length > 0 && (
          <>
            <div className="flex items-end gap-[3px] h-20 pt-1" aria-label="Calorías por día frente a la meta">
              {r.days.map((d) => (
                <div key={d.dateKey} className="flex-1 min-w-[4px] rounded-t-sm" title={`${d.dateKey}: ${d.kcal} kcal`} style={{ height: `${Math.max(6, (d.pct / maxPct) * 100)}%`, background: STATUS_COLOR[d.status] }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(STATUS_LABEL) as DayStatus[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                  {STATUS_LABEL[k]}: {r.counts[k]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10">
        <span className="text-[11px] uppercase tracking-wide text-white/40">¿Responde tu peso?</span>
        {r.weight.deltaKg !== null ? (
          <p className="text-sm">
            Primera semana del plan {r.weight.startKg} kg → última semana {r.weight.nowKg} kg ({r.weight.deltaKg > 0 ? "+" : ""}
            {r.weight.deltaKg} kg).
            {r.weight.movedAsExpected === true && " Va en la dirección de tu objetivo."}
            {r.weight.movedAsExpected === false && " Todavía no se mueve como se espera para tu objetivo."}
          </p>
        ) : (
          <p className="text-sm text-white/55">Hacen falta al menos 8 días de plan y 2 pesajes para ver la tendencia.</p>
        )}
        {r.adjustment ? (
          <p className="text-sm text-amber-200/90">{r.adjustment.text}</p>
        ) : (
          r.weight.movedAsExpected === false && <p className="text-xs text-white/50">Primero hay que cumplir la meta la mayoría de los días antes de tocarla.</p>
        )}
      </div>

      <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10">
        <span className="text-[11px] uppercase tracking-wide text-white/40">Cuándo volver a pesarte y medirte</span>
        {r.schedule.lines.map((l) => (
          <p key={l} className="text-sm text-white/80 leading-snug">• {l}</p>
        ))}
        <p className="text-[10px] text-white/35 pt-1">
          Basado en prácticas de seguimiento (Steinberg 2015; Helms 2014; Hall 2011): el peso diario fluctúa por agua y
          sodio, la tendencia semanal es la que vale y un cambio de calorías tarda ~2 semanas en reflejarse.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 2: Diagnósticos nutricionales (PES), con "¿Por qué?" expandible
// ---------------------------------------------------------------------------
function DiagnosticosCard() {
  const { diagnoses, evaluation } = useEvaluation();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!evaluation.datosSuficientes) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <SectionTitle>Diagnósticos nutricionales</SectionTitle>
        <p className="text-sm text-white/50">Sin datos suficientes todavía para diagnosticar ningún patrón.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Diagnósticos nutricionales</SectionTitle>
      {diagnoses.length === 0 && <p className="text-sm text-white/50">Sin riesgos detectados en esta ventana — tu ingesta está dentro de rango.</p>}
      {diagnoses.map((d) => (
        <div key={d.nutrientId + d.kind} className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10">
          <p className="text-sm font-semibold">{d.problema}</p>
          <button
            onClick={() => setOpenId(openId === d.nutrientId ? null : d.nutrientId)}
            className="flex items-center gap-1 text-xs text-white/50 cursor-pointer self-start"
          >
            ¿Por qué? <ChevronDown size={13} className={openId === d.nutrientId ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {openId === d.nutrientId && (
            <div className="text-xs text-white/60 leading-relaxed pt-1 border-t border-white/10">
              <p>
                <b>Etiología:</b> {d.etiologia}
              </p>
              <p>
                <b>Signos:</b> {d.signos}
              </p>
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-white/35">{DISCLAIMER_MEDICO}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 3: Intervenciones — alimentos a subir + ajuste de meta calórica, Aceptar/Descartar
// ---------------------------------------------------------------------------
function IntervencionesCard() {
  const { diagnoses, allFoods } = useEvaluation();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const adaptiveDismissed = useGymStore((s) => s.adaptiveDismissed);
  const dismissAdaptiveSuggestion = useGymStore((s) => s.dismissAdaptiveSuggestion);

  const calorieSuggestion = useMemo(() => {
    const p = gymProfile;
    if (!p?.sexo || !p.edad || !p.pesoKg || !p.alturaCm || !p.nivelActividad || !p.objetivoCalorico || !p.intensidadObjetivo) return null;
    const calc = calcCalorieGoal({
      sexo: p.sexo,
      pesoKg: p.pesoKg,
      alturaCm: p.alturaCm,
      edad: p.edad,
      nivelActividad: p.nivelActividad,
      objetivoCalorico: p.objetivoCalorico,
      intensidadObjetivo: p.intensidadObjetivo,
      grasaCorporalPct: p.modoPro ? p.grasaCorporalPct : undefined,
    });
    const adaptive = evaluateAdaptiveCalories({ weightEntries, loggedFoods, calorieGoal, calculatedTDEE: calc.tdee });
    return calorieGoalIntervention(adaptive);
  }, [gymProfile, weightEntries, loggedFoods, calorieGoal]);

  const showCalorieSuggestion = calorieSuggestion && adaptiveDismissed?.goal !== calorieSuggestion.suggestedCalorieGoal;

  const inadecuados = diagnoses.filter((d): d is NutritionDiagnosis => d.kind === "riesgo_inadecuado" && !dismissedIds.includes(d.nutrientId));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Sugerencias de intervención</SectionTitle>

      {showCalorieSuggestion && (
        <div className="rounded-3xl p-4 flex flex-col gap-3 bg-amber-400/10 border border-amber-300/25">
          <p className="text-sm text-amber-100">{calorieSuggestion!.mensaje}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                useGymStore.setState({ calorieGoal: calorieSuggestion!.suggestedCalorieGoal });
                dismissAdaptiveSuggestion(calorieSuggestion!.suggestedCalorieGoal);
              }}
              className="flex-1 rounded-full py-2.5 text-xs font-semibold text-center cursor-pointer bg-white text-black flex items-center justify-center gap-1.5"
            >
              <Check size={13} /> Aceptar ({calorieSuggestion!.suggestedCalorieGoal} kcal)
            </button>
            <button
              onClick={() => dismissAdaptiveSuggestion(calorieSuggestion!.suggestedCalorieGoal)}
              className="flex-1 rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white/10 text-white flex items-center justify-center gap-1.5"
            >
              <XIcon size={13} /> Descartar
            </button>
          </div>
        </div>
      )}

      {inadecuados.length === 0 && !showCalorieSuggestion && (
        <p className="text-sm text-white/50">Sin intervenciones pendientes por ahora.</p>
      )}

      {inadecuados.map((d) => {
        const falta = Math.max(0, d.valorReferencia - d.promedioObservado);
        // Cantidades REALES: gramos de cada alimento (con su porción habitual) que cubren la brecha, no valores por 100 g.
        const foods = topFoodsForNutrient(allFoods, d.nutrientId, 4, falta);
        const intervention = buildIntervention(d, foods.map((f) => f.foodId));
        return (
          <div key={d.nutrientId} className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
            <p className="text-sm">{intervention.mensaje}</p>
            {foods.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {foods.map((f) => (
                  <li key={f.foodId} className="text-xs rounded-2xl px-3 py-2 bg-white/10 flex items-baseline justify-between gap-3">
                    <span className="font-semibold truncate">{f.nombre}</span>
                    <span className="text-white/65 text-right shrink-0">
                      ≈ {f.gramosParaCubrir} g
                      {f.porcionesParaCubrir !== undefined && f.porcionesParaCubrir > 0
                        ? ` (${f.porcionesParaCubrir} ${f.porcionesParaCubrir === 1 ? "porción" : "porciones"} de ${f.gramosPorcion} g)`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {foods.length === 0 && (
              <p className="text-xs text-white/45">Ningún alimento de tu base cubre esta brecha con una cantidad realista por sí solo: conviene repartirla entre varios.</p>
            )}
            <div className="flex gap-2">
              <Link
                href="/gym/calorias"
                className="flex-1 rounded-full py-2.5 text-xs font-semibold text-center cursor-pointer bg-white text-black flex items-center justify-center gap-1.5"
              >
                <Check size={13} /> Ver alimentos
              </Link>
              <button
                onClick={() => setDismissedIds((prev) => [...prev, d.nutrientId])}
                className="flex-1 rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white/10 text-white flex items-center justify-center gap-1.5"
              >
                <XIcon size={13} /> Descartar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 4: Síntomas — registrar + patrones detectados
// ---------------------------------------------------------------------------
function SintomasCard() {
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const symptomEntries = useGymStore((s) => s.symptomEntries);
  const addSymptomEntry = useGymStore((s) => s.addSymptomEntry);
  const [kind, setKind] = useState<SymptomKind>("hinchazon");
  const [notaLibre, setNotaLibre] = useState("");

  const recentFoods = useMemo(() => [...loggedFoods].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10), [loggedFoods]);
  const [selectedFoodId, setSelectedFoodId] = useState<string>("");

  const patterns = useMemo(() => correlateAllSymptoms(symptomEntries, loggedFoods), [symptomEntries, loggedFoods]);

  function onRegistrar() {
    if (!selectedFoodId) return;
    addSymptomEntry({ loggedFoodId: selectedFoodId, kind, notaLibre: kind === "otro" ? notaLibre : undefined, timestamp: Date.now() });
    setNotaLibre("");
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Este alimento me hace mal</SectionTitle>

      <div className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
        <select
          value={selectedFoodId}
          onChange={(e) => setSelectedFoodId(e.target.value)}
          className="rounded-xl bg-white/10 text-sm px-3 py-2 text-white"
        >
          <option value="">¿Qué comiste?</option>
          {recentFoods.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SYMPTOM_LABELS) as SymptomKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="text-[11px] rounded-full px-2.5 py-1 cursor-pointer"
              style={{ background: kind === k ? NUTRIOLOGO_ACCENT : "rgba(255,255,255,0.1)", color: kind === k ? "#001018" : "#fff" }}
            >
              {SYMPTOM_LABELS[k]}
            </button>
          ))}
        </div>
        {kind === "otro" && (
          <input
            value={notaLibre}
            onChange={(e) => setNotaLibre(e.target.value)}
            placeholder="Describí cómo te sentiste"
            className="rounded-xl bg-white/10 text-base px-3 py-2 text-white placeholder:text-white/30"
          />
        )}
        <button
          onClick={onRegistrar}
          disabled={!selectedFoodId}
          className="rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white text-black disabled:opacity-40"
        >
          Registrar
        </button>
      </div>

      <SectionTitle>Patrones detectados</SectionTitle>
      {patterns.length === 0 && <p className="text-sm text-white/50">Todavía no registraste ningún síntoma.</p>}
      {patterns.map((p) => (
        <div key={p.kind} className="rounded-3xl p-4 flex flex-col gap-1.5 bg-white/[0.05] border border-white/10">
          <p className="text-sm font-semibold">{SYMPTOM_LABELS[p.kind as SymptomKind] ?? p.kind}</p>
          {!p.datosSuficientes ? (
            <p className="text-xs text-white/50">
              Llevás {p.totalOcurrencias} de {MIN_SYMPTOM_OCCURRENCES} reportes necesarios — seguí registrando para ver un patrón.
            </p>
          ) : p.alimentos.length === 0 ? (
            <p className="text-xs text-white/50">Sin ningún alimento repetido antes de este síntoma todavía.</p>
          ) : (
            p.alimentos.slice(0, 3).map((a) => (
              <p key={a.foodId} className="text-xs text-white/60">
                En {a.coincidencias} de {a.totalOcurrencias} veces, habías comido <b>{a.nombre}</b> en las 4 horas previas.
              </p>
            ))
          )}
        </div>
      ))}
      <p className="text-xs text-white/35">{DISCLAIMER_SINTOMAS}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 5: Agente conversacional (mascota con traje de nutriólogo)
// ---------------------------------------------------------------------------
function AgenteCard() {
  const { diagnoses, evaluation } = useEvaluation();

  const feedback = useMemo(() => {
    if (!evaluation.datosSuficientes) {
      return "Todavía no tengo suficientes días de registro consistente para decirte algo confiable. Seguí registrando tus comidas.";
    }
    if (diagnoses.length === 0) return "Tu ingesta de las últimas semanas está dentro de rango en todo lo que puedo evaluar. Seguí así.";
    const top = diagnoses[0];
    return `${top.problema}: ${top.signos}.`;
  }, [diagnoses, evaluation.datosSuficientes]);

  return (
    <div className="flex flex-col items-center gap-5 pt-6">
      <Mascot costume="nutriologo" accent={NUTRIOLOGO_ACCENT} size={140} />
      <div className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10 max-w-sm">
        <p className="text-sm leading-relaxed">{feedback}</p>
      </div>
      <p className="text-xs text-white/40 text-center max-w-xs">
        Para preguntarle &ldquo;¿por qué me dijiste esto?&rdquo; con más detalle, abrí la tarjeta de Diagnósticos y tocá
        &ldquo;¿Por qué?&rdquo; en cada uno — ahí está el dato exacto que generó cada aviso.
      </p>
      <p className="text-xs text-white/35 text-center max-w-xs">{DISCLAIMER_MEDICO}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 6: Actividad — calorías de entrenamiento (estimado) + caminata con GPS
// ---------------------------------------------------------------------------
const DISCLAIMER_ACTIVIDAD =
  "Estimado (método MET, Compendium of Physical Activities 2011) a partir de tus series/reps/peso y del descanso configurado — una aproximación, no una medición real.";

function ActividadCard() {
  const sessions = useGymStore((s) => s.sessions);
  const walkSessions = useGymStore((s) => s.walkSessions);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const pesoCorporalKg = gymProfile?.pesoKg ?? 0;

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todaySession = useMemo(() => sessions.find((s) => s.completado && s.date.slice(0, 10) === todayKey), [sessions, todayKey]);
  const todayEstimate = useMemo(
    () => (todaySession && pesoCorporalKg > 0 ? estimateSessionCalories(todaySession, pesoCorporalKg) : null),
    [todaySession, pesoCorporalKg],
  );

  const daily = useMemo(() => dailyActivityTotals(sessions, walkSessions, pesoCorporalKg), [sessions, walkSessions, pesoCorporalKg]);
  const weekly = useMemo(() => weeklyActivityTotals(daily), [daily]);
  const monthly = useMemo(() => monthlyActivityTotals(daily), [daily]);
  const weekKey = format(new Date(), "RRRR-'W'II");
  const monthKey = format(new Date(), "yyyy-MM");

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Calorías de entrenamiento (hoy)</SectionTitle>
      {!pesoCorporalKg ? (
        <p className="text-sm text-white/50">Agregá tu peso en el perfil para estimar las calorías de tu entrenamiento.</p>
      ) : !todaySession ? (
        <p className="text-sm text-white/50">Todavía no completaste un entrenamiento hoy.</p>
      ) : (
        <div className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Total estimado</span>
            <span className="text-lg font-semibold tabular-nums">{todayEstimate?.totalKcal ?? 0} kcal</span>
          </div>
          {todayEstimate?.porEjercicio.map((e) => (
            <div key={e.exerciseId} className="flex items-center justify-between text-xs text-white/55">
              <span className="capitalize">{e.exerciseId.replace(/-/g, " ")}</span>
              <span className="tabular-nums">{e.kcal} kcal</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl p-4 grid grid-cols-3 gap-2 text-center bg-white/[0.05] border border-white/10">
        <div>
          <p className="text-sm font-semibold tabular-nums">{Math.round(daily.get(todayKey)?.totalKcal ?? 0)}</p>
          <p className="text-[10px] text-white/45 uppercase">hoy</p>
        </div>
        <div>
          <p className="text-sm font-semibold tabular-nums">{Math.round(weekly.get(weekKey) ?? 0)}</p>
          <p className="text-[10px] text-white/45 uppercase">esta semana</p>
        </div>
        <div>
          <p className="text-sm font-semibold tabular-nums">{Math.round(monthly.get(monthKey) ?? 0)}</p>
          <p className="text-[10px] text-white/45 uppercase">este mes</p>
        </div>
      </div>
      <p className="text-[10px] text-white/35">{DISCLAIMER_ACTIVIDAD}</p>

      <SectionTitle>Caminata</SectionTitle>
      <WalkTracker />
      {walkSessions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {walkSessions.slice(0, 5).map((w) => (
            <div key={w.id} className="flex items-center justify-between text-xs text-white/55 rounded-xl px-3 py-2 bg-white/[0.04]">
              <span>{format(new Date(w.startedAt), "d MMM, HH:mm", { locale: es })}</span>
              <span className="tabular-nums">
                {w.distanceKm?.toFixed(2) ?? "0.00"} km · {w.kcal ?? 0} kcal
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta 7: Plan de comidas sugerido — combina alimentos de tu propia base (USDA + regional) para
// acercarse a tu meta de kcal/macros, y se puede descargar como lista de texto.
// ---------------------------------------------------------------------------
const DISCLAIMER_PLAN =
  "Combinación de alimentos de tu propia base (USDA FoodData Central + datos regionales) para acercarse a tu meta de calorías y macros — no es un plan hecho por un nutricionista ni lo reemplaza.";

function PlanComidasCard() {
  const { allFoods } = useEvaluation();
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const [nonce, setNonce] = useState(0);

  const plan = useMemo(
    () =>
      suggestMealPlan({
        foods: allFoods,
        calorieGoal,
        proteinGoal,
        carbsGoal,
        fatGoal,
        dia: `${new Date().toISOString().slice(0, 10)}#${nonce}`,
      }),
    [allFoods, calorieGoal, proteinGoal, carbsGoal, fatGoal, nonce],
  );

  function download() {
    const objetivoLabel = gymProfile?.objetivoCalorico ? OBJETIVO_LABELS[gymProfile.objetivoCalorico] : "Sin objetivo configurado";
    const text = formatMealPlanAsText(plan, objetivoLabel);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vida-total-plan-comidas-${plan.dia.slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <SectionTitle>Plan de comidas sugerido</SectionTitle>
      {calorieGoal <= 0 ? (
        <p className="text-sm text-white/50">Configurá tu meta calórica en Calorías → Ajustes para generar un plan.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              onClick={download}
              className="flex-1 rounded-full py-2.5 text-xs font-semibold text-center cursor-pointer bg-white text-black flex items-center justify-center gap-1.5"
            >
              <Download size={13} /> Descargar lista (.txt)
            </button>
            <button
              onClick={() => setNonce((n) => n + 1)}
              aria-label="Probar otra combinación"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center cursor-pointer bg-white/10 text-white"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {plan.entries.map((entry) => (
            <div key={entry.meal} className="rounded-3xl p-4 flex flex-col gap-2 bg-white/[0.05] border border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize">{/^snack(\d)$/.test(entry.meal) ? `Colación ${entry.meal.slice(5)}` : entry.meal}</p>
                <span className="text-xs text-white/45 tabular-nums">{Math.round(entry.totales.calorias)} kcal</span>
              </div>
              {entry.items.map((item) => (
                <div key={item.food.id + item.role} className="flex items-center justify-between text-xs text-white/60">
                  <span className="truncate pr-2">
                    {item.food.nombre} · {item.gramos} g
                  </span>
                  <span className="tabular-nums shrink-0">{item.nutricion.calorias} kcal</span>
                </div>
              ))}
              {entry.items.length === 0 && <p className="text-xs text-white/40">Sin alimentos suficientes en tu base para esta comida.</p>}
            </div>
          ))}

          <div className="rounded-3xl p-4 flex flex-col gap-1.5 bg-white/[0.05] border border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Total del día</span>
              <span className="font-semibold tabular-nums">
                {Math.round(plan.totalesDia.calorias)} / {Math.round(plan.metas.calorias)} kcal
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Proteína</span>
              <span className="tabular-nums">
                {Math.round(plan.totalesDia.proteina)} / {Math.round(plan.metas.proteina)} g
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Carbohidratos</span>
              <span className="tabular-nums">
                {Math.round(plan.totalesDia.carbos)} / {Math.round(plan.metas.carbos)} g
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Grasas</span>
              <span className="tabular-nums">
                {Math.round(plan.totalesDia.grasas)} / {Math.round(plan.metas.grasas)} g
              </span>
            </div>
          </div>

          {plan.avisos.map((a) => (
            <p key={a} className="text-xs text-amber-200/80">
              {a}
            </p>
          ))}
        </>
      )}
      <p className="text-xs text-white/35">{DISCLAIMER_PLAN}</p>
    </div>
  );
}
