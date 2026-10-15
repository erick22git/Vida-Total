"use client";

/**
 * Caminata con GPS: empezar/parar como un reloj deportivo, mostrando distancia/tiempo/calorías en
 * vivo y el recorrido en el mapa (`walk-map.tsx`). Usa `navigator.geolocation.watchPosition` (nativo
 * del navegador, gratis, sin API de pago) — pide permiso de ubicación la primera vez que se aprieta
 * "Empezar".
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Play, Square } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { summarizeWalk, type GeoPoint } from "@/lib/geo/walk-tracking";

const WalkMap = dynamic(() => import("./walk-map").then((m) => m.WalkMap), { ssr: false });

function formatDuration(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.round(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function WalkTracker() {
  const activeWalk = useGymStore((s) => s.activeWalk);
  const startWalkSession = useGymStore((s) => s.startWalkSession);
  const addWalkPoint = useGymStore((s) => s.addWalkPoint);
  const finishWalkSession = useGymStore((s) => s.finishWalkSession);
  const discardActiveWalk = useGymStore((s) => s.discardActiveWalk);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const pesoCorporalKg = gymProfile?.pesoKg ?? 0;

  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [, setTick] = useState(0); // fuerza recalcular el resumen en vivo (tiempo transcurrido) cada pocos segundos

  useEffect(() => {
    if (!activeWalk) return;
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [activeWalk]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    };
  }, []);

  function handleStart() {
    if (!navigator.geolocation) {
      setGeoError("Este navegador no soporta geolocalización.");
      return;
    }
    setGeoError(null);
    startWalkSession();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        addWalkPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestampMs: Date.now() });
      },
      (err) => setGeoError(err.message || "No se pudo acceder a tu ubicación."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  function handleStop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (activeWalk) {
      const summary = summarizeWalk(activeWalk.points as GeoPoint[], pesoCorporalKg);
      finishWalkSession(summary);
    }
  }

  function handleDiscard() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    discardActiveWalk();
  }

  const liveSummary = activeWalk ? summarizeWalk(activeWalk.points as GeoPoint[], pesoCorporalKg) : null;

  return (
    <div className="flex flex-col gap-3">
      {activeWalk ? (
        <>
          <WalkMap points={activeWalk.points as GeoPoint[]} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.05] py-2">
              <p className="text-lg font-semibold tabular-nums">{liveSummary?.distanceKm.toFixed(2) ?? "0.00"}</p>
              <p className="text-[10px] text-white/45 uppercase">km</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] py-2">
              <p className="text-lg font-semibold tabular-nums">{formatDuration(liveSummary?.durationSeconds ?? 0)}</p>
              <p className="text-[10px] text-white/45 uppercase">tiempo</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] py-2">
              <p className="text-lg font-semibold tabular-nums">{liveSummary?.kcal ?? 0}</p>
              <p className="text-[10px] text-white/45 uppercase">kcal</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold cursor-pointer bg-white text-black"
            >
              <Square size={14} /> Parar
            </button>
            <button onClick={handleDiscard} className="rounded-full px-4 py-3 text-sm cursor-pointer bg-white/10 text-white/70">
              Descartar
            </button>
          </div>
          {!pesoCorporalKg && <p className="text-[11px] text-amber-200/70">Agregá tu peso en el perfil para calcular las calorías de esta caminata.</p>}
        </>
      ) : (
        <button
          onClick={handleStart}
          className="flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black"
        >
          <Play size={16} /> Empezar a caminar
        </button>
      )}
      {geoError && <p className="text-xs text-red-300">{geoError}</p>}
    </div>
  );
}
