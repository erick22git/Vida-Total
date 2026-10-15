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
import { ArrowLeft, Maximize2, Minimize2, Plus, Minus, RotateCcw, AlertTriangle, Check, Volume2, VolumeX, Target, X as XIcon } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { useCameraCalibrationStore } from "@/lib/store/cameraCalibrationStore";
import { deviceFingerprint, shouldRecalibrate, type DeviceCalibrationResult } from "@/lib/camara/device-calibration";
import { calibrateDevice } from "@/lib/camara/run-calibration";
import { getPoseLandmarker } from "@/lib/camara/pose-landmarker-singleton";
import { kneeAngleOriented, elbowAngleOriented, detectOrientation, type Orientation, type Side } from "@/lib/camara/pose-landmarks";
import { smoothAngle, ANGLE_SMOOTHING_ALPHA } from "@/lib/camara/angle-smoother";
import { initGuardedRepCounter, stepGuardedRepCounter, MIN_REP_INTERVAL_MS, STARTUP_GRACE_MS } from "@/lib/camara/rep-counter-guard";
import { CAMERA_EXERCISE_CONFIGS, type CameraExerciseId } from "@/lib/camara/exercise-configs";
import { formVerdict, segmentVerdicts, SKELETON_SEGMENTS, type FormVerdict } from "@/lib/camara/overlay-segments";
import { nextShallowRepStreak, shouldSuggestTechniqueNote } from "@/lib/camara/technique-tracker";
import { bodyLineWidthScale } from "@/lib/camara/body-scale";
import { decideVoiceCue, voiceCuePhrase } from "@/lib/camara/voice-feedback";
import { speak, unlockVoice } from "@/lib/camara/voice-speak";
import { findMarker, DEFAULT_MARKER_CONFIG, type RgbColor } from "@/lib/camara/marker-tracker";
import { MALA_TECNICA } from "@/components/gym/set-type-modal";
import { useGymStore } from "@/lib/store/gymStore";

/** Cuántas posiciones recientes del marcador se dibujan como "cola" (sección 3.4/3.6 del
 * roadmap) — a ~20-30fps, ~40 puntos son 1.5-2s de recorrido, suficiente para ver la trayectoria
 * de la última repetición sin que la pantalla se llene de líneas viejas. */
const BAR_TRAIL_MAX_POINTS = 40;
/** Resolución fija y chica para el muestreo del marcador en cada frame — no hace falta la
 * resolución completa del video para encontrar un bloque de color, y leer menos píxeles por
 * frame es más liviano (sección 3.4: esto corre ADEMÁS de la detección de pose). */
const MARKER_SAMPLE_WIDTH = 160;
const MARKER_SAMPLE_HEIGHT = 120;

