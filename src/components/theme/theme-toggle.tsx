"use client";

import { useThemePref, type ThemeMode } from "@/lib/ui/theme-pref";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Blanco" },
];

/** Selector Oscuro / Blanco de toda la app (ver ThemeApplier y la regla `html[data-theme="light"]` en globals.css). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useThemePref();
  return (
    <div className={`flex rounded-full p-1 gap-1 bg-white/[0.08] ${className}`} role="radiogroup" aria-label="Apariencia">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => setMode(o.value)}
          className={`flex-1 rounded-full py-2 text-xs font-semibold cursor-pointer transition-colors ${
            mode === o.value ? "bg-white text-black" : "text-white/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
