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
import { ChevronLeft, Check, X as XIcon, ChevronDown } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import { useTargetProfile, useNutrientTargets } from "@/lib/nutrition/use-targets";
import { calcCalorieGoal } from "@/lib/gym/calorie-calc";
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
import { correlateAllSymptoms, MIN_SYMPTOM_OCCURRENCES } from "@/lib/nutrition/symptom-correlation";
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
  const CARD_COUNT = 5;
  const { direction, goTo, onDragEnd } = useSwipeCarousel({ index: card, length: CARD_COUNT, onIndexChange: setCard });

  // Última pantalla de la cadena de Calorías: solo se vuelve hacia abajo (a la racha/año), no hay nada
  // después. Mismo mecanismo pointerDown/pointerUp que Coach en Entrenamiento.
  const startY = useRef<number | null>(null);
  function onPointerUp(e: React.PointerEvent) {
    const dy = e.clientY - (startY.current ?? e.clientY);
    startY.current = null;
    if (dy > 70) router.push(VOLVER_A_CALORIAS);
  }

  return (
    <div
      className="app-bg fixed inset-0 z-[45] flex flex-col text-white select-none overflow-hidden"
      onPointerDown={(e) => (startY.current = e.clientY)}
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
          {card === 1 && <DiagnosticosCard />}
          {card === 2 && <IntervencionesCard />}
          {card === 3 && <SintomasCard />}
          {card === 4 && <AgenteCard />}
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
        const foods = topFoodsForNutrient(allFoods, d.nutrientId, 4);
        const intervention = buildIntervention(d, foods.map((f) => f.foodId));
        return (
          <div key={d.nutrientId} className="rounded-3xl p-4 flex flex-col gap-3 bg-white/[0.05] border border-white/10">
            <p className="text-sm">{intervention.mensaje}</p>
            {foods.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {foods.map((f) => (
                  <span key={f.foodId} className="text-[11px] rounded-full px-2.5 py-1 bg-white/10">
                    {f.nombre}
                  </span>
                ))}
              </div>
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
            className="rounded-xl bg-white/10 text-sm px-3 py-2 text-white placeholder:text-white/30"
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
