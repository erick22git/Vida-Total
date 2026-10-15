"use client";

/**
 * Fase C/D del roadmap de cámara en vivo (docs/roadmap/vision-entrenador.md). Video + esqueleto
 * superpuesto (verde/rojo según el ángulo citado en la fuente, sección 2.1.3), zoom y pantalla
 * completa.
 *
 * Dos formas de entrar:
 * - Directo (sin query params): modo prototipo suelto, elegís el ejercicio acá mismo, el conteo se
 *   muestra pero no se guarda en ningún lado (comportamiento original de la Fase C).
 * - Desde una serie real (`?exercise=&camSetId=&returnTo=`, hoy solo desde
 *   /gym/entrenamiento/activo vía el botón "Cámara" — sección 2.1.8, Opción 2): el ejercicio queda
 *   fijo, aparece una barra para confirmar las reps detectadas, y solo al tocar "Confirmar" se
 *   vuelve a `returnTo` con el número — la pantalla de origen es quien de verdad escribe el campo
 *   de reps, esto nunca lo hace por su cuenta.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Maximize2, Minimize2, Plus, Minus, RotateCcw, AlertTriangle, Check } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { useCameraCalibrationStore } from "@/lib/store/cameraCalibrationStore";
import { deviceFingerprint, shouldRecalibrate, type DeviceCalibrationResult } from "@/lib/camara/device-calibration";
import { calibrateDevice } from "@/lib/camara/run-calibration";
import { getPoseLandmarker } from "@/lib/camara/pose-landmarker-singleton";
import { kneeAngleWithSide, elbowAngleWithSide } from "@/lib/camara/pose-landmarks";
import { initRepCounter, stepRepCounter, type RepCounterState } from "@/lib/camara/rep-counter";
import { CAMERA_EXERCISE_CONFIGS, type CameraExerciseId } from "@/lib/camara/exercise-configs";
import { formVerdict, segmentVerdicts, SKELETON_SEGMENTS, type FormVerdict } from "@/lib/camara/overlay-segments";
import { nextShallowRepStreak, shouldSuggestTechniqueNote } from "@/lib/camara/technique-tracker";
import { MALA_TECNICA } from "@/components/gym/set-type-modal";

function isCameraExerciseId(value: string | null): value is CameraExerciseId {
  return !!value && value in CAMERA_EXERCISE_CONFIGS;
}

type Status = "starting" | "camera_denied" | "calibrating" | "ready" | "fallback_manual";

const EXERCISE_LABELS: Record<CameraExerciseId, string> = {
  sentadilla: "Sentadilla",
  peso_muerto: "Peso muerto",
  press_banca: "Press banca",
  curl_biceps: "Curl bíceps",
};
const EXERCISE_ORDER: CameraExerciseId[] = ["sentadilla", "peso_muerto", "press_banca", "curl_biceps"];

const VERDICT_COLOR: Record<FormVerdict, string> = {
  ok: "#4ade80",
  insufficient: "#f87171",
  neutral: "rgba(255,255,255,0.85)",
};

export default function CamaraEntrenadorPage() {
  return (
    <Suspense fallback={null}>
      <CamaraEntrenadorContent />
    </Suspense>
  );
}

function CamaraEntrenadorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseParam = searchParams.get("exercise");
  const linkedExercise = isCameraExerciseId(exerciseParam) ? exerciseParam : null;
  const camSetId = searchParams.get("camSetId");
  const returnTo = searchParams.get("returnTo");
  // Solo tiene sentido ofrecer "Confirmar" cuando venimos de una serie real con todo lo necesario
  // para volver y aplicarlo — si falta alguno de los tres, se queda en modo prototipo suelto.
  const linkedToRealSet = !!linkedExercise && !!camSetId && !!returnTo;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const [exerciseId, setExerciseId] = useState<CameraExerciseId>(linkedExercise ?? "sentadilla");
  const exerciseIdRef = useRef(exerciseId);
  const repStateRef = useRef<RepCounterState>(initRepCounter(CAMERA_EXERCISE_CONFIGS[exerciseId]));

  const [status, setStatus] = useState<Status>("starting");
  const [calibrationInfo, setCalibrationInfo] = useState<DeviceCalibrationResult | null>(null);
  const [reps, setReps] = useState(0);
  const [verdict, setVerdict] = useState<FormVerdict>("neutral");

  // Fase E: racha de repeticiones que no llegaron a la profundidad citada — sugiere la nota "mala
  // técnica" solo cuando se repite seguido (sección technique-tracker.ts), nunca por un intento
  // aislado. `techniqueNoteWanted` es la decisión del usuario sobre esa sugerencia, se manda junto
  // con la confirmación de reps — nunca se escribe sola.
  const shallowStreakRef = useRef(0);
  const [techniqueSuggestion, setTechniqueSuggestion] = useState(false);
  const [techniqueNoteWanted, setTechniqueNoteWanted] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const calibration = useCameraCalibrationStore((s) => s.calibration);
  const setCalibration = useCameraCalibrationStore((s) => s.setCalibration);

  const selectExercise = useCallback((id: CameraExerciseId) => {
    exerciseIdRef.current = id;
    repStateRef.current = initRepCounter(CAMERA_EXERCISE_CONFIGS[id]);
    shallowStreakRef.current = 0;
    setTechniqueSuggestion(false);
    setTechniqueNoteWanted(false);
    setExerciseId(id);
    setReps(0);
    setVerdict("neutral");
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
  }, []);

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = zoomCaps ? Math.max(zoomCaps.min, Math.min(zoomCaps.max, next)) : Math.max(1, Math.min(4, next));
      setZoom(clamped);
      if (zoomCaps) {
        trackRef.current?.applyConstraints({ advanced: [{ zoom: clamped }] } as unknown as MediaTrackConstraints).catch(() => {});
      }
    },
    [zoomCaps],
  );

  function pinchDistance(touches: React.TouchList | TouchList) {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  const drawFrame = useCallback(
    (
      landmarks: ReadonlyArray<{ x: number; y: number; visibility?: number }> | undefined,
      segments: Map<string, FormVerdict> | null,
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !video || !ctx) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || canvas.width;
        canvas.height = video.videoHeight || canvas.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks || landmarks.length === 0) return;

      const toPx = (i: number) => ({ x: landmarks[i].x * canvas.width, y: landmarks[i].y * canvas.height });
      const visible = (i: number) => (landmarks[i]?.visibility ?? 1) > 0.4;

      for (const [a, b] of SKELETON_SEGMENTS) {
        if (!visible(a) || !visible(b)) continue;
        const color = segments?.get(`${a}-${b}`) ?? "neutral";
        const pa = toPx(a);
        const pb = toPx(b);
        ctx.strokeStyle = VERDICT_COLOR[color as FormVerdict];
        ctx.lineWidth = color === "neutral" ? 3 : 5;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < landmarks.length; i++) {
        if (!visible(i)) continue;
        const p = toPx(i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const startDetectionLoop = useCallback(async () => {
    const landmarker = await getPoseLandmarker();
    const video = videoRef.current;
    if (!video) return;
    runningRef.current = true;

    function tick() {
      if (!runningRef.current || !video) return;
      if (video.readyState >= 2) {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.landmarks[0];
        const config = CAMERA_EXERCISE_CONFIGS[exerciseIdRef.current];

        if (landmarks) {
          const { angle, side } =
            config.joint === "knee" ? kneeAngleWithSide(landmarks) : elbowAngleWithSide(landmarks);
          const prevState = repStateRef.current;
          const nextState = stepRepCounter(prevState, angle, config);
          const changed = nextState.reps !== prevState.reps || nextState.phase !== prevState.phase;
          repStateRef.current = nextState;
          const v = formVerdict(nextState, config);
          const segments = segmentVerdicts(side, config.joint, v);
          drawFrame(landmarks, segments);
          if (changed) {
            setReps(nextState.reps);
            setVerdict(v);

            const streak = nextShallowRepStreak(prevState, nextState, config, shallowStreakRef.current);
            shallowStreakRef.current = streak;
            if (shouldSuggestTechniqueNote(streak)) {
              shallowStreakRef.current = 0;
              setTechniqueSuggestion(true);
            }
          }
        } else {
          drawFrame(undefined, null);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [drawFrame]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number } }) | undefined;
        const z = caps?.zoom as unknown as { min: number; max: number; step: number } | undefined;
        setZoomCaps(z && z.max > z.min ? { min: z.min, max: z.max, step: z.step || 0.1 } : null);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }

        const fingerprint = deviceFingerprint(navigator.userAgent, window.innerWidth, window.innerHeight);
        let result = calibration;
        if (shouldRecalibrate(result, fingerprint)) {
          setStatus("calibrating");
          result = await calibrateDevice(video!, track);
          if (cancelled) return;
          setCalibration(result);
        } else if (result?.resolution) {
          try {
            await track.applyConstraints({ width: { ideal: result.resolution.width }, height: { ideal: result.resolution.height } });
          } catch {
            // Si no acepta la resolución guardada, se sigue con la que el track ya tenga.
          }
        }

        if (cancelled) return;
        setCalibrationInfo(result ?? null);
        if (!result?.passed) {
          setStatus("fallback_manual");
          return;
        }
        setStatus("ready");
        startDetectionLoop();
      } catch (err) {
        console.warn("[camara-entrenador] init error", err);
        if (!cancelled) setStatus("camera_denied");
      }
    }

    init();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }

  function goBack() {
    stopCamera();
    router.back();
  }

  /** El único lugar donde se decide volver con un número — nunca se dispara solo, siempre por este
   * botón (sección 2.1.8, Opción 2: "la cámara sugiere, el usuario confirma"). */
  function confirmRepsAndReturn() {
    if (!returnTo || !camSetId) return;
    stopCamera();
    const separator = returnTo.includes("?") ? "&" : "?";
    const notaParam = techniqueNoteWanted ? "&camNota=1" : "";
    router.push(`${returnTo}${separator}camSetId=${camSetId}&camReps=${reps}${notaParam}`);
  }

  const config = CAMERA_EXERCISE_CONFIGS[exerciseId];

  return (
    <div ref={containerRef} className="fixed inset-0 z-[45] overflow-hidden bg-black text-white select-none touch-none">
      {/* Visor */}
      <div
        className="absolute inset-0"
        onTouchStart={(e) => {
          if (e.touches.length !== 2) return;
          pinchRef.current = { startDist: pinchDistance(e.touches), startZoom: zoom };
        }}
        onTouchMove={(e) => {
          if (!pinchRef.current || e.touches.length !== 2) return;
          e.preventDefault();
          const { startDist, startZoom } = pinchRef.current;
          if (startDist <= 0) return;
          applyZoom(startZoom * (pinchDistance(e.touches) / startDist));
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) pinchRef.current = null;
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          style={{ transform: zoomCaps ? undefined : `scale(${zoom})`, transformOrigin: "center" }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Barra superior */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={goBack}
          aria-label="Volver"
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} />
        </button>
        {linkedExercise ? (
          // Viene de una serie real: el ejercicio ya quedó decidido allá, no se puede cambiar acá
          // (cambiarlo rompería la relación con el `camSetId` al que se va a volver).
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/50">{EXERCISE_LABELS[exerciseId]}</div>
        ) : (
          <div className="flex gap-1.5 bg-black/50 rounded-full p-1">
            {EXERCISE_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => selectExercise(id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
                style={{ background: id === exerciseId ? "var(--gym, #22c55e)" : "transparent", color: id === exerciseId ? "#052e16" : "white" }}
              >
                {EXERCISE_LABELS[id]}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          aria-label="Pantalla completa"
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Estados no "ready" */}
      {status === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white/80">
          Iniciando cámara...
        </div>
      )}
      {status === "camera_denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center">
          <AlertTriangle size={28} className="text-white/60" />
          <p className="text-sm text-white/80">No pudimos acceder a tu cámara. Revisá los permisos del navegador.</p>
          <GlassButton size="sm" onClick={() => router.back()} className="flex items-center gap-1.5">
            <RotateCcw size={14} /> Volver
          </GlassButton>
        </div>
      )}
      {status === "calibrating" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
          <p className="text-sm text-white/80">Midiendo cuánto aguanta tu teléfono el análisis en vivo...</p>
        </div>
      )}
      {status === "fallback_manual" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-8 text-center">
          <AlertTriangle size={28} className="text-amber-400" />
          <p className="text-sm text-white font-medium">
            Tu teléfono no puede sostener el análisis en vivo (medido en {calibrationInfo?.fps.toFixed(0)} fps).
          </p>
          <p className="text-xs text-white/60">Usá el registro manual por ahora.</p>
          <GlassButton size="sm" onClick={goBack} className="mt-1">
            Volver al registro manual
          </GlassButton>
        </div>
      )}

      {/* Controles y contador — solo con cámara en vivo activa */}
      {status === "ready" && (
        <>
          {/* Fase E: aparece solo cuando varias repeticiones SEGUIDAS no llegaron a la
              profundidad citada — nunca por un intento aislado (technique-tracker.ts). */}
          {techniqueSuggestion && (
            <div className="absolute top-20 left-4 right-4 flex flex-col gap-2 bg-black/80 rounded-2xl p-3.5">
              <p className="text-sm text-white">
                Varias repeticiones no llegaron a la profundidad esperada. ¿Marcar &ldquo;{MALA_TECNICA}&rdquo; en esta serie?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTechniqueNoteWanted(true);
                    setTechniqueSuggestion(false);
                  }}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold cursor-pointer"
                  style={{ background: "#ef4444", color: "white" }}
                >
                  Marcar
                </button>
                <button
                  onClick={() => setTechniqueSuggestion(false)}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold cursor-pointer bg-white/10 text-white/80"
                >
                  No, gracias
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-2">
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              {linkedToRealSet ? "Conectado a tu serie — nada se guarda hasta que confirmes" : "Prototipo — no guarda en tu registro todavía"}
            </p>
            <div className="flex items-center gap-3 bg-black/55 rounded-2xl px-5 py-2.5">
              <span className="text-3xl font-bold tabular-nums">{reps}</span>
              <span className="text-xs text-white/70">reps detectadas</span>
              {config.hasFormValidation && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: VERDICT_COLOR[verdict], color: "#052e16" }}
                >
                  {verdict === "ok" ? "Profundidad OK" : verdict === "insufficient" ? "No llegó a profundidad" : "..."}
                </span>
              )}
            </div>
            {techniqueNoteWanted && (
              <button
                onClick={() => setTechniqueNoteWanted(false)}
                className="text-xs text-white/70 bg-white/10 rounded-full px-3 py-1 cursor-pointer"
              >
                + nota &ldquo;{MALA_TECNICA}&rdquo; (tocá para quitarla)
              </button>
            )}
            {linkedToRealSet && (
              <button
                onClick={confirmRepsAndReturn}
                disabled={reps === 0}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default active:scale-95 transition-transform"
                style={{ background: "#22c55e", color: "#052e16" }}
              >
                <Check size={16} /> Confirmar {reps} {reps === 1 ? "repetición" : "repeticiones"}
              </button>
            )}
          </div>

          <div className="absolute bottom-6 right-4 flex flex-col items-center bg-black/55 rounded-xl overflow-hidden">
            <button onClick={() => applyZoom(zoom + (zoomCaps?.step ?? 0.25))} aria-label="Acercar" className="w-10 h-10 flex items-center justify-center cursor-pointer active:scale-95">
              <Plus size={16} />
            </button>
            <span className="text-[10px] text-white/60 tabular-nums pb-0.5">{zoom.toFixed(1)}×</span>
            <button onClick={() => applyZoom(zoom - (zoomCaps?.step ?? 0.25))} aria-label="Alejar" className="w-10 h-10 flex items-center justify-center cursor-pointer active:scale-95">
              <Minus size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
