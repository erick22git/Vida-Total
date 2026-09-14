"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Square, Check, X, Keyboard } from "lucide-react";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { ManualEntryModal } from "@/components/gym/manual-entry-modal";
import { BASE_FOODS, defaultPortions, scaleNutrition } from "@/lib/food-utils";
import type { Food } from "@/lib/types";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

// Mismo sessionStorage que usa el Escáner (ver escaner/page.tsx y
// escaner/resultados/page.tsx) — la Voz reutiliza esa pantalla de
// confirmación en vez de duplicarla, tal como pidió el usuario ("debe
// llevar a una pestaña de confirmación como en Lista y Escáner").
const RESULTS_KEY = "vt-scan-results";

interface DetectedItem {
  food: Food;
  grams: number;
}

/** Busca ocurrencias de "100g" / "100 gr" / "100 gramos" / "1kg" / "200ml"
 * en el texto dictado, con su posición — para asociarlas al alimento más
 * cercano en `matchFoodsFromText`. Muy simple a propósito (regex, no NLP
 * real) — suficiente para el caso común de "un alimento, una cantidad". */
function parseQuantities(text: string): { grams: number; index: number }[] {
  const matches: { grams: number; index: number }[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(kilos?|kg|gramos?|gr|g|mililitros?|ml)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let value = parseFloat(m[1].replace(",", "."));
    if (Number.isNaN(value)) continue;
    const unit = m[2].toLowerCase();
    if (unit.startsWith("kilo") || unit === "kg") value *= 1000;
    matches.push({ grams: value, index: m.index });
  }
  return matches;
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

/** Very simple fuzzy match: normalizes accents/case and checks token overlap
 * against the local food database — no real AI/NLP involved. Also looks for
 * a spoken quantity ("100g", "1kg", "200ml") and, when found, associates it
 * with whichever detected food's name sits closest to it in the transcript
 * — otherwise falls back to that food's default portion. */
function matchFoodsFromText(text: string): DetectedItem[] {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const normalizedText = normalize(text);
  const tokens = normalizedText.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const quantities = parseQuantities(normalizedText);

  const scored = BASE_FOODS.map((food) => {
    const name = normalize(food.nombre);
    let score = 0;
    for (const token of tokens) {
      if (name.includes(token)) score += 1;
    }
    return { food, score, nameIndex: normalizedText.indexOf(name.split(" ")[0]) };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const result: DetectedItem[] = [];
  for (const { food, nameIndex } of scored) {
    if (seen.has(food.id)) continue;
    seen.add(food.id);

    let grams = defaultPortions(food)[0].gramos;
    if (quantities.length > 0 && nameIndex !== -1) {
      const nearest = quantities.reduce((best, q) =>
        Math.abs(q.index - nameIndex) < Math.abs(best.index - nameIndex) ? q : best,
      );
      grams = nearest.grams;
    } else if (quantities.length === 1) {
      grams = quantities[0].grams;
    }

    result.push({ food, grams });
    if (result.length >= 6) break;
  }
  return result;
}

export default function VozPage() {
  const router = useRouter();

  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);

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
        const matches = matchFoodsFromText(current);
        setDetected(matches);
        setSelected(new Set(matches.map((m) => m.food.id)));
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
    const items: AnalyzedFoodItem[] = detected
      .filter((d) => selected.has(d.food.id))
      .map((d) => {
        const n = scaleNutrition(d.food, d.grams);
        return {
          name: d.food.nombre,
          estimatedGrams: d.grams,
          confidence: "media",
          calories: n.calorias,
          protein: n.proteina,
          carbs: n.carbos,
          fat: n.grasas,
        };
      });
    if (items.length === 0) return;
    try {
      sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ photo: null, items }));
    } catch {
      return;
    }
    router.push("/gym/calorias/escaner/resultados");
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Registro por voz</h1>
      </header>

      <CaloriasMethodNav />

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
                {detected.map(({ food, grams }) => (
                  <label
                    key={food.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] glass-specular-ring px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(food.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(food.id);
                          else next.delete(food.id);
                          return next;
                        })
                      }
                      className="accent-white w-4 h-4"
                    />
                    <span className="flex-1 text-sm text-white">{food.nombre}</span>
                    <span className="text-xs text-white/45">{Math.round(grams)} g</span>
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

      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