const ORIENTATION_LABEL: Record<Orientation, string> = {
  profile: "Vista: de costado",
  frontal: "Vista: de frente (promediando ambos lados)",
  unknown: "Ubicá la cámara de costado para mejor precisión",
};

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
  const repStateRef = useRef(initGuardedRepCounter(CAMERA_EXERCISE_CONFIGS[exerciseId]));

  // Arreglo del conteo de reps (roadmap sección 3.1/3.6): orientación detectada por z (perfil vs.
  // frente), lado fijado una vez por serie cuando es de perfil, y ángulo suavizado — en vez de
  // recalcular el lado en cada frame y usar el ángulo crudo, que era la causa real del sobre-conteo.
  const [orientation, setOrientation] = useState<Orientation>("unknown");
  const orientationRef = useRef<Orientation>("unknown");
  const lockedSideRef = useRef<Side | null>(null);
  const [lockedSideDisplay, setLockedSideDisplay] = useState<Side | null>(null);
  const smoothedAngleRef = useRef<number | null>(null);
  const [repFlash, setRepFlash] = useState(false);
  const repFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Corrección por voz en tiempo real (roadmap sección 3.5): anuncia el número de cada repetición
  // contada y avisa "más profundo" en el borde en que una sentadilla se corta antes de llegar a la
  // profundidad citada. El usuario puede silenciarla en cualquier momento.
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(voiceEnabled);
  const prevVerdictRef = useRef<FormVerdict>("neutral");
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Muchos navegadores de celular exigen que el primer `speak()` de la página ocurra dentro de un
  // gesto real del usuario, o lo descartan en silencio — por eso no se escuchaba nada. Un solo tap
  // en cualquier parte de la pantalla alcanza para desbloquearlo antes de que el conteo dispare el
  // primer aviso automático.
  useEffect(() => {
    function unlock() {
      unlockVoice();
      window.removeEventListener("pointerdown", unlock);
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Ventana de arranque (roadmap sección 3.6): ninguna repetición cuenta en los primeros
  // STARTUP_GRACE_MS desde que arranca el loop de detección — evita reps fantasma mientras la
  // cámara/el usuario todavía se están acomodando.
  const graceEndAtRef = useRef(0);

  // Seguimiento de barra/mancuerna por marcador de color (roadmap sección 3.4/3.6, punto 4) —
  // opcional, el usuario calibra tocando el marcador en la pantalla antes de usarlo. Canvas fuera
  // del DOM, solo para leer píxeles del video (nunca se muestra).
  const [calibratingMarker, setCalibratingMarker] = useState(false);
  const [markerColor, setMarkerColor] = useState<RgbColor | null>(null);
  const markerColorRef = useRef<RgbColor | null>(null);
  const markerSampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barTrailRef = useRef<{ x: number; y: number }[]>([]);

  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const calibration = useCameraCalibrationStore((s) => s.calibration);
  const setCalibration = useCameraCalibrationStore((s) => s.setCalibration);

  // Mejora visual: el esqueleto se dibuja más grueso o más fino según la altura/peso que el
  // usuario ya tiene en su perfil de entrenamiento — no un grosor de línea fijo para todos.
  const gymProfile = useGymStore((s) => s.gymProfile);
  const lineScale = bodyLineWidthScale(gymProfile?.alturaCm, gymProfile?.pesoKg);
  const lineScaleRef = useRef(lineScale);
  useEffect(() => {
    lineScaleRef.current = lineScale;
  }, [lineScale]);

  const selectExercise = useCallback((id: CameraExerciseId) => {
    exerciseIdRef.current = id;
    repStateRef.current = initGuardedRepCounter(CAMERA_EXERCISE_CONFIGS[id]);
    lockedSideRef.current = null;
    setLockedSideDisplay(null);
    smoothedAngleRef.current = null;
    shallowStreakRef.current = 0;
    prevVerdictRef.current = "neutral";
    barTrailRef.current = [];
    graceEndAtRef.current = performance.now() + STARTUP_GRACE_MS;
    setTechniqueSuggestion(false);
    setTechniqueNoteWanted(false);
    setExerciseId(id);
    setReps(0);
    setVerdict("neutral");
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (repFlashTimeoutRef.current) clearTimeout(repFlashTimeoutRef.current);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
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

  /** Toma el color exacto del punto tocado, leyendo el frame actual del video — un pixel alcanza,
   * un marcador de verdad ocupa muchos píxeles del mismo color alrededor del punto tocado. */
  function handleMarkerCalibrationTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!calibratingMarker) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return;

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = video.videoWidth;
    sampleCanvas.height = video.videoHeight;
    const sctx = sampleCanvas.getContext("2d");
    if (!sctx) return;
    sctx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const px = Math.min(Math.round(xRatio * sampleCanvas.width), sampleCanvas.width - 1);
    const py = Math.min(Math.round(yRatio * sampleCanvas.height), sampleCanvas.height - 1);
    const pixel = sctx.getImageData(px, py, 1, 1).data;
    const color: RgbColor = { r: pixel[0], g: pixel[1], b: pixel[2] };

    markerColorRef.current = color;
    setMarkerColor(color);
    barTrailRef.current = [];
    setCalibratingMarker(false);
  }

  function clearMarker() {
    markerColorRef.current = null;
    setMarkerColor(null);
    barTrailRef.current = [];
    setCalibratingMarker(false);
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

      // Grosor base proporcional a la resolución del video (para que se vea bien tanto en 640px
      // como si la cámara se degradó a 320px) y escalado por `lineScale` (altura/peso del
      // perfil) — "cápsulas" gruesas con contorno, no líneas finas de 1px ("palitos").
      const baseWidth = Math.max(6, canvas.width * 0.018) * lineScaleRef.current;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const [a, b] of SKELETON_SEGMENTS) {
        if (!visible(a) || !visible(b)) continue;
        const color = (segments?.get(`${a}-${b}`) ?? "neutral") as FormVerdict;
        const width = color === "neutral" ? baseWidth : baseWidth * 1.35;
        const pa = toPx(a);
        const pb = toPx(b);
        // Contorno oscuro primero, el color encima — le da volumen de "extremidad" en vez de una
        // línea plana sobre el video.
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = width + 4;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.strokeStyle = VERDICT_COLOR[color];
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const jointRadius = Math.max(4, baseWidth * 0.45);
      for (let i = 0; i < landmarks.length; i++) {
        if (!visible(i)) continue;
        const p = toPx(i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, jointRadius, 0, Math.PI * 2);
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
    graceEndAtRef.current = performance.now() + STARTUP_GRACE_MS;

    function tick() {
      if (!runningRef.current || !video) return;
      if (video.readyState >= 2) {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.landmarks[0];
        const config = CAMERA_EXERCISE_CONFIGS[exerciseIdRef.current];

        if (landmarks) {
          const currentOrientation = detectOrientation(landmarks);
          if (currentOrientation !== orientationRef.current) {
            orientationRef.current = currentOrientation;
            setOrientation(currentOrientation);
          }

          // "unknown" ya NO frena el conteo (ver roadmap sección 3.6 — la primera versión de este
          // arreglo lo hacía, y en la prueba real eso tapó la mayoría de las reps: 20 hechas, solo
          // 4 contadas, porque la cámara pasaba "unknown" seguido y el conteo se quedaba pausado).
          // "unknown"/"profile" sin lado fijado todavía caen en el mismo camino: elegir el lado más
          // visible en ESTE frame — el suavizado + el mínimo de tiempo entre reps ya amortiguan el
          // ruido de ese camino, así que no hace falta bloquear nada. El aviso de orientación queda
          // como indicación para acomodar la cámara, nunca como bloqueo.
          const { angle: rawAngle, trackedSide } =
            config.joint === "knee"
              ? kneeAngleOriented(landmarks, currentOrientation, lockedSideRef.current)
              : elbowAngleOriented(landmarks, currentOrientation, lockedSideRef.current);
          // De perfil, el lado se fija UNA sola vez por serie (la primera vez que hay una lectura
          // de perfil con confianza) — nunca se vuelve a recalcular frame a frame, que era la causa
          // real del "parpadeo" y el sobre-conteo original.
          if (currentOrientation === "profile" && lockedSideRef.current === null && trackedSide !== "both") {
            lockedSideRef.current = trackedSide;
            setLockedSideDisplay(trackedSide);
          }

          const smoothed = smoothAngle(smoothedAngleRef.current, rawAngle, ANGLE_SMOOTHING_ALPHA);
          smoothedAngleRef.current = smoothed;

          const prevState = repStateRef.current;
          const nextState = stepGuardedRepCounter(prevState, smoothed, config, now, MIN_REP_INTERVAL_MS, graceEndAtRef.current);
          const changed = nextState.core.reps !== prevState.core.reps || nextState.core.phase !== prevState.core.phase;
          repStateRef.current = nextState;
          const v = formVerdict(nextState.core, config);
          const segments = segmentVerdicts(trackedSide, config.joint, v);
          drawFrame(landmarks, segments);

          if (nextState.core.reps > prevState.core.reps) {
            setRepFlash(true);
            if (repFlashTimeoutRef.current) clearTimeout(repFlashTimeoutRef.current);
            repFlashTimeoutRef.current = setTimeout(() => setRepFlash(false), 350);
          }

          if (changed) {
            setReps(nextState.core.reps);
            setVerdict(v);

            if (voiceEnabledRef.current) {
              const cue = decideVoiceCue(prevState.core, nextState.core, config, prevVerdictRef.current, v);
              const phrase = voiceCuePhrase(cue);
              if (phrase) speak(phrase);
            }
            prevVerdictRef.current = v;

            const streak = nextShallowRepStreak(prevState.core, nextState.core, config, shallowStreakRef.current);
            shallowStreakRef.current = streak;
            if (shouldSuggestTechniqueNote(streak)) {
              shallowStreakRef.current = 0;
              setTechniqueSuggestion(true);
            }
          }
        } else {
          drawFrame(undefined, null);
        }

        // Seguimiento de barra/mancuerna por marcador de color (roadmap sección 3.4/3.6, punto 4)
        // — independiente de si se encontró pose en este frame, corre siempre que hay un color
        // calibrado. Se dibuja ENCIMA de lo que `drawFrame` ya pintó este mismo frame, no lo pisa.
        if (markerColorRef.current) {
          if (!markerSampleCanvasRef.current) {
            const c = document.createElement("canvas");
            c.width = MARKER_SAMPLE_WIDTH;
            c.height = MARKER_SAMPLE_HEIGHT;
            markerSampleCanvasRef.current = c;
          }
          const sampleCanvas = markerSampleCanvasRef.current;
          const sctx = sampleCanvas.getContext("2d");
          if (sctx) {
            sctx.drawImage(video, 0, 0, MARKER_SAMPLE_WIDTH, MARKER_SAMPLE_HEIGHT);
            const imageData = sctx.getImageData(0, 0, MARKER_SAMPLE_WIDTH, MARKER_SAMPLE_HEIGHT);
            const pos = findMarker(imageData.data, MARKER_SAMPLE_WIDTH, MARKER_SAMPLE_HEIGHT, {
              ...DEFAULT_MARKER_CONFIG,
              targetColor: markerColorRef.current,
            });
            if (pos) {
              const trail = barTrailRef.current;
              trail.push({ x: pos.xNorm, y: pos.yNorm });
              if (trail.length > BAR_TRAIL_MAX_POINTS) trail.shift();
            }

            const overlayCanvas = canvasRef.current;
            const overlayCtx = overlayCanvas?.getContext("2d");
            const trail = barTrailRef.current;
            if (overlayCanvas && overlayCtx && trail.length > 1) {
              overlayCtx.strokeStyle = "#fbbf24";
              overlayCtx.lineWidth = 3;
              overlayCtx.lineCap = "round";
              overlayCtx.beginPath();
              trail.forEach((p, i) => {
                const x = p.x * overlayCanvas.width;
                const y = p.y * overlayCanvas.height;
                if (i === 0) overlayCtx.moveTo(x, y);
                else overlayCtx.lineTo(x, y);
              });
              overlayCtx.stroke();
              const last = trail[trail.length - 1];
              overlayCtx.fillStyle = "#fbbf24";
              overlayCtx.beginPath();
              overlayCtx.arc(last.x * overlayCanvas.width, last.y * overlayCanvas.height, 7, 0, Math.PI * 2);
              overlayCtx.fill();
            }
          }
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
        onClick={handleMarkerCalibrationTap}
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
        <div className="flex gap-2">
          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            aria-label={voiceEnabled ? "Silenciar la voz" : "Activar la voz"}
            aria-pressed={voiceEnabled}
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
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
          {/* Arreglo del conteo de reps (roadmap sección 3.6): qué orientación detectó la app en
              vivo, para que el usuario pueda corregir la posición del teléfono ANTES de empezar la
              serie, no después. */}
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap"
            style={{
              background: orientation === "unknown" ? "rgba(245,158,11,0.25)" : "rgba(0,0,0,0.55)",
              color: orientation === "unknown" ? "#fbbf24" : "rgba(255,255,255,0.85)",
            }}
          >
            {ORIENTATION_LABEL[orientation]}
            {orientation === "profile" && lockedSideDisplay && (lockedSideDisplay === "left" ? " (lado izquierdo)" : " (lado derecho)")}
          </div>

          {/* Fase E: aparece solo cuando varias repeticiones SEGUIDAS no llegaron a la
              profundidad citada — nunca por un intento aislado (technique-tracker.ts). */}
          {techniqueSuggestion && (
            <div className="absolute top-32 left-4 right-4 flex flex-col gap-2 bg-black/80 rounded-2xl p-3.5">
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
              {/* Blanco por defecto, pasa a negro en el momento exacto que se cuenta una
                  repetición válida — mismo par de colores que usa el resto de la app para marcar
                  "completado" (fondo blanco + texto/ícono negro), no un color suelto nuevo. */}
              <span
                className="w-7 h-7 rounded-full shrink-0 transition-colors duration-150"
                style={{ background: repFlash ? "#000" : "#fff", border: "1.5px solid rgba(255,255,255,0.6)" }}
                aria-hidden
              />
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

          {/* Seguimiento de barra/mancuerna por marcador de color (roadmap sección 3.4/3.6, punto
              4) — opcional: sin calibrar, un toque arranca la calibración; ya calibrado, muestra
              el color elegido y una cruz para apagarlo. */}
          <div className="absolute bottom-6 left-4 flex items-center gap-2">
            <button
              onClick={() => setCalibratingMarker(true)}
              aria-label={markerColor ? "Recalibrar el marcador de la barra" : "Calibrar marcador de la barra"}
              className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center cursor-pointer active:scale-95"
            >
              {markerColor ? (
                <span
                  className="w-5 h-5 rounded-full border border-white/50"
                  style={{ background: `rgb(${markerColor.r},${markerColor.g},${markerColor.b})` }}
                />
              ) : (
                <Target size={16} />
              )}
            </button>
            {markerColor && (
              <button
                onClick={clearMarker}
                aria-label="Apagar el seguimiento de la barra"
                className="w-7 h-7 rounded-full bg-black/55 flex items-center justify-center cursor-pointer active:scale-95 text-white/70"
              >
                <XIcon size={13} />
              </button>
            )}
          </div>

          {calibratingMarker && (
            <div className="absolute top-32 left-4 right-4 flex items-center justify-between gap-2 bg-black/80 rounded-2xl px-4 py-3">
              <p className="text-sm text-white">Tocá el marcador de color en la pantalla.</p>
              <button
                onClick={() => setCalibratingMarker(false)}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
