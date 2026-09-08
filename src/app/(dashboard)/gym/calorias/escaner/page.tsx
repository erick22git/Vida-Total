"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera as CameraIcon, RotateCcw } from "lucide-react";
import { CaloriasMethodNav } from "@/components/gym/calorias-method-nav";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";

type Mode = "foto" | "codigo";

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  image_front_url?: string;
}

export default function EscanerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<import("@zxing/library").BrowserMultiFormatReader | null>(null);

  const [mode, setMode] = useState<Mode>("codigo");
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied" | "error">("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const addCustomFood = useGymStore((s) => s.addCustomFood);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current?.reset();
  }, []);

  const startCamera = useCallback(async () => {
    setStatus(null);
    try {
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
    try {
      sessionStorage.setItem("vt-scanned-photo", dataUrl);
    } catch {
      // sessionStorage unavailable — proceed without the photo attached.
    }
    stopCamera();
    router.push("/gym/calorias/crear-alimento?fromScan=1");
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
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
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
              <button
                onClick={capturePhoto}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-90 transition-transform cursor-pointer"
                aria-label="Capturar foto"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
