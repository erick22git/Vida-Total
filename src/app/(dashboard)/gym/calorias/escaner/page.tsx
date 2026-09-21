"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera as CameraIcon, RotateCcw, Sparkles } from "lucide-react";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassModal } from "@/components/glass/glass-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";
import type { AnalyzedFoodItem } from "@/app/api/food/analyze/route";

type Mode = "foto" | "codigo";

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  image_front_url?: string;
}

type AnalyzeErrorKind = "no_api_key" | "rate_limit" | "network" | "timeout" | "unknown";

const ANALYZE_TIMEOUT_MS = 15000;

/** sessionStorage keys shared with crear-alimento (fallback) and resultados (AI results). */
const PHOTO_KEY = "vt-scanned-photo";
const RESULTS_KEY = "vt-scan-results";

export default function EscanerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<import("@zxing/library").BrowserMultiFormatReader | null>(null);

  const [mode, setMode] = useState<Mode>("foto");
  const prevModeRef = useRef<Mode>("foto");
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied" | "error">("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Modo Foto: análisis con IA de visión (Groq).
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<AnalyzeErrorKind | null>(null);

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
          router.push(`/gym/calorias/alimento/${created.id}`);
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
    [addCustomFood, router, stopCamera],
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
    router.push("/gym/calorias/buscar");
  }, [router, stopCamera]);

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
      };

      if (!res.ok || !data.items) {
        if (data.error === "no_api_key") {
          setAnalyzeError("no_api_key");
        } else if (data.error === "rate_limit" || res.status === 429) {
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
      router.push("/gym/calorias/escaner/resultados");
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    persistPhotoForFallback(dataUrl);
    stopCamera();
    setCapturedPhoto(dataUrl);
    analyzePhoto(dataUrl);
  }

  function retryAnalyze() {
    if (!capturedPhoto) return;
    analyzePhoto(capturedPhoto);
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" className="text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Escáner</h1>
      </header>

      <CaloriasMethodNav />

      <div className="relative w-full aspect-[3/4] max-h-[70vh] rounded-3xl overflow-hidden bg-black flex items-center justify-center">
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

            {mode === "codigo" && (
              <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-24 border-2 border-white/70 rounded-2xl" />
            )}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md p-1">
              {(["foto", "codigo"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    mode === m ? "text-white" : "text-white/60",
                  )}
                  style={mode === m ? { background: "var(--gym)" } : undefined}
                >
                  {m === "foto" ? "Foto" : "Código"}
                </button>
              ))}
            </div>

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

            {mode === "foto" && (
              <>
                <p className="absolute bottom-20 left-4 right-4 text-center text-xs text-white/60">
                  Encuadra el plato y toma la foto para identificar los alimentos
                </p>
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-90 transition-transform cursor-pointer"
                  aria-label="Capturar foto"
                />
              </>
            )}
          </>
        )}
      </div>

      <GlassModal
        open={analyzeError !== null}
        onClose={() => setAnalyzeError(null)}
        title={
          analyzeError === "rate_limit"
            ? "Límite de análisis alcanzado"
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
              "Se alcanzó el límite de análisis por hoy. Intenta mañana o agrega el alimento manualmente."}
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
            {(analyzeError === "network" || analyzeError === "timeout" || analyzeError === "unknown") && (
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
      </GlassModal>
    </div>
  );
}
