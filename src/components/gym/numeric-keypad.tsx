"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useState } from "react";
import { Delete, Info } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export function NumericKeypad({
  open,
  onClose,
  label,
  initialValue,
  step,
  banner,
  accentColor = "var(--gym)",
  onNext,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  initialValue: number;
  step: number;
  banner: string;
  accentColor?: string;
  onNext: (value: number) => void;
}) {
  const [text, setText] = useState(String(initialValue || ""));
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setText(initialValue ? String(initialValue) : "");
  }

  if (typeof document === "undefined") return null;

  function press(key: string) {
    if (key === "back") {
      setText((t) => t.slice(0, -1));
      return;
    }
    if (key === "." && text.includes(".")) return;
    setText((t) => (t === "0" ? key : t + key));
  }

  function quickAdd(delta: number) {
    const current = parseFloat(text || "0") || 0;
    const next = Math.max(0, current + delta);
    setText(String(Math.round(next * 100) / 100));
  }

  function submit() {
    const value = parseFloat(text || "0") || 0;
    onNext(value);
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            className="glass-surface relative w-full md:max-w-md rounded-t-3xl overflow-hidden flex flex-col"
          >
            <div className="px-5 pt-4 pb-2 text-center">
              <p className="text-xs text-white/45 mb-1">{label}</p>
              <p className="text-4xl font-bold tabular-nums text-white">{text || "0"}</p>
            </div>

            <div
              className="mx-4 mb-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs"
              style={{ background: "#3b82f61f", border: "1px solid #3b82f640", color: "#93c5fd" }}
            >
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{banner}</span>
            </div>

            <div className="px-4 flex items-center justify-center gap-2 mb-2">
              <button
                onClick={() => quickAdd(-step)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 bg-white/[0.06] glass-specular-ring cursor-pointer"
              >
                -{step}
              </button>
              <button
                onClick={() => quickAdd(step)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 bg-white/[0.06] glass-specular-ring cursor-pointer"
              >
                +{step}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-3">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className="flex items-center justify-center rounded-2xl py-3.5 text-xl font-medium text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer"
                >
                  {k === "back" ? <Delete size={20} /> : k}
                </button>
              ))}
            </div>

            <div className="px-4 pb-6 pt-1">
              <GlassButton accentColor={accentColor} className="w-full" size="lg" onClick={submit}>
                Siguiente
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
