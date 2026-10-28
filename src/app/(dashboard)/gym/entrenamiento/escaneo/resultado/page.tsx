"use client";

/**
 * Cierre del escaneo corporal: guarda la foto como tu foto de progreso del mes y registra tu peso de hoy. Antes
 * esta pantalla mostraba métricas inventadas (aleatorias y borrosas) y no guardaba nada; ahora no inventa
 * resultados: solo guarda lo que tú aportas (la foto y tu peso). El análisis por IA no está disponible todavía.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGymStore } from "@/lib/store/gymStore";
import { format } from "date-fns";

const SCAN_PHOTO_KEY = "vt-scan-photo";

export default function BodyScanResultPage() {
  const router = useRouter();
  const setProgressPhoto = useGymStore((s) => s.setProgressPhoto);
  const addWeightEntry = useGymStore((s) => s.addWeightEntry);
  const latestKg = useGymStore((s) => s.weightEntries[0]?.kg ?? s.gymProfile?.pesoKg);
  const [photo, setPhoto] = useState<string | null>(null);
  const [weight, setWeight] = useState(latestKg ? String(latestKg) : "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del sessionStorage al montar
      setPhoto(sessionStorage.getItem(SCAN_PHOTO_KEY));
    } catch {
      /* sin sessionStorage: se muestra sin foto */
    }
  }, []);

  const kg = parseFloat(weight.replace(",", "."));
  const kgValid = Number.isFinite(kg) && kg >= 20 && kg <= 400;

  function save() {
    if (photo) setProgressPhoto(format(new Date(), "yyyy-MM"), photo);
    if (kgValid && kg !== latestKg) addWeightEntry(Math.round(kg * 10) / 10);
    try {
      sessionStorage.removeItem(SCAN_PHOTO_KEY);
    } catch {
      /* ignorar */
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{saved ? "¡Escaneo guardado!" : "Guardar escaneo"}</h1>
        <p className="text-sm text-white/50">{saved ? "Ya aparece en tu perfil." : "Foto de hoy + tu peso, para ver tu progreso con el tiempo."}</p>
      </header>

      <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-white/[0.05] flex items-center justify-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Tu foto del escaneo" className="w-full h-full object-contain" />
        ) : (
          <p className="text-white/35 text-sm px-6 text-center">No hay foto para guardar. Vuelve y toma una.</p>
        )}
      </div>

      {!saved && (
        <>
          <label className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3">
            <span className="text-sm text-white/70">Peso de hoy</span>
            <span className="flex items-baseline gap-1.5">
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                aria-label="Peso en kilogramos"
                className="w-20 bg-transparent text-right text-xl font-bold text-white outline-none tabular-nums"
              />
              <span className="text-sm text-white/45">kg</span>
            </span>
          </label>
          <p className="text-[11px] text-white/40 -mt-3">
            El análisis de físico con IA (simetría, definición…) todavía no está disponible: no se inventan puntajes.
          </p>
          <button
            onClick={save}
            disabled={!photo && !kgValid}
            className="min-h-[52px] rounded-2xl bg-white text-black text-base font-bold cursor-pointer disabled:opacity-35"
          >
            Guardar en mi perfil
          </button>
        </>
      )}
      {saved && (
        <button onClick={() => router.push("/gym/entrenamiento/perfil")} className="min-h-[52px] rounded-2xl bg-white text-black text-base font-bold cursor-pointer">
          Ir a mi perfil
        </button>
      )}
      {!saved && (
        <button onClick={() => router.back()} className="text-center text-sm text-white/45 hover:text-white/70 cursor-pointer">
          Volver atrás
        </button>
      )}
    </div>
  );
}
