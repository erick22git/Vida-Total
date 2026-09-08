"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useState } from "react";
import { Delete } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const FRACTIONS = [
  { label: "1/4", value: 0.25 },
  { label: "1/3", value: 1 / 3 },
  { label: "1/2", value: 0.5 },
  { label: "2/3", value: 2 / 3 },
  { label: "3/4", value: 0.75 },
  { label: "1", value: 1 },
  { label: "1 1/2", value: 1.5 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
];

/** Custom (non-native) numeric keyboard for entering a food quantity, with a
 * Number/Fraction mode toggle — used instead of the OS keyboard for a more
 * app-like, precise portion-entry experience. */
export function QuantityKeypad({
  open,
  onClose,
  initialValue,
  onChange,
  accentColor = "var(--gym)",
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  onChange: (value: number) => void;
  accentColor?: string;
}) {
  const [mode, setMode] = useState<"numero" | "fraccion">("numero");
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

  function pickFraction(value: number) {
    setText(String(Math.round(value * 1000) / 1000));
  }

  function submit() {
    const value = parseFloat(text || "0") || 0;
    onChange(value > 0 ? value : 1);
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
              <p className="text-xs text-white/45 mb-1">Cantidad</p>
              <p className="text-4xl font-bold tabular-nums text-white">{text || "0"}</p>
            </div>

            <div className="px-4 flex items-center gap-1 rounded-full bg-white/[0.06] p-1 mx-4 mb-3">
              {(["numero", "fraccion"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-full py-2 text-xs font-medium transition-colors cursor-pointer",
                    mode === m ? "text-white" : "text-white/50",
                  )}
                  style={mode === m ? { background: accentColor } : undefined}
                >
                  {m === "numero" ? "Número" : "Fracción"}
                </button>
              ))}
            </div>

            {mode === "numero" ? (
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
            ) : (
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {FRACTIONS.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => pickFraction(f.value)}
                    className="flex items-center justify-center rounded-2xl py-3.5 text-base font-medium text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 pb-6 pt-1">
              <GlassButton accentColor={accentColor} className="w-full" size="lg" onClick={submit}>
                Listo
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
