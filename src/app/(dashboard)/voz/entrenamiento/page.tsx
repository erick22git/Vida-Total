"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Flame,
  Lock,
  Mic,
  Square,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassBadge } from "@/components/glass/glass-badge";
import {
  useVoiceStore,
  useVoiceStreak,
  useNextUnlockedDay,
  VOICE_LESSONS,
  VOICE_CATEGORY_LABEL,
} from "@/lib/store/voiceStore";
import type { VoiceLesson } from "@/lib/types/voice";

const PROJECTION_TIPS = [
  "Apoya la voz en el aire del abdomen, no en la tensión de la garganta.",
  "Relaja hombros y cuello antes de empezar; la tensión ahoga la resonancia.",
  "Articula con energía las consonantes; la claridad se nota más que el volumen.",
  "Hidrátate antes de practicar: las cuerdas vocales trabajan mejor con humedad.",
  "Grábate y escúchate: es la forma más rápida de detectar hábitos a mejorar.",
];

export default function EntrenamientoVozPage() {
  const streak = useVoiceStreak();
  const nextUnlocked = useNextUnlockedDay();
  const [selectedLesson, setSelectedLesson] = useState<VoiceLesson | null>(null);

  if (selectedLesson) {
    return (
      <LessonDetail lesson={selectedLesson} onBack={() => setSelectedLesson(null)} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/voz" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Voz &amp; Comunicación</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--voz)" }}>
            Entrenamiento de Voz
          </h1>
        </div>
        {streak > 0 && (
          <span className="ml-auto text-xs text-white/50 flex items-center gap-1">
            <Flame size={13} className="text-orange-400" /> {streak} días
          </span>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {VOICE_LESSONS.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            unlocked={lesson.day <= nextUnlocked}
            onClick={() => setSelectedLesson(lesson)}
          />
        ))}
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  unlocked,
  onClick,
}: {
  lesson: VoiceLesson;
  unlocked: boolean;
  onClick: () => void;
}) {
  const completed = useVoiceStore((s) => s.isLessonCompleted(lesson.id));

  return (
    <GlassCard
      padding="sm"
      accentColor={completed ? "var(--voz)" : undefined}
      className="flex items-center gap-3 cursor-pointer"
      onClick={onClick}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
        style={{
          background: completed ? "var(--voz)33" : "rgba(255,255,255,0.06)",
          border: `1px solid ${completed ? "var(--voz)" : "rgba(255,255,255,0.12)"}`,
        }}
      >
        {completed ? (
          <CheckCircle2 size={16} style={{ color: "var(--voz)" }} />
        ) : (
          <span className="text-xs text-white/60 font-medium">{lesson.day}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 grow min-w-0">
        <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
        <p className="text-xs text-white/45 truncate">{lesson.description}</p>
      </div>
      <GlassBadge color="var(--voz)" className="shrink-0">
        {VOICE_CATEGORY_LABEL[lesson.category]}
      </GlassBadge>
      {!unlocked && <Lock size={14} className="text-white/30 shrink-0" />}
    </GlassCard>
  );
}

type RecordingState = "idle" | "requesting" | "recording" | "denied" | "error";

function LessonDetail({ lesson, onBack }: { lesson: VoiceLesson; onBack: () => void }) {
  const completeLesson = useVoiceStore((s) => s.completeLesson);
  const addRecording = useVoiceStore((s) => s.addRecording);
  const completed = useVoiceStore((s) => s.isLessonCompleted(lesson.id));

  const [recState, setRecState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setRecState("requesting");
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error("No se pudo acceder al micrófono:", err);
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setRecState("denied");
      } else {
        setRecState("error");
      }
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecState("idle");
    addRecording({ lessonId: lesson.id, durationSec: elapsed });
  }

  function handleComplete() {
    completeLesson(lesson.id);
    onBack();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-white/50 text-sm">Día {lesson.day}</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate" style={{ color: "var(--voz)" }}>
            {lesson.title}
          </h1>
        </div>
        <GlassBadge color="var(--voz)" className="ml-auto shrink-0">
          {VOICE_CATEGORY_LABEL[lesson.category]}
        </GlassBadge>
      </header>

      <GlassCard accentColor="var(--voz)" glow className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Texto guía para practicar en voz alta</p>
        <p className="text-base text-white/85 leading-relaxed">{lesson.exerciseText}</p>
      </GlassCard>

      <GlassCard accentColor="var(--voz)" className="flex flex-col items-center gap-5 py-8">
        {recState === "denied" && (
          <p className="text-sm text-red-400 text-center max-w-sm">
            No se pudo acceder al micrófono. Revisa los permisos de tu navegador para este sitio e inténtalo de nuevo.
          </p>
        )}
        {recState === "error" && (
          <p className="text-sm text-red-400 text-center max-w-sm">
            Ocurrió un error al intentar grabar. Verifica que tu dispositivo tenga un micrófono disponible.
          </p>
        )}

        {recState === "recording" ? (
          <>
            <motion.button
              onClick={stopRecording}
              whileTap={{ scale: 0.94 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-24 h-24 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: "#ef4444", boxShadow: "0 0 40px #ef444488" }}
            >
              <Square size={28} className="text-white" fill="white" />
            </motion.button>
            <p className="text-2xl font-bold text-white tabular-nums">
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
            </p>
            <p className="text-xs text-white/50">Grabando... toca para detener</p>
          </>
        ) : (
          <>
            <motion.button
              onClick={startRecording}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              className="w-24 h-24 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                background: "radial-gradient(circle, #ef4444, #b91c1c)",
                boxShadow: "0 0 30px #ef444455",
              }}
            >
              <Mic size={30} className="text-white" />
            </motion.button>
            <p className="text-xs text-white/50">
              {recState === "requesting" ? "Solicitando acceso al micrófono..." : "Toca para grabarte practicando"}
            </p>
          </>
        )}

        {audioUrl && (
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-xs text-white/50">Escúchate:</p>
            <audio src={audioUrl} controls className="w-full max-w-sm" />
          </div>
        )}
      </GlassCard>

      <GlassCard accentColor="var(--voz)" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Sparkles size={15} style={{ color: "var(--voz)" }} /> Tips de proyección vocal
        </p>
        <ul className="flex flex-col gap-2">
          {PROJECTION_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/60">
              <Circle size={6} className="mt-1.5 shrink-0" style={{ color: "var(--voz)" }} fill="var(--voz)" />
              {tip}
            </li>
          ))}
        </ul>
        {lesson.tip && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-white/45">
              <span className="font-medium text-white/60">Tip de esta lección: </span>
              {lesson.tip}
            </p>
          </div>
        )}
      </GlassCard>

      <GlassButton
        accentColor="var(--voz)"
        size="lg"
        disabled={completed}
        onClick={handleComplete}
        className="w-full"
      >
        <CheckCircle2 size={18} /> {completed ? "Lección completada" : "Marcar como completada"}
      </GlassButton>
    </div>
  );
}
