"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, Flame, HelpCircle, X } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassBadge } from "@/components/glass/glass-badge";
import {
  useVoiceStore,
  useVoiceStreak,
  BODY_LANGUAGE_LESSONS,
  BODY_LANGUAGE_CATEGORY_LABEL,
} from "@/lib/store/voiceStore";
import type { BodyLanguageLesson } from "@/lib/types/voice";

export default function LenguajeNoVerbalPage() {
  const streak = useVoiceStreak();
  const [selected, setSelected] = useState<BodyLanguageLesson | null>(null);

  if (selected) {
    return <LessonDetail lesson={selected} onBack={() => setSelected(null)} />;
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
            Lenguaje No Verbal
          </h1>
        </div>
        {streak > 0 && (
          <span className="ml-auto text-xs text-white/50 flex items-center gap-1">
            <Flame size={13} className="text-orange-400" /> {streak} días
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BODY_LANGUAGE_LESSONS.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} onClick={() => setSelected(lesson)} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson, onClick }: { lesson: BodyLanguageLesson; onClick: () => void }) {
  const completed = useVoiceStore((s) => s.isBodyLanguageLessonCompleted(lesson.id));

  return (
    <GlassCard
      accentColor="var(--voz)"
      glow={completed}
      className="flex flex-col gap-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl">{lesson.illustration}</span>
        {completed ? (
          <CheckCircle2 size={18} style={{ color: "var(--voz)" }} />
        ) : (
          <ChevronRight size={18} className="text-white/30" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-white">{lesson.title}</p>
        <p className="text-sm text-white/55">{lesson.tip}</p>
      </div>
      <GlassBadge color="var(--voz)" className="self-start">
        {BODY_LANGUAGE_CATEGORY_LABEL[lesson.category]}
      </GlassBadge>
    </GlassCard>
  );
}

function LessonDetail({ lesson, onBack }: { lesson: BodyLanguageLesson; onBack: () => void }) {
  const completeBodyLanguageLesson = useVoiceStore((s) => s.completeBodyLanguageLesson);
  const completed = useVoiceStore((s) => s.isBodyLanguageLessonCompleted(lesson.id));

  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const quiz = lesson.quiz ?? [];
  const score = quiz.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );

  function finish(withQuiz: boolean) {
    if (withQuiz && quiz.length > 0) {
      completeBodyLanguageLesson(lesson.id, score, quiz.length);
    } else {
      completeBodyLanguageLesson(lesson.id);
    }
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
          {BODY_LANGUAGE_CATEGORY_LABEL[lesson.category]}
        </GlassBadge>
      </header>

      {!showQuiz && (
        <>
          <GlassCard accentColor="var(--voz)" glow className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-6xl">{lesson.illustration}</span>
            <p className="text-base font-medium text-white/90 max-w-md">{lesson.tip}</p>
          </GlassCard>

          <GlassCard accentColor="var(--voz)" className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white/80">Explicación</p>
            <p className="text-sm text-white/65 leading-relaxed">{lesson.explanation}</p>
          </GlassCard>

          <GlassCard accentColor="var(--voz)" className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white/80">Ejemplo práctico</p>
            <p className="text-sm text-white/65 leading-relaxed">{lesson.example}</p>
          </GlassCard>

          <div className="flex gap-3">
            {quiz.length > 0 && (
              <GlassButton
                accentColor="var(--voz)"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setShowQuiz(true)}
              >
                <HelpCircle size={18} /> Hacer quiz
              </GlassButton>
            )}
            <GlassButton
              accentColor="var(--voz)"
              size="lg"
              className="flex-1"
              disabled={completed}
              onClick={() => finish(false)}
            >
              <CheckCircle2 size={18} /> {completed ? "Completada" : "Marcar como leída"}
            </GlassButton>
          </div>
        </>
      )}

      {showQuiz && (
        <div className="flex flex-col gap-4">
          {quiz.map((q, qi) => (
            <GlassCard key={qi} accentColor="var(--voz)" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-white/85">{q.question}</p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[qi] === oi;
                  const showCorrectness = submitted;
                  const isCorrect = oi === q.correctIndex;
                  let borderColor = "rgba(255,255,255,0.1)";
                  let bg = "rgba(255,255,255,0.04)";
                  if (showCorrectness && isCorrect) {
                    borderColor = "#22c55e";
                    bg = "#22c55e22";
                  } else if (showCorrectness && isSelected && !isCorrect) {
                    borderColor = "#ef4444";
                    bg = "#ef444422";
                  } else if (!showCorrectness && isSelected) {
                    borderColor = "var(--voz)";
                    bg = "var(--voz)22";
                  }
                  return (
                    <motion.button
                      key={oi}
                      whileTap={{ scale: 0.98 }}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className="text-left px-4 py-2.5 rounded-2xl text-sm transition-colors cursor-pointer disabled:cursor-default"
                      style={{ background: bg, border: `1px solid ${borderColor}`, color: "white" }}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </GlassCard>
          ))}

          {!submitted ? (
            <GlassButton
              accentColor="var(--voz)"
              size="lg"
              disabled={Object.keys(answers).length < quiz.length}
              onClick={() => setSubmitted(true)}
            >
              Enviar respuestas
            </GlassButton>
          ) : (
            <GlassCard accentColor="var(--voz)" glow className="flex flex-col items-center gap-3 text-center py-6">
              <p className="text-lg font-semibold text-white">
                Obtuviste {score}/{quiz.length} aciertos
              </p>
              <GlassButton accentColor="var(--voz)" size="lg" onClick={() => finish(true)}>
                <CheckCircle2 size={18} /> Finalizar lección
              </GlassButton>
            </GlassCard>
          )}

          <button
            onClick={() => {
              setShowQuiz(false);
              setSubmitted(false);
              setAnswers({});
            }}
            className="text-xs text-white/40 hover:text-white/70 self-center flex items-center gap-1 cursor-pointer"
          >
            <X size={12} /> Cancelar quiz
          </button>
        </div>
      )}
    </div>
  );
}
