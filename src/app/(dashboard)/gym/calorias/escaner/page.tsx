"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera as CameraIcon, Plus, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { FoodSectionHeader, FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { GlassButton } from "@/components/glass/glass-button";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { useGymStore } from "@/lib/store/gymStore";
import type { MealType } from "@/lib/types";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

type Mode = "foto" | "codigo";

const VALID_MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  image_front_url?: string;
}

const MAX_PHOTO_SIDE = 1024;

type AnalyzeErrorKind = "no_api_key" | "rate_limit" | "network" | "timeout" | "unknown";

const ANALYZE_TIMEOUT_MS = 15000;

/** sessionStorage keys shared with crear-alimento (fallback) and resultados (AI results). */
const PHOTO_KEY = "vt-scanned-photo";
const RESULTS_KEY = "vt-scan-results";

export default function EscanerPage() {
  return (
    <Suspense fallback={null}>
      <EscanerContent />
    </Suspense>
  );
}

function EscanerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Qué comida está eligiendo (viene de deslizar desde otra sección, o de la home) — se propaga a
  // dónde termine cada camino (resultados de foto/voz, alimento por código de barras, buscador).
  const mealParam = searchParams.get("meal") as MealType | null;
  const meal: MealType = mealParam && VALID_MEALS.includes(mealParam) ? mealParam : "desayuno";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<import("@zxing/library").BrowserMultiFormatReader | null>(null);

  const [mode, setMode] = useState<Mode>("foto");
  const prevModeRef = useRef<Mode>("foto");
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied" | "error">("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [torch, setTorch] = useState(false);

  // Modo Foto: análisis con IA de visión (Groq).
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<AnalyzeErrorKind | null>(null);
  const [rateInfo, setRateInfo] = useState<{ scope: "minute" | "day" | "unknown"; retryAfterSec?: number } | null>(null);

  const addCustomFood = useGymStore((s) => s.addCustomFood);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current?.reset();
  }, []);

  const startCamera = useCallback(async () => {
    setStatus(null);
    try {
      // Detiene cualquier stream previo antes de pedir uno nuevo — evita
      // fugas de tracks abiertos cuando esto se llama de nuevo (p.ej. al
      // volver al modo Foto tras usar el Código de barras).
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPermissionState("granted");
    } catch (err) {
      console.warn("[escaner] camera error", err);
      setPermissionState("denied");
    }
  }, []);

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      setStatus(`Código detectado: ${barcode}. Buscando producto...`);
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const data = (await res.json()) as { status: number; product?: OpenFoodFactsProduct };
        if (data.status === 1 && data.product) {
          const p = data.product;
          const n = p.nutriments ?? {};
          const created = addCustomFood({
            nombre: p.product_name || `Producto ${barcode}`,
            marca: p.brands,
            categoria: "Otros",
            porcion: "100 g",
            pesoGramos: 100,
            calorias: n["energy-kcal_100g"] ?? 0,
            proteina: n["proteins_100g"] ?? 0,
            carbos: n["carbohydrates_100g"] ?? 0,
            grasas: n["fat_100g"] ?? 0,
            grasasSaturadas: n["saturated-fat_100g"],
            sodio: n["sodium_100g"] ? n["sodium_100g"] * 1000 : undefined,
            fibra: n["fiber_100g"],
            azucares: n["sugars_100g"],
            barcode,
            photoUrl: p.image_front_url ?? null,
          });
          stopCamera();
          router.push(`/gym/calorias/alimento/${created.id}?meal=${meal}`);
        } else {
          setStatus("Producto no encontrado. Puedes crearlo manualmente.");
          stopCamera();
          setTimeout(() => router.push(`/gym/calorias/crear-alimento?barcode=${barcode}&fromScan=1`), 900);
        }
      } catch (err) {
        console.warn("[escaner] openfoodfacts error", err);
        setStatus("No se pudo consultar el producto. Puedes crearlo manualmente.");
        stopCamera();
        setTimeout(() => router.push(`/gym/calorias/crear-alimento?barcode=${barcode}&fromScan=1`), 900);
      }
    },
    [addCustomFood, meal, router, stopCamera],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- camera permission must be requested once on mount
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reacquire the camera when returning to "Foto" from "Código": zxing's
  // `reader.reset()` (called on cleanup when leaving "codigo" mode below)
  // stops the tracks of the MediaStream bound to our shared <video>, since
  // it assumes ownership of it. Without this, the video element is left
  // showing a black frame — dead tracks, but no error — whenever you go
  // back to "Foto" mode after having used "Código" at least once.
  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;
    if (mode === "foto" && prevMode === "codigo" && permissionState === "granted") {
      startCamera();
    }
  }, [mode, permissionState, startCamera]);

  // Barcode scanning loop when in "codigo" mode.
  useEffect(() => {
    if (mode !== "codigo" || permissionState !== "granted" || !videoRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        setScanning(true);
        reader.decodeFromVideoElementContinuously(videoRef.current!, (result) => {
          if (cancelled || !result) return;
          const text = result.getText();
          setScanning(false);
          reader.reset();
          handleBarcodeDetected(text);
        });
      } catch (err) {
        console.warn("[escaner] zxing init error", err);
      }
    })();

    return () => {
      cancelled = true;
      readerRef.current?.reset();
    };
  }, [mode, permissionState, handleBarcodeDetected]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    const next = !torch;
    try {
      await track?.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorch(next);
    } catch {
      setStatus("Este dispositivo no permite usar la linterna desde acá.");
    }
  }

  function persistPhotoForFallback(dataUrl: string) {
    try {
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
    } catch {
      // sessionStorage unavailable — proceed without the photo attached.
    }
  }

  /** Fallback: same behavior the "Foto" mode had before AI analysis was wired up —
   * navigate to "Crear Alimento" with the photo attached so the user completes
   * the data manually. Used when AI analysis isn't available or fails. */
  const goToManualCreate = useCallback(() => {
    stopCamera();
    router.push("/gym/calorias/crear-alimento?fromScan=1");
  }, [router, stopCamera]);

  const goToManualSearch = useCallback(() => {
    stopCamera();
    router.push(`/gym/calorias/buscar-nuevo?meal=${meal}`);
  }, [meal, router, stopCamera]);

  async function analyzePhoto(dataUrl: string) {
    setAnalyzing(true);
    setAnalyzeError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("offline");
      }

      const res = await fetch("/api/food/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        items?: AnalyzedFoodItem[];
        error?: string;
        scope?: "minute" | "day" | "unknown";
        retryAfterSec?: number;
      };

      if (!res.ok || !data.items) {
        if (data.error === "no_api_key") {
          setAnalyzeError("no_api_key");
        } else if (data.error === "rate_limit" || res.status === 429) {
          setRateInfo({ scope: data.scope ?? "unknown", retryAfterSec: data.retryAfterSec });
          setAnalyzeError("rate_limit");
        } else {
          setAnalyzeError("unknown");
        }
        setAnalyzing(false);
        return;
      }

      try {
        sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ photo: dataUrl, items: data.items }));
      } catch {
        // sessionStorage unavailable — cannot pass results along, fall back to manual.
        setAnalyzeError("unknown");
        setAnalyzing(false);
        return;
      }

      stopCamera();
      router.push(`/gym/calorias/escaner/resultados?meal=${meal}`);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      console.warn("[escaner] analyze error", err);
      if (isAbort) setAnalyzeError("timeout");
      else if (offline || err instanceof TypeError) setAnalyzeError("network");
      else setAnalyzeError("unknown");
      setAnalyzing(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    // Se reduce antes de enviar: una foto de cámara a resolución completa pesa varios MB y gasta mucho del
    // límite de tokens por minuto de la IA sin mejorar el reconocimiento de un plato de comida.
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    persistPhotoForFallback(dataUrl);
    stopCamera();
    setCapturedPhoto(dataUrl);
    analyzePhoto(dataUrl);
  }

  function retryAnalyze() {
    if (!capturedPhoto) return;
    analyzePhoto(capturedPhoto);
  }

  const round = {
    background: "linear-gradient(#383838, #262626)",
    boxShadow: "inset 0 2px 3px rgba(255,255,255,0.10), inset 0 -2px 4px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.6)",
  } as const;

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden text-white flex flex-col select-none" style={FOOD_SECTION_BG}>
      <div className="px-4 max-w-md mx-auto w-full">
        <FoodSectionHeader current="escaner" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-3 px-4 pb-4 pt-1 max-w-md mx-auto w-full">
        {/* Controles de arriba: modo, perilla y linterna — estilo de la cámara de referencia. */}
        <div className="flex items-stretch gap-3 h-[92px] shrink-0">
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setMode((m) => (m === "foto" ? "codigo" : "foto"))}
              aria-label="Cambiar entre foto y código de barras"
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              style={round}
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              onClick={goToManualCreate}
              aria-label="Crear alimento manualmente"
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform text-lg font-bold"
              style={round}
            >
              A
            </button>
          </div>
          <div
            className="flex-1 rounded-xl flex items-center justify-center"
            style={{
              background: "repeating-linear-gradient(90deg, #171717 0px, #171717 3px, #2c2c2c 3px, #2c2c2c 9px)",
              boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), 0 3px 10px rgba(0,0,0,0.5)",
            }}
          >
            <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/80">
              {mode === "foto" ? "Foto" : "Código"}
            </span>
          </div>
          <button
            onClick={toggleTorch}
            aria-label="Linterna"
            aria-pressed={torch}
            className="w-[52px] rounded-full relative cursor-pointer shrink-0 transition-colors"
            style={{
              background: torch ? "linear-gradient(#ffd000, #ffab00)" : "#1e1e1e",
              boxShadow: "inset 0 3px 6px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.5)",
            }}
          >
            <span
              className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full transition-all"
              style={{ ...round, top: torch ? "calc(100% - 44px)" : "4px" }}
            />
          </button>
        </div>

        {/* Visor */}
        <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
          {permissionState === "denied" ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <CameraIcon size={32} className="text-white/40" />
              <p className="text-sm text-white/70">
                No pudimos acceder a tu cámara. Revisa los permisos del navegador e inténtalo de nuevo.
              </p>
              <GlassButton size="sm" onClick={startCamera} className="flex items-center gap-1.5">
                <RotateCcw size={14} /> Reintentar
              </GlassButton>
            </div>
          ) : capturedPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedPhoto} alt="Foto capturada" className="w-full h-full object-cover" />
              {analyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-white/20" />
                    <div
                      className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                      style={{ borderTopColor: "var(--gym)", borderRightColor: "var(--gym)" }}
                    />
                    <Sparkles size={18} className="absolute inset-0 m-auto text-white/90" />
                  </div>
                  <p className="text-sm font-medium text-white">Analizando...</p>
                  <p className="text-xs text-white/60 px-8 text-center">
                    Identificando alimentos y estimando porciones con IA
                  </p>
                </div>
              )}
              {!analyzing && !analyzeError && (
                <button
                  onClick={() => {
                    setCapturedPhoto(null);
                    startCamera();
                  }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur-md px-4 py-2 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} /> Tomar otra foto
                </button>
              )}
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                // Respaldo: si `play()` fue interrumpido en `startCamera()`
                // (p.ej. llamado antes de que el video tuviera metadata lista,
                // algo común en iOS Safari) reintenta apenas la metadata está
                // disponible, para no quedar con un frame negro congelado.
                onLoadedMetadata={(e) => {
                  e.currentTarget.play().catch(() => {});
                }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Cuadrícula de tercios */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              </div>

              {mode === "codigo" && (
                <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-24 border-2 border-white/70 rounded-2xl" />
              )}

              {status && (
                <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/60 backdrop-blur-md px-3 py-2 text-center text-xs text-white">
                  {status}
                </div>
              )}

              {mode === "codigo" && !status && scanning && (
                <p className="absolute bottom-4 left-4 right-4 text-center text-xs text-white/60">
                  Apunta al código de barras del producto
                </p>
              )}
              {mode === "foto" && !status && (
                <p className="absolute bottom-3 left-4 right-4 text-center text-xs text-white/60">
                  Encuadra el plato y toma la foto
                </p>
              )}
            </>
          )}
        </div>

        {/* Controles de abajo: contador/miniatura, obturador y rueda */}
        <div className="flex items-center justify-between gap-3 h-[104px] shrink-0">
          <div className="flex flex-col gap-2 shrink-0">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ background: "#151515", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7)" }}
            >
              {mode === "foto" ? 1 : 2}
            </div>
            <div className="w-11 h-11 rounded-full overflow-hidden" style={{ background: "#151515", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7)" }}>
              {capturedPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capturedPhoto} alt="Última foto" className="w-full h-full object-cover" />
              )}
            </div>
          </div>
          <button
            onClick={mode === "foto" ? capturePhoto : undefined}
            disabled={mode !== "foto" || !!capturedPhoto || permissionState !== "granted"}
            aria-label="Capturar foto"
            className="w-24 h-24 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-default"
            style={round}
          >
            <Plus size={44} strokeWidth={2.2} />
          </button>
          <div
            className="w-14 h-24 rounded-xl shrink-0"
            style={{
              background: "repeating-linear-gradient(0deg, #141414 0px, #141414 3px, #303030 3px, #303030 8px)",
              boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), 0 3px 10px rgba(0,0,0,0.5)",
            }}
            aria-hidden
          />
        </div>
      </div>

      <ExpandSheet
        open={analyzeError !== null}
        onClose={() => setAnalyzeError(null)}
        title={
          analyzeError === "rate_limit"
            ? rateInfo?.scope === "day"
              ? "Cupo diario de la IA agotado"
              : "Espera un momento"
            : analyzeError === "no_api_key"
              ? "Reconocimiento IA no disponible"
              : analyzeError === "network"
                ? "Sin conexión a internet"
                : analyzeError === "timeout"
                  ? "La solicitud tardó demasiado"
                  : "No se pudo analizar la foto"
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/70">
            {analyzeError === "rate_limit" &&
              (rateInfo?.scope === "day"
                ? "Se usó el cupo diario de análisis de la IA. Intenta mañana o agrega el alimento manualmente."
                : `La IA recibió demasiadas fotos en poco tiempo (límite por minuto, no diario). Espera ${
                    rateInfo?.retryAfterSec ? `unos ${rateInfo.retryAfterSec} segundos` : "un minuto"
                  } y vuelve a intentar, o agrega el alimento manualmente.`)}
            {analyzeError === "no_api_key" &&
              "El reconocimiento por IA no está configurado todavía. Puedes completar los datos del alimento manualmente con la foto que tomaste."}
            {analyzeError === "network" &&
              "El reconocimiento por foto requiere conexión a internet, a diferencia del resto de la app. Revisa tu conexión e inténtalo de nuevo."}
            {analyzeError === "timeout" &&
              "La IA no respondió a tiempo. Puedes reintentar o completar el alimento manualmente."}
            {analyzeError === "unknown" &&
              "Ocurrió un problema al analizar la foto. Puedes reintentar o completar el alimento manualmente."}
          </p>

          <div className="flex flex-col gap-2">
            {(analyzeError === "network" ||
              analyzeError === "timeout" ||
              analyzeError === "unknown" ||
              (analyzeError === "rate_limit" && rateInfo?.scope !== "day")) && (
              <GlassButton
                size="md"
                className="w-full flex items-center justify-center gap-1.5"
                onClick={() => {
                  setAnalyzeError(null);
                  retryAnalyze();
                }}
              >
                <RotateCcw size={14} /> Reintentar
              </GlassButton>
            )}
            {analyzeError === "rate_limit" ? (
              <GlassButton size="md" variant="outline" className="w-full" onClick={goToManualSearch}>
                Buscar alimento manualmente
              </GlassButton>
            ) : (
              <GlassButton size="md" variant="outline" className="w-full" onClick={goToManualCreate}>
                Completar manualmente
              </GlassButton>
            )}
          </div>
        </div>
      </ExpandSheet>
    </div>
  );
}
