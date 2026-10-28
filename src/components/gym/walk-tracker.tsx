"use client";

/**
 * Caminata con GPS: empezar/parar como un reloj deportivo, mostrando distancia/tiempo/calorías en
 * vivo y el recorrido en el mapa (`walk-map.tsx`). Usa `navigator.geolocation.watchPosition` (nativo
 * del navegador, gratis, sin API de pago) — pide permiso de ubicación la primera vez que se aprieta
 * "Empezar".
 *
 * No se pierde lo caminado aunque se corte internet, se cierre la app o se caiga el servidor:
 *  - Al empezar se guarda el PUNTO DE INICIO en el momento (antes de esperar al seguimiento continuo), y
 *    al parar se pide un PUNTO FINAL; entre los dos queda el recorrido. Todo vive en el store persistido
 *    del dispositivo (no depende del servidor), así que la distancia se puede calcular solo con inicio y fin
 *    (en línea recta) si el seguimiento intermedio falló.
 *  - Si la app se cierra con una caminata en curso, al volver se retoma el seguimiento; si ya no llegaron
 *    puntos en 5 min se cierra sola con lo último guardado.
 *  - Si te quedas quieto 5 min (≤ 30 m) la caminata se cierra sola; el tiempo y los km llegan hasta el último
 *    movimiento y el punto final es donde quedaste.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Play, Square } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { MAX_ACCURACY_M, STILL_MS, isStationary, summarizeWalk, type GeoPoint } from "@/lib/geo/walk-tracking";
import type { WalkSession } from "@/lib/types";

const WalkMap = dynamic(() => import("./walk-map").then((m) => m.WalkMap), { ssr: false });

function formatDuration(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.round(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const END_NOTE: Record<NonNullable<WalkSession["endReason"]>, string> = {
  manual: "",
  inactividad: "Se cerró sola: te quedaste quieto 5 min.",
  sin_senal: "Se cerró sola: se perdió la señal o se cerró la app.",
};

export function WalkTracker() {
  const activeWalk = useGymStore((s) => s.activeWalk);
  const startWalkSession = useGymStore((s) => s.startWalkSession);
  const addWalkPoint = useGymStore((s) => s.addWalkPoint);
  const finishWalkSession = useGymStore((s) => s.finishWalkSession);
  const discardActiveWalk = useGymStore((s) => s.discardActiveWalk);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const pesoCorporalKg = gymProfile?.pesoKg ?? 0;
  const lastEnded = useGymStore((s) => s.walkSessions[0]);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const [, setTick] = useState(0); // fuerza recalcular el resumen en vivo (tiempo transcurrido) cada pocos segundos

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > MAX_ACCURACY_M) return; // salto de GPS: no sumar distancia falsa
        addWalkPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestampMs: Date.now() });
      },
      (err) => setGeoError(err.message || "No se pudo acceder a tu ubicación."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, [addWalkPoint]);

  /** Cierra la caminata con los puntos que haya YA guardados en el store (nunca depende de la red). */
  const closeWalk = useCallback(
    (reason: NonNullable<WalkSession["endReason"]>) => {
      const walk = useGymStore.getState().activeWalk;
      clearWatch();
      if (!walk) return;
      const summary = summarizeWalk(walk.points as GeoPoint[], pesoCorporalKg);
      finishWalkSession({ ...summary, endReason: reason });
    },
    [clearWatch, finishWalkSession, pesoCorporalKg],
  );

  // Cada 3 s: refresca el resumen y revisa si hay que cerrar sola (quieto / sin señal).
  useEffect(() => {
    if (!activeWalk) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const walk = useGymStore.getState().activeWalk;
      if (!walk || finishingRef.current) return;
      const pts = walk.points as GeoPoint[];
      if (isStationary(pts, Date.now())) {
        const lastAge = Date.now() - pts[pts.length - 1].timestampMs;
        closeWalk(lastAge > STILL_MS ? "sin_senal" : "inactividad");
      }
    }, 3000);
    return () => clearInterval(id);
  }, [activeWalk, closeWalk]);

  // App reabierta con una caminata en curso: el watch se perdió con la pestaña, hay que volver a armarlo.
  const hasActive = !!activeWalk;
  useEffect(() => {
    if (hasActive) startWatch();
    return () => clearWatch();
  }, [hasActive, startWatch, clearWatch]);

  function handleStart() {
    if (!navigator.geolocation) {
      setGeoError("Este navegador no soporta geolocalización.");
      return;
    }
    setGeoError(null);
    finishingRef.current = false;
    startWalkSession();
    // Punto de inicio inmediato: queda guardado aunque el seguimiento continuo falle o se corte internet después.
    navigator.geolocation.getCurrentPosition(
      (pos) => addWalkPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestampMs: Date.now() }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
    // El useEffect de arriba arma el watch en cuanto `activeWalk` existe.
  }

  function handleStop() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setStopping(true);
    const done = () => {
      closeWalk("manual");
      setStopping(false);
    };
    if (!navigator.geolocation) {
      done();
      return;
    }
    // Punto final: la posición de ahora; si no se logra en pocos segundos se cierra con el último punto guardado.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        addWalkPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestampMs: Date.now() });
        done();
      },
      done,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 6000 },
    );
  }

  function handleDiscard() {
    clearWatch();
    discardActiveWalk();
  }

  const livePoints = (activeWalk?.points ?? []) as GeoPoint[];
  const liveSummary = activeWalk ? summarizeWalk(livePoints, pesoCorporalKg) : null;
  const first = livePoints[0];
  const last = livePoints[livePoints.length - 1];

  return (
    <div className="flex flex-col gap-3">
      {activeWalk ? (
        <>
          <WalkMap points={livePoints} />
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
          <p className="flex items-center gap-1.5 text-[11px] text-white/45">
            <MapPin size={12} />
            {first ? `Inicio guardado ${first.lat.toFixed(5)}, ${first.lng.toFixed(5)}` : "Buscando tu punto de inicio…"}
            {last && last !== first ? ` · último punto ${new Date(last.timestampMs).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleStop}
              disabled={stopping}
              className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold cursor-pointer bg-white text-black disabled:opacity-60"
            >
              <Square size={14} /> {stopping ? "Marcando punto final…" : "Parar"}
            </button>
            <button onClick={handleDiscard} className="rounded-full px-4 py-3 text-sm cursor-pointer bg-white/10 text-white/70">
              Descartar
            </button>
          </div>
          {!pesoCorporalKg && <p className="text-[11px] text-amber-200/70">Agregá tu peso en el perfil para calcular las calorías de esta caminata.</p>}
        </>
      ) : (
        <>
          <button
            onClick={handleStart}
            className="flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black"
          >
            <Play size={16} /> Empezar a caminar
          </button>
          {lastEnded?.endReason && lastEnded.endReason !== "manual" && (
            <p className="text-[11px] text-white/50">
              Última caminata: {lastEnded.distanceKm?.toFixed(2) ?? "0.00"} km guardados. {END_NOTE[lastEnded.endReason]}
            </p>
          )}
        </>
      )}
      {geoError && <p className="text-xs text-red-300">{geoError}</p>}
    </div>
  );
}
