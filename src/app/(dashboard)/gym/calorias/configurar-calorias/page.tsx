"use client";

/**
 * Calculadora de meta calórica — Configuración > Calorías. Mismo patrón
 * visual que crear-alimento (X arriba a la izquierda, contador "N / total"
 * al centro, título grande, "Continuar" abajo) copiado a mano, sin
 * componente compartido — ver AGENTS.md/convención del proyecto.
 *
 * Modo Básico: sexo, edad, peso, altura, actividad, objetivo, intensidad ->
 * Mifflin-St Jeor. Modo PRO (toggle debajo del header): agrega un paso de
 * % de grasa corporal (manual o estimado por el método Navy) que activa
 * Katch-McArdle en vez de Mifflin-St Jeor — ver `calorie-calc.ts`. Los pasos
 * son un array dinámico (`stepKinds`) para poder insertar/quitar el paso PRO
 * sin perder la posición del usuario ni los datos ya tipeados de Básico.
 *
 * Solo calcula `calorieGoal` — proteína/carbos/grasas siguen siendo
 * manuales (Configurar macros, sin cambios). Los datos se guardan en
 * `gymProfile` vía `updateGymProfileFields` (merge, no reemplaza el perfil
 * ni toca `onboardingCompleted` de Entrenamiento); si Modo PRO está apagado
 * al guardar, no se toca ningún campo de grasa/medidas ya guardado antes.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useGymStore, type GymProfile } from "@/lib/store/gymStore";
import type { NivelActividad, ObjetivoCalorico } from "@/lib/store/gymStore";
import {
  ACTIVITY_LEVELS,
  GOAL_INTENSITY_PRESETS,
  OBJETIVO_LABELS,
  calcBodyFatNavy,
  calcCalorieGoal,
  type Sexo,
} from "@/lib/gym/calorie-calc";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { reviewCalorieGoal } from "@/lib/nutrition/nutrient-targets";

type StepKind = "sexo" | "edad" | "peso" | "altura" | "bodyfat" | "actividad" | "objetivo" | "intensidad" | "resultado";
type MetodoBf = "manual" | "navy";

function buildStepKinds(modoPro: boolean): StepKind[] {
  const arr: StepKind[] = ["sexo", "edad", "peso", "altura"];
  if (modoPro) arr.push("bodyfat");
  arr.push("actividad", "objetivo", "intensidad", "resultado");
  return arr;
}

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
        className="w-full bg-transparent outline-none text-white text-2xl font-semibold placeholder:text-white/20 border-b border-white/15 focus:border-white/50 transition-colors py-1.5"
      />
    </div>
  );
}

/** Segmentado chico de 2 opciones — mismo look & feel que el resto, sin dependencia externa. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full p-1 gap-1" style={{ background: "#0d0d0d" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 rounded-full py-2 text-xs font-semibold cursor-pointer transition-colors"
          style={{ background: value === o.value ? "#fff" : "transparent", color: value === o.value ? "#000" : "rgba(255,255,255,0.55)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ConfigurarCaloriasPage() {
  const router = useRouter();
  const gymProfile = useGymStore((s) => s.gymProfile);
  const updateGymProfileFields = useGymStore((s) => s.updateGymProfileFields);

  const [sexo, setSexo] = useState<Sexo | null>(gymProfile?.sexo ?? null);
  const [edad, setEdad] = useState(gymProfile?.edad ? String(gymProfile.edad) : "");
  const [pesoKg, setPesoKg] = useState(gymProfile?.pesoKg ? String(gymProfile.pesoKg) : "");
  const [alturaCm, setAlturaCm] = useState(gymProfile?.alturaCm ? String(gymProfile.alturaCm) : "");
  const [nivelActividad, setNivelActividad] = useState<NivelActividad | null>(gymProfile?.nivelActividad ?? null);
  const [objetivoCalorico, setObjetivoCalorico] = useState<ObjetivoCalorico | null>(gymProfile?.objetivoCalorico ?? null);
  const [intensidadObjetivo, setIntensidadObjetivo] = useState<string | null>(gymProfile?.intensidadObjetivo ?? null);
  const [applied, setApplied] = useState(false);

  const [modoPro, setModoPro] = useState(gymProfile?.modoPro ?? false);
  const [metodoBf, setMetodoBf] = useState<MetodoBf>(gymProfile?.metodoGrasaCorporal ?? "manual");
  const [grasaCorporalPct, setGrasaCorporalPct] = useState(gymProfile?.grasaCorporalPct ? String(gymProfile.grasaCorporalPct) : "");
  const [cuelloCm, setCuelloCm] = useState(gymProfile?.medidaCuelloCm ? String(gymProfile.medidaCuelloCm) : "");
  const [cinturaCm, setCinturaCm] = useState(gymProfile?.medidaCinturaCm ? String(gymProfile.medidaCinturaCm) : "");
  const [caderaCm, setCaderaCm] = useState(gymProfile?.medidaCaderaCm ? String(gymProfile.medidaCaderaCm) : "");

  const [step, setStep] = useState(0);
  const stepKinds = useMemo(() => buildStepKinds(modoPro), [modoPro]);
  const kind = stepKinds[step];

  function toggleModoPro() {
    const currentKind = stepKinds[step];
    const nextKinds = buildStepKinds(!modoPro);
    const nextIndex = nextKinds.indexOf(currentKind);
    setModoPro(!modoPro);
    setStep(nextIndex >= 0 ? nextIndex : 0);
  }

  const navyEstimate = useMemo(() => {
    if (!sexo) return null;
    return calcBodyFatNavy(sexo, {
      cuelloCm: parseFloat(cuelloCm) || undefined,
      cinturaCm: parseFloat(cinturaCm) || undefined,
      caderaCm: sexo === "mujer" ? parseFloat(caderaCm) || undefined : undefined,
      alturaCm: parseFloat(alturaCm) || undefined,
    });
  }, [sexo, cuelloCm, cinturaCm, caderaCm, alturaCm]);

  const effectiveBf = useMemo(() => {
    if (!modoPro) return undefined;
    if (metodoBf === "manual") return parseFloat(grasaCorporalPct) > 0 ? parseFloat(grasaCorporalPct) : undefined;
    return navyEstimate ?? undefined;
  }, [modoPro, metodoBf, grasaCorporalPct, navyEstimate]);

  const stepValid = useMemo(() => {
    switch (kind) {
      case "sexo": return sexo !== null;
      case "edad": return parseFloat(edad) > 0;
      case "peso": return parseFloat(pesoKg) > 0;
      case "altura": return parseFloat(alturaCm) > 0;
      case "bodyfat": return effectiveBf !== undefined && effectiveBf > 0 && effectiveBf < 75;
      case "actividad": return nivelActividad !== null;
      case "objetivo": return objetivoCalorico !== null;
      case "intensidad": return intensidadObjetivo !== null;
      default: return true;
    }
  }, [kind, sexo, edad, pesoKg, alturaCm, effectiveBf, nivelActividad, objetivoCalorico, intensidadObjetivo]);

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
      grasaCorporalPct: effectiveBf,
    });
  }, [sexo, pesoKg, alturaCm, edad, nivelActividad, objetivoCalorico, intensidadObjetivo, effectiveBf]);

  function close() {
    router.back();
  }

  function handleContinue() {
    if (!stepValid) return;
    // Al cambiar de objetivo, la intensidad elegida antes puede no existir más (los presets son
    // distintos por objetivo) — se limpia para no dejar un valor inválido/"pegado".
    if (kind === "objetivo") setIntensidadObjetivo(null);
    setStep((s) => Math.min(stepKinds.length - 1, s + 1));
  }

  function handleUseGoal() {
    if (!result || !sexo || !nivelActividad || !objetivoCalorico || !intensidadObjetivo) return;
    useGymStore.setState({ calorieGoal: result.calorieGoal });
    const patch: Partial<GymProfile> = {
      sexo,
      edad: parseFloat(edad),
      pesoKg: parseFloat(pesoKg),
      alturaCm: parseFloat(alturaCm),
      nivelActividad,
      objetivoCalorico,
      intensidadObjetivo,
      modoPro,
    };
    // Si Modo PRO está apagado no se tocan estos campos — así no se borra una medición
    // guardada antes por si el usuario vuelve a prenderlo más adelante.
    if (modoPro) {
      patch.grasaCorporalPct = effectiveBf;
      patch.metodoGrasaCorporal = metodoBf;
      if (metodoBf === "navy") {
        patch.medidaCuelloCm = parseFloat(cuelloCm) || undefined;
        patch.medidaCinturaCm = parseFloat(cinturaCm) || undefined;
        if (sexo === "mujer") patch.medidaCaderaCm = parseFloat(caderaCm) || undefined;
      }
    }
    updateGymProfileFields(patch);
    setApplied(true);
    router.replace("/gym/calorias?ajustes=1");
  }

  const intensidadPresets = objetivoCalorico ? GOAL_INTENSITY_PRESETS[objetivoCalorico] : [];

  return (
    <div className="fixed inset-0 z-[45] flex flex-col app-bg text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={close} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/80">
          <X size={22} />
        </button>
        <span className="text-sm text-white/50 tabular-nums" style={MONO_FONT}>
          {step + 1} / {stepKinds.length}
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

      <div className="px-6 pt-1 pb-1 flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/35" style={MONO_FONT}>
          Modo {modoPro ? "PRO" : "Básico"}
        </span>
        <button
          onClick={toggleModoPro}
          aria-label="Alternar Modo PRO"
          className="w-11 h-6 rounded-full relative cursor-pointer transition-colors"
          style={{ background: modoPro ? "#fff" : "rgba(255,255,255,0.15)" }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
            style={{ background: modoPro ? "#000" : "#fff", transform: modoPro ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-3 pb-5 overflow-y-auto">
        {kind === "sexo" && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Sexo</h1>
            <p className="text-xs text-white/45">
              Las fórmulas que usamos (Mifflin-St Jeor / Katch-McArdle) son binarias — no existe una tercera variante estándar de ninguna de las dos.
            </p>
            <div className="flex flex-col gap-2">
              <PillOption label="Hombre" selected={sexo === "hombre"} onClick={() => setSexo("hombre")} />
              <PillOption label="Mujer" selected={sexo === "mujer"} onClick={() => setSexo("mujer")} />
            </div>
          </div>
        )}

        {kind === "edad" && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Edad</h1>
            <PlainNumberField label="Edad" value={edad} onChange={setEdad} unit="años" placeholder="30" />
            {(Number(edad) > 0 && (Number(edad) < 19 || Number(edad) > 78)) && (
              <p className="text-xs text-white/45">
                La ecuación Mifflin-St Jeor se midió en adultos de 19 a 78 años; fuera de ese rango el resultado es una extrapolación.
              </p>
            )}
          </div>
        )}

        {kind === "peso" && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Peso actual</h1>
            <PlainNumberField label="Peso" value={pesoKg} onChange={setPesoKg} unit="kg" placeholder="80" />
          </div>
        )}

        {kind === "altura" && (
          <div className="flex-1 flex flex-col gap-6">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Altura</h1>
            <PlainNumberField label="Altura" value={alturaCm} onChange={setAlturaCm} unit="cm" placeholder="180" />
          </div>
        )}

        {kind === "bodyfat" && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[26px] leading-[1.05] font-black tracking-tight uppercase">
              % de grasa
              <br />
              corporal
            </h1>
            <Segmented
              value={metodoBf}
              onChange={setMetodoBf}
              options={[
                { value: "manual", label: "Lo sé (manual)" },
                { value: "navy", label: "Estimarlo (Navy)" },
              ]}
            />
            {metodoBf === "manual" ? (
              <PlainNumberField label="% de grasa corporal" value={grasaCorporalPct} onChange={setGrasaCorporalPct} unit="%" placeholder="18" />
            ) : (
              <div className="flex flex-col gap-4">
                <PlainNumberField label="Cuello" value={cuelloCm} onChange={setCuelloCm} unit="cm" placeholder="38" />
                <PlainNumberField label="Cintura" value={cinturaCm} onChange={setCinturaCm} unit="cm" placeholder="85" />
                {sexo === "mujer" && <PlainNumberField label="Cadera" value={caderaCm} onChange={setCaderaCm} unit="cm" placeholder="98" />}
                <div className="rounded-2xl p-3.5" style={{ background: "#0d0d0d" }}>
                  <span className="text-xs text-white/50">Estimado (método Navy): </span>
                  <span className="text-sm font-semibold">{navyEstimate !== null ? `${navyEstimate}%` : "faltan medidas"}</span>
                </div>
                <p className="text-[11px] text-white/35">
                  Estimación por circunferencias — puede variar respecto a una medición clínica (bioimpedancia, DEXA).
                </p>
              </div>
            )}
          </div>
        )}

        {kind === "actividad" && (
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
            <p className="text-[11px] leading-snug text-white/40">
              Convención, no norma: estos factores (1,2 a 1,9) son los clásicos de las calculadoras, no los de la FAO/OMS. La FAO/OMS/UNU (2001)
              usa niveles de actividad física de 1,40–1,69 (sedentario o ligero), 1,70–1,99 (activo) y 2,00–2,40 (muy activo).
            </p>
          </div>
        )}

        {kind === "objetivo" && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[30px] leading-[1.05] font-black tracking-tight uppercase">Objetivo</h1>
            <div className="flex flex-col gap-2">
              {(Object.keys(OBJETIVO_LABELS) as ObjetivoCalorico[]).map((o) => (
                <PillOption key={o} label={OBJETIVO_LABELS[o]} selected={objetivoCalorico === o} onClick={() => setObjetivoCalorico(o)} />
              ))}
            </div>
          </div>
        )}

        {kind === "intensidad" && (
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
            <p className="text-[11px] leading-snug text-white/40">
              Convención, no norma: estos porcentajes de déficit o superávit son una práctica común, no una recomendación médica. Si tienes dudas, consulta a un profesional.
            </p>
          </div>
        )}

        {kind === "resultado" && (
          <div className="flex-1 flex flex-col gap-5">
            <h1 className="text-[26px] leading-[1.05] font-black tracking-tight uppercase">Tu meta</h1>
            {result ? (
              <>
                <div className="rounded-3xl p-5 flex flex-col gap-1" style={{ background: "#0d0d0d" }}>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-white/40" style={MONO_FONT}>
                    Meta diaria
                  </span>
                  <span className="text-[40px] font-black leading-none">
                    {result.calorieGoal} <span className="text-lg font-semibold text-white/50">kcal</span>
                  </span>
                </div>
                <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: "#0d0d0d" }}>
                  <Row label={result.formula === "katch" ? "BMR (Cunningham / Katch-McArdle)" : "BMR (Mifflin-St Jeor)"} value={`${Math.round(result.bmr)} kcal`} />
                  <Row label="TDEE (gasto total)" value={`${Math.round(result.tdee)} kcal`} />
                  <Row
                    label="Ajuste"
                    value={result.pct === 0 ? "Sin ajuste" : `${result.pct > 0 ? "+" : "−"}${Math.round(Math.abs(result.pct) * 100)}%`}
                  />
                </div>
                <p className="text-xs text-white/45">{result.explicacion}</p>
                <p className="text-[11px] leading-snug text-white/35">
                  El gasto basal usa una fórmula publicada ({result.formula === "katch" ? "Cunningham, 1991: 370 + 21,6 × masa libre de grasa; en libros se llama Katch-McArdle" : "Mifflin y cols., 1990"}).
                  El factor de actividad y el porcentaje de déficit o superávit son convenciones, no normas.
                </p>
                {(() => {
                  const piso = reviewCalorieGoal(sexo || undefined, result.calorieGoal);
                  return piso.mensaje ? <p className="text-xs text-white/60">{piso.mensaje}</p> : null;
                })()}
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

      {kind !== "resultado" && (
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
