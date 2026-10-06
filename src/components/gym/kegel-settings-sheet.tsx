"use client";

/**
 * Sheet de configuración de Kegel — se abre desde el ícono de ajustes
 * en la esquina superior derecha de la página principal de Kegel.
 *
 * Reemplaza el SettingsGlyph inactivo. Opciones:
 *  - Sonido on/off (usa preferencesStore)
 *  - Vibración on/off (usa kegelSettingsStore) + aviso si no compatible
 *  - Cuenta atrás toggle
 *  - Parámetros del plan: reps, squeeze, relax (con límites NHS/NICE)
 *  - Resetear plan (borra progreso del plan local)
 */
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { usePreferencesStore } from "@/lib/store/preferencesStore";
import { useKegelSettingsStore } from "@/lib/store/kegelSettingsStore";
import { useKegelPlanStore } from "@/lib/store/kegelPlanStore";
import { isHapticSupported } from "@/lib/haptics/haptic";
import { KEGEL_LIMITS } from "@/lib/gym/kegel-plan";
import { useState } from "react";

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10">
      <span className="text-[15px]">{label}</span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative w-[46px] h-[26px] rounded-full transition-colors"
        style={{ background: value ? "#fff" : "#3a3a3d" }}
      >
        <span
          className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-transform"
          style={{
            background: value ? "#000" : "#888",
            transform: value ? "translateX(23px)" : "translateX(3px)",
          }}
        />
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number | null;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number | null) => void;
}) {
  const current = value ?? defaultValue;

  function adjust(delta: number) {
    const next = Math.min(max, Math.max(min, current + delta));
    onChange(next === defaultValue ? null : next);
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10">
      <div className="flex flex-col">
        <span className="text-[15px]">{label}</span>
        {value !== null && (
          <span className="text-[11px]" style={{ color: "#888" }}>modificado</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => adjust(-step)}
          disabled={current <= min}
          aria-label={`Reducir ${label}`}
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[20px] font-light disabled:opacity-30"
          style={{ background: "#2a2a2d" }}
        >
          −
        </button>
        <span className="text-[16px] font-bold tabular-nums w-[52px] text-center" style={MONO_FONT}>
          {current}{unit}
        </span>
        <button
          onClick={() => adjust(step)}
          disabled={current >= max}
          aria-label={`Aumentar ${label}`}
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[20px] font-light disabled:opacity-30"
          style={{ background: "#2a2a2d" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function KegelSettingsSheet() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled);

  const {
    vibrationEnabled, setVibrationEnabled,
    countdownEnabled, setCountdownEnabled,
    repsOverride, setRepsOverride,
    squeezeOverride, setSqueezeOverride,
    relaxOverride, setRelaxOverride,
  } = useKegelSettingsStore();

  const resetCompleted = useKegelPlanStore((s) => s.resetCompleted);
  const hapticSupported = isHapticSupported();

  function handleReset() {
    if (confirm("¿Resetear el progreso del plan Kegel? Se borrarán los días completados.")) {
      resetCompleted();
    }
  }

  return (
    <>
      {/* Botón que reemplaza al SettingsGlyph */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Configuración Kegel"
        className="w-10 h-10 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
      >
        <SlidersHorizontal size={22} strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              ref={overlayRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[50]"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[51] rounded-t-[20px] text-white"
              style={{ background: "#1a1a1d", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-[36px] h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h2 className="text-[19px] font-bold">Configuración Kegel</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="w-9 h-9 -mr-2 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={20} strokeWidth={2.4} />
                </button>
              </div>

              <div className="px-5 overflow-y-auto" style={{ maxHeight: "70vh" }}>
                {/* Sección: Señales */}
                <p className="text-[11px] uppercase tracking-widest mb-1 pt-2" style={{ ...MONO_FONT, color: "#888" }}>
                  Señales
                </p>
                <Toggle value={soundEnabled} onChange={setSoundEnabled} label="Sonido" />
                <Toggle value={vibrationEnabled} onChange={setVibrationEnabled} label="Vibración" />
                {!hapticSupported && (
                  <p className="text-[12px] py-2 pb-3" style={{ color: "#888" }}>
                    Tu dispositivo no soporta vibración.
                  </p>
                )}
                <Toggle value={countdownEnabled} onChange={setCountdownEnabled} label="Cuenta atrás (3 seg)" />

                {/* Sección: Plan */}
                <p className="text-[11px] uppercase tracking-widest mb-1 pt-5" style={{ ...MONO_FONT, color: "#888" }}>
                  Plan personalizado
                </p>
                <p className="text-[12px] pb-2" style={{ color: "#888" }}>
                  Los cambios se aplican a partir de la próxima sesión. Límites basados en NHS/NICE.
                </p>
                <Stepper
                  label="Repeticiones / serie"
                  value={repsOverride}
                  defaultValue={10}
                  min={KEGEL_LIMITS.minRepsPerSet}
                  max={KEGEL_LIMITS.maxRepsPerSet}
                  step={1}
                  unit=" reps"
                  onChange={setRepsOverride}
                />
                <Stepper
                  label="Apretar (seg)"
                  value={squeezeOverride}
                  defaultValue={3}
                  min={KEGEL_LIMITS.minHoldSec}
                  max={KEGEL_LIMITS.maxHoldSec}
                  step={1}
                  unit="s"
                  onChange={setSqueezeOverride}
                />
                <Stepper
                  label="Soltar (seg)"
                  value={relaxOverride}
                  defaultValue={3}
                  min={KEGEL_LIMITS.minRelaxSec}
                  max={KEGEL_LIMITS.maxHoldSec * 2}
                  step={1}
                  unit="s"
                  onChange={setRelaxOverride}
                />

                {/* Sección: Reiniciar */}
                <p className="text-[11px] uppercase tracking-widest mb-1 pt-5" style={{ ...MONO_FONT, color: "#888" }}>
                  Datos
                </p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-3 w-full py-3 border-b border-white/10 active:opacity-70"
                  style={{ color: "#ef4444" }}
                >
                  <RotateCcw size={18} strokeWidth={2.4} />
                  <span className="text-[15px]">Resetear progreso del plan</span>
                </button>

                {/* Pie */}
                <p className="text-[11px] text-center py-5" style={{ color: "#555" }}>
                  Límites: NHS Pelvic Floor, NICE CG171, App Squeezy
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
