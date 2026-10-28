"use client";

/**
 * Cámara de vasos: se le toma foto a un vaso/botella/termo y la IA (misma ruta de visión que el escáner de
 * comidas, otro prompt — /api/water/measure) estima su capacidad en ml. Todo es editable antes de confirmar
 * porque la estimación por foto es aproximada (si el recipiente tiene la medida impresa, usa esa).
 */
import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { GlassInput } from "@/components/glass/glass-input";
import { clampVesselMl, resizeImage } from "@/lib/gym/water-vessels";
import type { MeasuredVessel } from "@/app/api/water/measure/route";

export interface VesselDraft {
  nombre: string;
  ml: number;
  foto?: string;
}

type Phase = "pick" | "loading" | "confirm";

const ERRORS: Record<string, string> = {
  no_api_key: "La IA no está configurada (falta la clave del servidor). Puedes poner los ml a mano.",
  rate_limit: "La IA llegó a su límite por ahora. Puedes poner los ml a mano.",
  invalid_image: "No pude leer esa foto. Prueba con otra o pon los ml a mano.",
};

export function VesselCameraSheet({
  open,
  onClose,
  onAddOnce,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Agrega esos ml al agua de hoy sin guardar el vaso. */
  onAddOnce?: (v: VesselDraft) => void;
  /** Guarda el vaso en "Mis vasos" (y, si el padre quiere, también lo agrega). */
  onSave?: (v: VesselDraft) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [mlText, setMlText] = useState("");
  const [foto, setFoto] = useState<string | undefined>();
  const [meta, setMeta] = useState<MeasuredVessel | null>(null);

  function reset() {
    setPhase("pick");
    setError(null);
    setNombre("");
    setMlText("");
    setFoto(undefined);
    setMeta(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    setPhase("loading");
    try {
      const [big, thumb] = await Promise.all([resizeImage(file, 1024, 0.8), resizeImage(file, 120, 0.7)]);
      setFoto(thumb);
      const res = await fetch("/api/water/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: big }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<MeasuredVessel> & { error?: string };
      if (!res.ok || !data.ml) {
        setError(ERRORS[data.error ?? ""] ?? "No pude estimar el tamaño. Pon los ml a mano.");
        setNombre("Mi vaso");
        setMlText("");
      } else {
        setMeta(data as MeasuredVessel);
        setNombre(data.name ?? "Mi vaso");
        setMlText(String(data.ml));
      }
    } catch {
      setError("No se pudo procesar la foto. Pon los ml a mano.");
      setNombre("Mi vaso");
    }
    setPhase("confirm");
  }

  const ml = clampVesselMl(parseFloat(mlText) || 0);
  const valid = (parseFloat(mlText) || 0) > 0;
  const draft: VesselDraft = { nombre: nombre.trim() || "Mi vaso", ml, foto };

  return (
    <ExpandSheet open={open} onClose={close} title="Medir con la cámara">
      <div className="flex flex-col gap-4 pb-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />

        {phase === "pick" && (
          <>
            <p className="text-sm text-white/65 leading-relaxed">
              Toma una foto de tu vaso, botella o termo. Si se ve la etiqueta con los ml, la IA usa ese dato; si no, lo
              estima por su forma y tamaño. Luego puedes corregirlo.
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold bg-white text-black cursor-pointer active:scale-[0.98] transition-transform"
            >
              <Camera size={20} /> Tomar foto
            </button>
          </>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8 text-white/70">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Calculando cuántos ml caben…</span>
          </div>
        )}

        {phase === "confirm" && (
          <>
            <div className="flex items-center gap-3">
              {foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="w-16 h-16 rounded-xl object-cover" />
              )}
              <div className="flex-1 text-xs text-white/60">
                {meta ? (
                  <>
                    Estimación de la IA · confianza <b className="text-white/85">{meta.confidence}</b>
                    {meta.note ? ` · ${meta.note}` : ""}
                  </>
                ) : (
                  error
                )}
              </div>
            </div>
            <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Termo)" />
            <GlassInput
              type="number"
              inputMode="numeric"
              value={mlText}
              onChange={(e) => setMlText(e.target.value)}
              placeholder="ml"
            />
            <p className="text-[11px] text-white/40 -mt-2">
              Una foto no mide con exactitud: si conoces la medida real (o la tiene impresa), corrígela.
            </p>
            {onAddOnce && (
              <button
                disabled={!valid}
                onClick={() => {
                  onAddOnce(draft);
                  close();
                }}
                className="rounded-2xl py-3.5 text-base font-semibold bg-white text-black cursor-pointer disabled:opacity-40"
              >
                Agregar {valid ? ml : ""} ml al agua de hoy
              </button>
            )}
            {onSave && (
              <button
                disabled={!valid}
                onClick={() => {
                  onSave(draft);
                  close();
                }}
                className="rounded-2xl py-3 text-sm font-medium border border-white/25 text-white cursor-pointer disabled:opacity-40"
              >
                Guardar como mi vaso
              </button>
            )}
            <button onClick={reset} className="text-xs text-white/50 underline cursor-pointer">
              Tomar otra foto
            </button>
          </>
        )}
      </div>
    </ExpandSheet>
  );
}
