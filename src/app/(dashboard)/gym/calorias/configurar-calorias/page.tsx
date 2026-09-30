"use client";

/**
 * Calculadora de meta calórica — Modo Básico (Configuración > Calorías).
 * Mismo patrón visual que crear-alimento (X arriba a la izquierda, contador
 * "N / 8" al centro, título grande, "Continuar" abajo) copiado a mano, sin
 * componente compartido — ver AGENTS.md/convención del proyecto.
 *
 * 7 pasos de datos + 1 de resultado. Solo calcula `calorieGoal` — proteína/
 * carbos/grasas siguen siendo manuales (Configurar macros, sin cambios).
 * Los datos se guardan en `gymProfile` vía `updateGymProfileFields` (merge,
 * no reemplaza el perfil ni toca `onboardingCompleted` de Entrenamiento).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import type { NivelActividad, ObjetivoCalorico } from "@/lib/store/gymStore";
import {
  ACTIVITY_LEVELS,
  GOAL_INTENSITY_PRESETS,
  OBJETIVO_LABELS,
  calcCalorieGoal,
  type Sexo,
} from "@/lib/gym/calorie-calc";
import { MONO_FONT } from "@/lib/ui/mono-font";

const STEP_COUNT = 8;

function PillOption({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3.5 flex flex-col gap-0.5 cursor-pointer transition-colors"
      style={{ background: selected ? "#fff" : "#0d0d0d", color: selected ? "#000" : "#fff" }}
    >
      <span className="text-sm font-semibold">{label}</span>
      {description && (
        <span className="text-xs" style={{ color: selected ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.45)" }}>
          {description}
        </span>
      )}
    </button>
  );
}

function PlainNumberField({
  label,
  value,
  onChange,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-white/40">
        {label} <span className="text-white/25">({unit})</span>
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        type="number"
        autoFocus
        className="w-full bg-transparent outline-none text-white text-2xl font-semibold placeholder:text-white/20 border-b border-white/15 focus:border-white/50 transition-colors py-1.5"
      />
    </div>
  );
}

export default function ConfigurarCaloriasPage() {
  const router = useRouter();
  const gymProfile = useGymStore((s) => s.gymProfile);
  const updateGymProfileFields = useGymStore((s) => s.updateGymProfileFields);

  const [step, setStep] = useState(0);
  const [sexo, setSexo] = useState<Sexo | null>(gymProfile?.sexo ?? null);
  const [edad, setEdad] = useState(gymProfile?.edad ? String(gymProfile.edad) : "");
  const [pesoKg, setPesoKg] = useState(gymProfile?.pesoKg ? String(gymProfile.pesoKg) : "");
  const [alturaCm, setAlturaCm] = useState(gymProfile?.alturaCm ? String(gymProfile.alturaCm) : "");
  const [nivelActividad, setNivelActividad] = useState<NivelActividad | null>(gymProfile?.nivelActividad ?? null);
  const [objetivoCalorico, setObjetivoCalorico] = useState<ObjetivoCalorico | null>(gymProfile?.objetivoCalorico ?? null);
  const [intensidadObjetivo, setIntensidadObjetivo] = useState<string | null>(gymProfile?.intensidadObjetivo ?? null);
  const [applied, setApplied] = useState(false);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return sexo !== null;
      case 1: return parseFloat(edad) > 0;
      case 2: return parseFloat(pesoKg) > 0;
      case 3: return parseFloat(alturaCm) > 0;
      case 4: return nivelActividad !== null;
      case 5: return objetivoCalorico !== null;
      case 6: return intensidadObjetivo !== null;
      default: return true;
    }
  }, [step, sexo, edad, pesoKg, alturaCm, nivelActividad, objetivoCalorico, intensidadObjetivo]);

  const result = useMemo(() => {
    if (!sexo || !nivelActividad || !objetivoCalorico || !intensidadObjetivo) return null;
    const pesoNum = parseFloat(pesoKg);
    const alturaNum = parseFloat(alturaCm);
    const edadNum = parseFloat(edad);
    if (!(pesoNum > 0) || !(alturaNum > 0) || !(edadNum > 0)) return null;
    return calcCalorieGoal({
      sexo,
      pesoKg: pesoNum,
      alturaCm: alturaNum,
      edad: edadNum,
      nivelActividad,
      objetivoCalorico,
      intensidadObjetivo,
    });
  }, [sexo, pesoKg, alturaCm, edad, nivelActividad, objetivoCalorico, intensidadObjetivo]);

  function close() {
    router.back();
  }

  function handleContinue() {
    if (!stepValid) return;
    // Al cambiar de objetivo, la intensidad elegida antes puede no existir más (los presets son
    // distintos por objetivo) — se limpia para no dejar un valor inválido/"pegado".
    if (step === 5) setIntensidadObjetivo(null);
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  }

  function handleUseGoal() {
    if (!result || !sexo || !nivelActividad || !objetivoCalorico || !intensidadObjetivo) return;
    useGymStore.setState({ calorieGoal: result.calorieGoal });
    updateGymProfileFields({
      sexo,
      edad: parseFloat(edad),
      pesoKg: parseFloat(pesoKg),
      alturaCm: parseFloat(alturaCm),
      nivelActividad,
      objetivoCalorico,
      intensidadObjetivo,
    });
    setApplied(true);
  }

  const intensidadPresets = objetivoCalorico ? GOAL_INTENSITY_PRESETS[objetivoCalorico] : [];

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-black text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={close} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/80">
          <X size={22} />
        </button>
        <span className="text-sm text-white/50 tabular-nums" style={MONO_FONT}>
          {step + 1} / {STEP_COUNT}
        </span>
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            aria-label="Atrás"
            className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/50"
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          <span className="w-9 h-9" />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-5 overflow-y-auto">
        {step === 0 && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Sexo</h1>
            <p className="text-xs text-white/45">
              La fórmula que usamos (Mifflin-St Jeor) es binaria — no existe una tercera variante estándar de la ecuación.
            </p>
            <div className="flex flex-col gap-2">
              <PillOption label="Hombre" selected={sexo === "hombre"} onClick={() => setSexo("hombre")} />
              <PillOption label="Mujer" selected={sexo === "mujer"} onClick={() => setSexo("mujer")} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Edad</h1>
            <PlainNumberField label="Edad" value={edad} onChange={setEdad} unit="años" placeholder="30" />
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Peso actual</h1>
            <PlainNumberField label="Peso" value={pesoKg} onChange={setPesoKg} unit="kg" placeholder="80" />
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Altura</h1>
            <PlainNumberField label="Altura" value={alturaCm} onChange={setAlturaCm} unit="cm" placeholder="180" />
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">
              Nivel de
              <br />
              actividad
            </h1>
            <div className="flex flex-col gap-2">
              {ACTIVITY_LEVELS.map((a) => (
                <PillOption
                  key={a.value}
                  label={a.label}
                  description={a.description}
                  selected={nivelActividad === a.value}
                  onClick={() => setNivelActividad(a.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Objetivo</h1>
            <div className="flex flex-col gap-2">
              {(Object.keys(OBJETIVO_LABELS) as ObjetivoCalorico[]).map((o) => (
                <PillOption key={o} label={OBJETIVO_LABELS[o]} selected={objetivoCalorico === o} onClick={() => setObjetivoCalorico(o)} />
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[26px] leading-[1.05] font-black tracking-tight uppercase">
              Intensidad del
              <br />
              objetivo
            </h1>
            <div className="flex flex-col gap-2">
              {intensidadPresets.map((p) => (
                <PillOption
                  key={p.value}
                  label={p.label}
                  description={p.description}
                  selected={intensidadObjetivo === p.value}
                  onClick={() => setIntensidadObjetivo(p.value)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[26px] leading-[1.05] font-black tracking-tight uppercase">Tu meta</h1>
            {result ? (
              <>
                <div className="rounded-3xl p-5 flex flex-col gap-1" style={{ background: "#0d0d0d" }}>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-white/40" style={MONO_FONT}>
                    Meta diaria
                  </span>
                  <span className="text-[40px] font-black leading-none">{result.calorieGoal} <span className="text-lg font-semibold text-white/50">kcal</span></span>
                </div>
                <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: "#0d0d0d" }}>
                  <Row label="BMR (gasto basal)" value={`${Math.round(result.bmr)} kcal`} />
                  <Row label="TDEE (gasto total)" value={`${Math.round(result.tdee)} kcal`} />
                  <Row
                    label="Ajuste"
                    value={result.pct === 0 ? "Sin ajuste" : `${result.pct > 0 ? "+" : "−"}${Math.round(Math.abs(result.pct) * 100)}%`}
                  />
                </div>
                <p className="text-xs text-white/45">{result.explicacion}</p>
                {applied ? (
                  <p className="text-xs text-white/70 text-center">Meta aplicada.</p>
                ) : (
                  <button
                    onClick={handleUseGoal}
                    className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black"
                  >
                    Usar esta meta
                  </button>
                )}
                <button onClick={close} className="w-full rounded-full py-2.5 text-xs font-medium cursor-pointer text-white/50">
                  {applied ? "Cerrar" : "Descartar"}
                </button>
              </>
            ) : (
              <p className="text-xs text-white/45">Faltan datos para calcular.</p>
            )}
          </div>
        )}
      </div>

      {step < STEP_COUNT - 1 && (
        <div className="px-6 pb-[max(env(safe-area-inset-bottom),18px)] shrink-0">
          <button
            onClick={handleContinue}
            disabled={!stepValid}
            className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-30 bg-white text-black"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
