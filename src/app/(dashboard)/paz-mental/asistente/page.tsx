"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { usePazMentalStore } from "@/lib/store/pazMentalStore";
import type { ChatMessage } from "@/lib/types/paz-mental";

const SUGGESTIONS = ["Me siento triste", "Necesito calmarme", "Quiero meditar"];

function randomDelay() {
  return 800 + Math.random() * 400;
}

function generateReply(userText: string): { content: string; href?: string; label?: string } {
  const text = userText.toLowerCase();

  if (/(triste|mal|deprimid)/.test(text)) {
    return {
      content:
        "Lamento que te sientas así. Está bien no estar bien todos los días. ¿Qué tal si escribes 3 cosas por las que te sientes agradecido hoy? A veces ayuda a cambiar el enfoque.",
      href: "/paz-mental/diario",
      label: "Ir a Gratitud",
    };
  }
  if (/(enojad|ira|furios)/.test(text)) {
    return {
      content:
        "Entiendo que estés sintiendo enojo, es una emoción válida. Te sugiero probar una respiración 4-7-8 para calmarte antes de reaccionar.",
      href: "/paz-mental/ira",
      label: "Ir a Control de Ira",
    };
  }
  if (/(ansios|nervios|estres|estrés)/.test(text)) {
    return {
      content:
        "La ansiedad puede sentirse abrumadora. Una meditación breve puede ayudarte a regresar al presente. ¿Te gustaría intentarlo ahora?",
      href: "/paz-mental/meditacion",
      label: "Ir a Meditación",
    };
  }
  if (/(bien|genial|feliz|content)/.test(text)) {
    return {
      content:
        "¡Qué bueno escuchar eso! Aprovecha esta energía positiva para hacer algo que disfrutes hoy. Sigue así.",
    };
  }
  return {
    content: "Cuéntame un poco más sobre cómo te sientes. Estoy aquí para escucharte sin juzgar.",
  };
}

export default function AsistentePage() {
  const chatMessages = usePazMentalStore((s) => s.chatMessages);
  const addChatMessage = usePazMentalStore((s) => s.addChatMessage);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, typing]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    addChatMessage({ role: "user", content: trimmed });
    setInput("");
    setTyping(true);
    const delay = randomDelay();
    setTimeout(() => {
      const reply = generateReply(trimmed);
      addChatMessage({
        role: "assistant",
        content: reply.content,
        suggestedHref: reply.href,
        suggestedLabel: reply.label,
      });
      setTyping(false);
    }, delay);
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
      <header className="flex items-center gap-3 pt-2 shrink-0">
        <Link href="/paz-mental" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full"
          style={{ background: "var(--paz-mental)22" }}
        >
          <Sparkles size={16} style={{ color: "var(--paz-mental)" }} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-white/50 text-xs">Paz Mental</p>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-white">
            Asistente IA
          </h1>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 px-1 pb-2"
      >
        {chatMessages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="self-start glass-surface rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/50"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
            style={{
              borderColor: "var(--paz-mental)55",
              color: "var(--paz-mental)",
              background: "var(--paz-mental)11",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 shrink-0"
      >
        <GlassInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe cómo te sientes..."
          className="flex-1"
        />
        <button
          type="submit"
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 cursor-pointer disabled:opacity-40"
          style={{ background: "var(--paz-mental)", color: "#04201c" }}
          disabled={!input.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${isUser ? "flex-row-reverse" : ""}`}>
        {!isUser && (
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
            style={{ background: "var(--paz-mental)22" }}
          >
            <Sparkles size={13} style={{ color: "var(--paz-mental)" }} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div
            className={`px-4 py-2.5 text-sm rounded-2xl ${
              isUser ? "rounded-br-md text-white" : "rounded-bl-md glass-surface text-white/90"
            }`}
            style={
              isUser
                ? {
                    background: "linear-gradient(135deg, #3b82f6, #3b82f6cc)",
                    boxShadow: "0 4px 16px #3b82f655",
                  }
                : undefined
            }
          >
            {message.content}
          </div>
          {message.suggestedHref && (
            <Link
              href={message.suggestedHref}
              className="text-xs font-medium self-start"
              style={{ color: "var(--paz-mental)" }}
            >
              {message.suggestedLabel ?? "Ver más"} →
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
