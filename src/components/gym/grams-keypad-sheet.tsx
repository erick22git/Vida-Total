"use client";

/**
 * Teclado numérico para poner los gramos a mano (más rápido que la ruedita) — referencia del usuario:
 * pantalla negra, arriba solo se ve el número que se está escribiendo (nada de "gramos" ni unidades),
 * abajo el teclado (C / % / borrar, después 7-8-9 / 4-5-6 / 1-2-3 / 0-,-=).
 * Se abre tocando el número de gramos. "=" confirma, "C" borra todo, "%" toma lo escrito como un
 * porcentaje de la porción base (ej. escribís 50 y das "%" → la mitad de una porción).
 */
import { useState } from "react";
import { X } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";

const KEYS: { label: string; value: string }[] = [
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "0", value: "0" },
  { label: ",", value: "," },
];

export function GramsKeypadSheet({
  initial,
  portionGramos,
  onConfirm,
  onClose,
}: {
  /** Gramos actuales, para arrancar el teclado mostrando ese valor. */
  initial: number;
  /** Gramos de una porción — lo que usa el botón "%" (escribís 50 → la mitad de una porción). */
  portionGramos: number;
  onConfirm: (gramos: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => String(Math.round(initial * 10) / 10).replace(".", ","));

  function press(key: string) {
    setValue((v) => {
      if (key === "," && v.includes(",")) return v;
      if (v === "0" && key !== ",") return key;
      if ((v + key).length > 7) return v;
      return v + key;
    });
  }
  function backspace() {
    setValue((v) => (v.length <= 1 ? "0" : v.slice(0, -1)));
  }
  function clear() {
    setValue("0");
  }
  function percent() {
    const pct = parseFloat(value.replace(",", ".")) || 0;
    setValue(String(Math.round(portionGramos * (pct / 100) * 10) / 10).replace(".", ","));
  }
  function confirm() {
    const n = parseFloat(value.replace(",", "."));
    onConfirm(Number.isFinite(n) ? Math.max(0, n) : 0);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white select-none">
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)]">
        <span />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="w-10 h-10 flex items-center justify-center cursor-pointer text-white/70"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <span className="text-6xl font-bold tabular-nums tracking-tight break-all text-center">{value}</span>
      </div>

      <div className="grid grid-cols-3 gap-px pb-[max(env(safe-area-inset-bottom),10px)]">
        <KeypadButton label="C" onClick={clear} dim />
        <KeypadButton label="%" onClick={percent} dim />
        <KeypadButton label="⌫" onClick={backspace} dim />
        {KEYS.slice(0, 9).map((k) => (
          <KeypadButton key={k.value} label={k.label} onClick={() => press(k.value)} />
        ))}
        <KeypadButton label="0" onClick={() => press("0")} />
        <KeypadButton label="," onClick={() => press(",")} />
        <KeypadButton label="=" onClick={confirm} accent />
      </div>
    </div>
  );
}

function KeypadButton({ label, onClick, dim, accent }: { label: string; onClick: () => void; dim?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="h-[76px] flex items-center justify-center text-[26px] font-bold cursor-pointer active:opacity-60 transition-opacity"
      style={{
        ...MONO_FONT,
        color: accent ? "var(--gym)" : dim ? "rgba(255,255,255,0.4)" : "#fff",
        background: "#0a0a0a",
      }}
    >
      {label}
    </button>
  );
}
