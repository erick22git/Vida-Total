"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Flame,
  Play,
  Square,
  Wind,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { useVoiceStore, useVoiceStreak } from "@/lib/store/voiceStore";
import type {
  PersuasionPrinciple,
  PublicSpeakingExercise,
  SpeechStructure,
} from "@/lib/types/voice";

const SPEECH_STRUCTURES: SpeechStructure[] = [
  {
    id: "apertura",
    name: "Apertura",
    sections: ["Gancho inicial", "Presentación personal", "Promesa del discurso"],
    tips: [
      "Empieza con una pregunta, dato sorprendente o historia breve, nunca con 'buenos días, hoy voy a hablarles de...'.",
      "Preséntate con brevedad; la audiencia quiere saber quién eres, no tu currículum completo.",
      "Dile a la audiencia qué se va a llevar al final: crea expectativa clara sobre el valor del discurso.",
      "Los primeros 30 segundos definen si la audiencia te presta atención el resto del tiempo.",
    ],
  },
  {
    id: "desarrollo",
    name: "Desarrollo",
    sections: ["Idea principal 1", "Idea principal 2", "Idea principal 3", "Ejemplos y datos"],
    tips: [
      "Limita tu discurso a un máximo de 3 ideas principales; más de eso, la audiencia no las recordará.",
      "Cada idea debe ir acompañada de un ejemplo, dato o historia que la haga memorable.",
      "Usa transiciones claras entre ideas: 'Ahora que vimos X, veamos cómo se relaciona con Y'.",
      "Varía el ritmo: alterna datos con historias para mantener el interés.",
    ],
  },
  {
    id: "cierre",
    name: "Cierre",
    sections: ["Resumen breve", "Llamado a la acción", "Frase memorable"],
    tips: [
      "Resume en una frase las ideas principales, no las repitas todas en detalle.",
      "Dile a la audiencia exactamente qué hacer a continuación: es tu llamado a la acción.",
      "Termina con una frase que puedan recordar y repetir; evita simplemente decir 'eso es todo, gracias'.",
      "El cierre se recuerda casi tanto como la apertura: no lo dejes al improviso.",
    ],
  },
];

const EXERCISES: PublicSpeakingExercise[] = [
  {
    id: "e1",
    title: "Discurso de 1 minuto sin muletillas",
    description: "Elige un tema cotidiano y habla durante 1 minuto sin usar 'eh', 'este' o 'o sea'. Grábate y cuenta cuántas muletillas usaste.",
  },
  {
    id: "e2",
    title: "Improvisación con objeto aleatorio",
    description: "Toma cualquier objeto cerca de ti y habla 2 minutos sobre él como si fuera el invento más importante del siglo. Entrena tu capacidad de improvisar con estructura.",
  },
  {
    id: "e3",
    title: "Presenta frente al espejo",
    description: "Practica tu próxima presentación completa frente a un espejo, prestando atención a tu expresión facial y lenguaje corporal, no solo a las palabras.",
  },
  {
    id: "e4",
    title: "Cuenta una anécdota con estructura",
    description: "Relata una anécdota personal siguiendo la estructura de apertura-desarrollo-cierre. Practica hacerlo en menos de 2 minutos.",
  },
  {
    id: "e5",
    title: "Graba y revisa tu ritmo",
    description: "Graba un discurso corto y revisa cuántas palabras por minuto usaste y en qué momentos aceleraste por nerviosismo.",
  },
  {
    id: "e6",
    title: "Practica con audiencia imaginaria hostil",
    description: "Presenta tu tema imaginando que la audiencia tiene dudas y brazos cruzados. Practica mantener la calma y la seguridad en tu tono.",
  },
];

const PERSUASION_PRINCIPLES: PersuasionPrinciple[] = [
  {
    id: "p1",
    name: "Reciprocidad",
    explanation: "Las personas tienden a devolver favores. Ofrecer valor genuino primero (un dato útil, ayuda concreta) antes de pedir algo aumenta la disposición del otro a corresponder.",
  },
  {
    id: "p2",
    name: "Prueba social",
    explanation: "Las personas confían más en una idea cuando ven que otros ya la aceptaron o la usan. Mencionar casos de éxito o testimonios refuerza la credibilidad de tu mensaje.",
  },
  {
    id: "p3",
    name: "Autoridad",
    explanation: "Comunicar tu experiencia o conocimiento relevante (sin arrogancia) hace que tu mensaje se perciba como más confiable. La autoridad se construye con datos, no con afirmaciones vacías.",
  },
  {
    id: "p4",
    name: "Coherencia y compromiso",
    explanation: "Cuando alguien se compromete públicamente con una idea pequeña, es más probable que actúe de forma consistente con compromisos mayores relacionados después.",
  },
  {
    id: "p5",
    name: "Escasez",
    explanation: "Las oportunidades percibidas como limitadas en tiempo o cantidad generan mayor urgencia y valor percibido. Úsalo con honestidad; la escasez falsa erosiona la confianza.",
  },
  {
    id: "p6",
    name: "Storytelling emocional",
    explanation: "Las historias activan la conexión emocional mucho más que los datos aislados. Un buen dato envuelto en una historia se recuerda y persuade más que una lista de estadísticas.",
  },
];

