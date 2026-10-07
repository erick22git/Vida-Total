"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic, Square, Check, X, Keyboard } from "lucide-react";
import { FoodSectionHeader } from "@/components/gym/food-section-header";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ManualEntryModal } from "@/components/gym/manual-entry-modal";
import { mergeFoods } from "@/lib/food-utils";
import { buildUsageMap, getResolverIndex, resolveFoodText, type ResolverIndex } from "@/lib/nutrition/food-resolver";
import { splitSpokenFoods } from "@/lib/nutrition/voice-parse";
import { useGymStore } from "@/lib/store/gymStore";
import type { MealType } from "@/lib/types";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

const VALID_MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

// Rediseño Calorías, etapa 7 (visual, sin tocar la lógica de reconocimiento de voz): mismo fondo
// oscuro con grano que el resto de las pantallas rediseñadas.
// Mismo sessionStorage que usa el Escáner (ver escaner/page.tsx y
// escaner/resultados/page.tsx) — la Voz reutiliza esa pantalla de
// confirmación en vez de duplicarla, tal como pidió el usuario ("debe
// llevar a una pestaña de confirmación como en Lista y Escáner").
const RESULTS_KEY = "vt-scan-results";

interface DetectedItem {
  key: string;
  /** Lo que se dijo (sin cantidad). */
  texto: string;
  /** Nombre del alimento/receta que resolvió el algoritmo; si no hubo, lo dicho. */
  nombre: string;
  /** 0 = sin cantidad conocida (el resolvedor usa la porción por defecto al confirmar). */
  gramos: number;
  tipo: "alimento" | "receta" | "sin_resultado";
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** El dictado se parte en segmentos ("dos huevos", "200 g de arroz"…) y cada uno lo resuelve el resolvedor de alimentos
 * (`lib/nutrition/food-resolver.ts`): alimento de la base, receta del usuario o sin resultado. Acá no se decide nada. */
function detectFromText(text: string, idx: ResolverIndex, usage: Map<string, number>): DetectedItem[] {
  return splitSpokenFoods(text).map((seg, i) => {
    const r = resolveFoodText(seg.texto, idx, { gramos: seg.gramos ?? undefined, usage });
    let gramos = seg.gramos ?? 0;
    if (r.tipo !== "sin_resultado") {
      gramos = seg.gramos ?? (seg.cantidad ? r.gramos * seg.cantidad : 0);
    }
    return { key: `${i}-${seg.texto}`, texto: seg.texto, nombre: r.chosen?.nombre ?? seg.texto, gramos, tipo: r.tipo };
  });
}

export default function VozPage() {
  return (
    <Suspense fallback={null}>
      <VozContent />
    </Suspense>
  );
}

function VozContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealParam = searchParams.get("meal") as MealType | null;
  const meal: MealType = mealParam && VALID_MEALS.includes(mealParam) ? mealParam : "snack1";

  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);

  const customFoods = useGymStore((st) => st.customFoods);
  const recipes = useGymStore((st) => st.recipes);
  const loggedFoods = useGymStore((st) => st.loggedFoods);
  const idx = useMemo(() => getResolverIndex(mergeFoods(customFoods), recipes), [customFoods, recipes]);
  const usage = useMemo(() => buildUsageMap(loggedFoods), [loggedFoods]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run client-side to avoid SSR/client hydration mismatch
    setSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRecording() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      setTranscript(text.trim());
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();

    setRecording(true);
    setSeconds(0);
    setTranscript("");
    setDetected([]);
    setSelected(new Set());
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setTimeout(() => {
      setTranscript((current) => {
        const matches = detectFromText(current, idx, usage);
        setDetected(matches);
        setSelected(new Set(matches.map((m) => m.key)));
        return current;
      });
    }, 300);
  }

  function discard() {
    setTranscript("");
    setDetected([]);
    setSelected(new Set());
  }

  /** Lleva a la MISMA pantalla de confirmación editable que usa el Escáner
   * (grams +/-, macros recalculados, selector de comida) en vez de
   * agregar directo al store — así el usuario puede ajustar los gramos
   * que Speech Recognition entendió antes de confirmar, igual que en
   * Lista y Escáner. */
  function confirm() {
    // La voz solo aporta NOMBRE y GRAMOS (como la IA del Escáner): la pantalla de resultados vuelve a resolver el nombre.
    const items: AnalyzedFoodItem[] = detected
      .filter((d) => selected.has(d.key))
      .map((d) => ({
        name: d.nombre,
        estimatedGrams: d.gramos,
        confidence: d.tipo === "sin_resultado" ? "baja" : "media",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }));
    if (items.length === 0) return;
    try {
      sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ photo: null, items }));
    } catch {
      return;
    }
    router.push(`/gym/calorias/escaner/resultados?meal=${meal}`);
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0" style={{ background: "var(--app-bg)" }} aria-hidden />
      <div className="relative z-10 flex flex-col gap-5 pb-10">
      <FoodSectionHeader current="voz" />

      {!supported ? (
        <GlassCard padding="lg" className="flex flex-col items-center gap-4 text-center">
          <Mic size={28} className="text-white/30" />
          <p className="text-sm text-white/60">
            Tu navegador no soporta reconocimiento de voz. Puedes usar el ingreso manual como alternativa.
          </p>
          <GlassButton onClick={() => setManualOpen(true)} className="flex items-center gap-2">
            <Keyboard size={15} /> Ingreso Manual
          </GlassButton>
        </GlassCard>
      ) : (
        <>
          <div className="flex flex-col items-center gap-4 py-6">
            <h2 className="text-lg font-semibold text-white">¿Qué comiste hoy?</h2>
            <button
              onClick={recording ? stopRecording : startRecording}
              className="relative flex items-center justify-center w-24 h-24 rounded-full cursor-pointer transition-transform active:scale-95"
              style={{
                background: recording
                  ? "linear-gradient(135deg, #ef4444, #b91c1c)"
                  : "linear-gradient(135deg, var(--gym), var(--gym)CC)",
                boxShadow: recording ? "0 0 30px #ef444466" : "0 0 24px var(--gym)55",
              }}
            >
              {recording ? <Square size={26} className="text-white" /> : <Mic size={30} className="text-white" />}
            </button>
            {recording && (
              <p className="text-sm text-white/60 tabular-nums">
                {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
              </p>
            )}
            {transcript && (
              <p className="text-sm text-white/70 text-center max-w-sm bg-white/[0.05] rounded-2xl glass-specular-ring px-4 py-3">
                “{transcript}”
              </p>
            )}
          </div>

          {detected.length > 0 && (
            <GlassCard padding="md" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">Alimentos detectados</p>
              <div className="flex flex-col gap-2">
                {detected.map((d) => (
                  <label
                    key={d.key}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] glass-specular-ring px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(d.key)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(d.key);
                          else next.delete(d.key);
                          return next;
                        })
                      }
                      className="accent-white w-4 h-4"
                    />
                    <span className="flex-1 min-w-0 text-sm text-white truncate">
                      {d.nombre}
                      {d.tipo === "sin_resultado" && <span className="ml-1.5 text-[10px] uppercase text-amber-300/90">sin equivalente</span>}
                      {d.tipo === "receta" && <span className="ml-1.5 text-[10px] uppercase text-white/45">receta</span>}
                    </span>
                    <span className="text-xs text-white/45 shrink-0">{d.gramos > 0 ? `${Math.round(d.gramos)} g` : "1 porción"}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-1">
                <GlassButton variant="ghost" className="flex-1 flex items-center justify-center gap-1.5" onClick={discard}>
                  <X size={15} /> Descartar
                </GlassButton>
                <GlassButton className="flex-1 flex items-center justify-center gap-1.5" disabled={selected.size === 0} onClick={confirm}>
                  <Check size={15} /> Revisar y confirmar
                </GlassButton>
              </div>
            </GlassCard>
          )}

          {!recording && transcript && detected.length === 0 && (
            <GlassCard padding="md" className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-white/60">No pudimos identificar alimentos en lo que dijiste.</p>
              <div className="flex gap-2">
                <GlassButton variant="ghost" onClick={discard}>Intentar de nuevo</GlassButton>
                <GlassButton onClick={() => setManualOpen(true)}>Ingreso Manual</GlassButton>
              </div>
            </GlassCard>
          )}
        </>
      )}

      <ManualEntryModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        defaultMeal={meal}
        onSaved={(m) => router.push(`/gym/calorias?justAdded=${m}`)}
      />
      </div>
    </div>
  );
}