export default function OratoriaPage() {
  const streak = useVoiceStreak();
  const [expandedSection, setExpandedSection] = useState<string | null>("apertura");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/voz" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-sm">Voz &amp; Comunicación</p>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "var(--voz)" }}>
            Oratoria
          </h1>
        </div>
        {streak > 0 && (
          <span className="ml-auto text-xs text-white/50 flex items-center gap-1">
            <Flame size={13} className="text-orange-400" /> {streak} días
          </span>
        )}
      </header>

      {/* Estructura de un discurso */}
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Estructura de un discurso</p>
        <div className="flex items-center justify-between gap-2">
          {SPEECH_STRUCTURES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0"
                style={{ background: "var(--voz)22", color: "var(--voz)", border: "1px solid var(--voz)55" }}
              >
                {i + 1}
              </div>
              <span className="text-xs text-white/60 truncate">{s.name}</span>
              {i < SPEECH_STRUCTURES.length - 1 && (
                <div className="h-px flex-1 bg-white/15" />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {SPEECH_STRUCTURES.map((s) => (
            <GlassCard key={s.id} accentColor="var(--voz)" padding="sm" className="flex flex-col gap-0">
              <button
                onClick={() => setExpandedSection((cur) => (cur === s.id ? null : s.id))}
                className="flex items-center justify-between w-full cursor-pointer py-1"
              >
                <div className="flex flex-col items-start gap-1">
                  <p className="text-sm font-semibold text-white">{s.name}</p>
                  <p className="text-xs text-white/45">{s.sections.join(" · ")}</p>
                </div>
                <motion.div animate={{ rotate: expandedSection === s.id ? 180 : 0 }}>
                  <ChevronDown size={16} className="text-white/50" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {expandedSection === s.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="flex flex-col gap-2 pt-3 pb-1">
                      {s.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                          <span style={{ color: "var(--voz)" }}>•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Ejercicios para hablar en público */}
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Ejercicios para hablar en público</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXERCISES.map((ex) => (
            <GlassCard key={ex.id} accentColor="var(--voz)" padding="sm" className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-white">{ex.title}</p>
              <p className="text-xs text-white/50 leading-relaxed">{ex.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Manejo del nerviosismo */}
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Manejo del nerviosismo</p>
        <GlassCard accentColor="var(--voz)" className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            <li className="text-sm text-white/60 flex items-start gap-2">
              <span style={{ color: "var(--voz)" }}>•</span>
              El nerviosismo es energía; no busques eliminarla, canalízala en entusiasmo y expresividad.
            </li>
            <li className="text-sm text-white/60 flex items-start gap-2">
              <span style={{ color: "var(--voz)" }}>•</span>
              Llega temprano y familiarízate con el espacio; lo desconocido genera más ansiedad que lo conocido.
            </li>
            <li className="text-sm text-white/60 flex items-start gap-2">
              <span style={{ color: "var(--voz)" }}>•</span>
              Ensaya en voz alta al menos 3 veces completas antes del día real, no solo mentalmente.
            </li>
            <li className="text-sm text-white/60 flex items-start gap-2">
              <span style={{ color: "var(--voz)" }}>•</span>
              Enfoca tu atención en servir a la audiencia con tu mensaje, no en cómo te están evaluando.
            </li>
          </ul>
        </GlassCard>
        <BreathingExercise />
      </section>

      {/* Principios de persuasión */}
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80">Principios de persuasión</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSUASION_PRINCIPLES.map((p) => (
            <GlassCard key={p.id} accentColor="var(--voz)" padding="sm" className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-white">{p.name}</p>
              <p className="text-xs text-white/50 leading-relaxed">{p.explanation}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}

type BreathPhase = "inhale" | "hold" | "exhale";
const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Inhala...",
  hold: "Sostén...",
  exhale: "Exhala...",
};
const PHASE_DURATION: Record<BreathPhase, number> = {
  inhale: 4,
  hold: 4,
  exhale: 6,
};
const PHASE_SCALE: Record<BreathPhase, number> = {
  inhale: 1.4,
  hold: 1.4,
  exhale: 0.85,
};

function BreathingExercise() {
  const logOratoriaPractice = useVoiceStore((s) => s.logOratoriaPractice);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      setPhase((prev) => {
        const order: BreathPhase[] = ["inhale", "hold", "exhale"];
        const idx = order.indexOf(prev);
        const next = order[(idx + 1) % order.length];
        if (next === "inhale") setCycles((c) => c + 1);
        return next;
      });
    }, PHASE_DURATION[phase] * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, phase]);

  function handleStart() {
    setPhase("inhale");
    setCycles(0);
    setRunning(true);
  }

  function handleStop() {
    setRunning(false);
    if (cycles > 0) logOratoriaPractice();
  }

  return (
    <GlassCard accentColor="var(--voz)" glow className="flex flex-col items-center gap-4 py-8">
      <p className="text-sm font-semibold text-white/80 flex items-center gap-2">
        <Wind size={15} style={{ color: "var(--voz)" }} /> Respiración rápida 4-4-6
      </p>
      <div className="relative w-40 h-40 flex items-center justify-center">
        <motion.div
          animate={{ scale: running ? PHASE_SCALE[phase] : 1 }}
          transition={{ duration: PHASE_DURATION[phase], ease: "easeInOut" }}
          className="absolute w-24 h-24 rounded-full"
          style={{
            background: "radial-gradient(circle, var(--voz)55, var(--voz)11)",
            boxShadow: "0 0 50px var(--voz)55",
          }}
        />
        <p className="relative z-10 text-sm font-semibold text-white">
          {running ? PHASE_LABEL[phase] : "Listo"}
        </p>
      </div>
      {running && <p className="text-xs text-white/50">Ciclos completados: {cycles}</p>}
      {!running ? (
        <GlassButton accentColor="var(--voz)" onClick={handleStart}>
          <Play size={16} /> Iniciar respiración
        </GlassButton>
      ) : (
        <GlassButton accentColor="#ef4444" variant="outline" onClick={handleStop}>
          <Square size={16} /> Terminar
        </GlassButton>
      )}
    </GlassCard>
  );
}
