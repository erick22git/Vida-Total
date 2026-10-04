"use client";

/**
 * Perfil de entrenamiento — Configuración > Perfil de entrenamiento. Mismo patrón visual que
 * /gym/calorias/configurar-calorias (X arriba a la izquierda, contador "n / total" al centro, título
 * grande, "Continuar" abajo, opciones con descripción), copiado a mano sin tocar ese archivo.
 *
 * NO duplica datos: sexo, edad, peso, altura, nivel de actividad, lesiones y objetivo ya viven en
 * `gymProfile` (los comparten Calorías y el onboarding de Entrenamiento); acá solo se leen para
 * precargarlos y se vuelven a escribir en el mismo lugar. Solo sexo y peso son obligatorios (los
 * necesita el motor de rangos); el resto se puede omitir. Se guarda SIEMPRE con
 * `updateGymProfileFields` (merge): `saveGymProfile` pisaría el perfil y marcaría el onboarding.
 *
 * `?volver=/ruta` — a dónde regresar al terminar (lo usa la calculadora de rangos cuando faltan
 * sexo o peso). Sin eso vuelve a /gym/entrenamiento.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useGymStore, type GymProfile } from "@/lib/store/gymStore";
import type { NivelActividad, Experiencia, EquipoDisponible, IntensidadEntrenamiento } from "@/lib/store/gymStore";
import { ACTIVITY_LEVELS, type Sexo } from "@/lib/gym/calorie-calc";
import {
  DIAS_OPTIONS,
  DURACION_OPTIONS,
  EQUIPO_OPTIONS,
  EXPERIENCIA_OPTIONS,
  INTENSIDAD_OPTIONS,
  OBJETIVO_ENTRENAMIENTO_OPTIONS,
} from "@/lib/gym/training-profile";
import { MONO_FONT } from "@/lib/ui/mono-font";

type StepKind =
  | "sexo"
  | "edad"
  | "peso"
  | "altura"
  | "experiencia"
  | "objetivo"
  | "frecuencia"
  | "equipo"
  | "actividad"
  | "intensidad"
  | "lesiones"
  | "resumen";

const STEPS: StepKind[] = [
  "sexo",
  "edad",
  "peso",
  "altura",
  "experiencia",
  "objetivo",
  "frecuencia",
  "equipo",
  "actividad",
  "intensidad",
  "lesiones",
  "resumen",
];

const REQUIRED: StepKind[] = ["sexo", "peso"];

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

function Chips<T extends number>({ value, options, onChange, suffix }: { value: T | null; options: readonly T[]; onChange: (v: T) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className="rounded-full px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors"
          style={{ background: value === o ? "#fff" : "#0d0d0d", color: value === o ? "#000" : "#fff" }}
        >
          {o}
          {suffix}
        </button>
      ))}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[28px] leading-[1.05] font-black tracking-tight uppercase">{children}</h1>;
}

function PerfilEntrenamientoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get("volver");
  const gymProfile = useGymStore((s) => s.gymProfile);
  const updateGymProfileFields = useGymStore((s) => s.updateGymProfileFields);

  const [sexo, setSexo] = useState<Sexo | null>(gymProfile?.sexo ?? null);
  const [edad, setEdad] = useState(gymProfile?.edad ? String(gymProfile.edad) : "");
  const [pesoKg, setPesoKg] = useState(gymProfile?.pesoKg ? String(gymProfile.pesoKg) : "");
  const [alturaCm, setAlturaCm] = useState(gymProfile?.alturaCm ? String(gymProfile.alturaCm) : "");
  const [experiencia, setExperiencia] = useState<Experiencia | null>(gymProfile?.experiencia ?? null);
  const [objetivo, setObjetivo] = useState<string | null>(gymProfile?.objetivo ?? null);
  const [dias, setDias] = useState<number | null>(gymProfile?.diasPorSemana ?? null);
  const [minutos, setMinutos] = useState<number | null>(gymProfile?.minutosPorSesion ?? null);
  const [equipo, setEquipo] = useState<EquipoDisponible | null>(gymProfile?.equipo ?? null);
  const [nivelActividad, setNivelActividad] = useState<NivelActividad | null>(gymProfile?.nivelActividad ?? null);
  const [intensidad, setIntensidad] = useState<IntensidadEntrenamiento | null>(gymProfile?.intensidadEntrenamiento ?? null);
  const [lesiones, setLesiones] = useState(gymProfile?.lesiones ?? "");

  const [step, setStep] = useState(0);
  const kind = STEPS[step];
  const isRequired = REQUIRED.includes(kind);

  const stepValid = useMemo(() => {
    if (kind === "sexo") return sexo !== null;
    if (kind === "peso") return parseFloat(pesoKg) > 0;
    return true;
  }, [kind, sexo, pesoKg]);

  const canSave = sexo !== null && parseFloat(pesoKg) > 0;

  function close() {
    if (volver) router.replace(volver);
    else router.back();
  }

  function next() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function save() {
    if (!canSave) return;
    const patch: Partial<GymProfile> = { sexo: sexo!, pesoKg: parseFloat(pesoKg) };
    // Los campos opcionales solo se escriben si tienen valor: vaciar un campo acá no borra lo que
    // ya estaba guardado desde Calorías o el onboarding.
    const e = parseFloat(edad);
    if (e > 0) patch.edad = e;
    const a = parseFloat(alturaCm);
    if (a > 0) patch.alturaCm = a;
    if (experiencia) patch.experiencia = experiencia;
    if (objetivo) patch.objetivo = objetivo;
    if (dias) patch.diasPorSemana = dias;
    if (minutos) patch.minutosPorSesion = minutos;
    if (equipo) patch.equipo = equipo;
    if (nivelActividad) patch.nivelActividad = nivelActividad;
    if (intensidad) patch.intensidadEntrenamiento = intensidad;
    if (lesiones.trim()) patch.lesiones = lesiones.trim();
    updateGymProfileFields(patch);
    close();
  }

  const labelOf = <T extends string>(list: { value: T; label: string }[], v: T | null) => list.find((o) => o.value === v)?.label ?? "—";

  return (
    <div className="fixed inset-0 z-[85] flex flex-col app-bg text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={close} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/80">
          <X size={22} />
        </button>
        <span className="text-sm text-white/50 tabular-nums" style={MONO_FONT}>
          {step + 1} / {STEPS.length}
        </span>
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} aria-label="Atrás" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/50">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <span className="w-9 h-9" />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-5 overflow-y-auto no-scrollbar">
        {kind === "sexo" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>Sexo</Title>
            <p className="text-xs text-white/45">Los estándares de fuerza que usa tu rango son distintos para hombres y mujeres.</p>
            <div className="flex flex-col gap-2">
              <PillOption label="Hombre" selected={sexo === "hombre"} onClick={() => setSexo("hombre")} />
              <PillOption label="Mujer" selected={sexo === "mujer"} onClick={() => setSexo("mujer")} />
            </div>
          </div>
        )}

        {kind === "edad" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>Edad</Title>
            <PlainNumberField label="Edad" value={edad} onChange={setEdad} unit="años" placeholder="30" />
          </div>
        )}

        {kind === "peso" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>Peso actual</Title>
            <p className="text-xs text-white/45">Tu rango se calcula con cuánto levantas respecto a tu peso corporal.</p>
            <PlainNumberField label="Peso" value={pesoKg} onChange={setPesoKg} unit="kg" placeholder="80" />
          </div>
        )}

        {kind === "altura" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>Altura</Title>
            <PlainNumberField label="Altura" value={alturaCm} onChange={setAlturaCm} unit="cm" placeholder="180" />
          </div>
        )}

        {kind === "experiencia" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Experiencia
              <br />
              entrenando
            </Title>
            <div className="flex flex-col gap-2">
              {EXPERIENCIA_OPTIONS.map((o) => (
                <PillOption key={o.value} label={o.label} description={o.description} selected={experiencia === o.value} onClick={() => setExperiencia(o.value)} />
              ))}
            </div>
          </div>
        )}

        {kind === "objetivo" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Objetivo de
              <br />
              entrenamiento
            </Title>
            <div className="flex flex-col gap-2">
              {OBJETIVO_ENTRENAMIENTO_OPTIONS.map((o) => (
                <PillOption key={o.value} label={o.label} description={o.description} selected={objetivo === o.value} onClick={() => setObjetivo(o.value)} />
              ))}
            </div>
          </div>
        )}

        {kind === "frecuencia" && (
          <div className="flex-1 flex flex-col gap-6">
            <Title>
              Días y duración
              <br />
              por sesión
            </Title>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/40">Días por semana</span>
              <Chips value={dias} options={DIAS_OPTIONS} onChange={setDias} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/40">Minutos por sesión</span>
              <Chips value={minutos} options={DURACION_OPTIONS} onChange={setMinutos} suffix=" min" />
            </div>
          </div>
        )}

        {kind === "equipo" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Equipo
              <br />
              disponible
            </Title>
            <div className="flex flex-col gap-2">
              {EQUIPO_OPTIONS.map((o) => (
                <PillOption key={o.value} label={o.label} description={o.description} selected={equipo === o.value} onClick={() => setEquipo(o.value)} />
              ))}
            </div>
          </div>
        )}

        {kind === "actividad" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Nivel de
              <br />
              actividad diaria
            </Title>
            <div className="flex flex-col gap-2">
              {ACTIVITY_LEVELS.map((a) => (
                <PillOption key={a.value} label={a.label} description={a.description} selected={nivelActividad === a.value} onClick={() => setNivelActividad(a.value)} />
              ))}
            </div>
          </div>
        )}

        {kind === "intensidad" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Intensidad
              <br />
              habitual
            </Title>
            <div className="flex flex-col gap-2">
              {INTENSIDAD_OPTIONS.map((o) => (
                <PillOption key={o.value} label={o.label} description={o.description} selected={intensidad === o.value} onClick={() => setIntensidad(o.value)} />
              ))}
            </div>
          </div>
        )}

        {kind === "lesiones" && (
          <div className="flex-1 flex flex-col gap-5">
            <Title>
              Lesiones o
              <br />
              limitaciones
            </Title>
            <textarea
              value={lesiones}
              onChange={(e) => setLesiones(e.target.value)}
              placeholder="Ej: dolor de rodilla, lumbar delicada..."
              rows={4}
              className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none resize-none"
              style={{ background: "#0d0d0d" }}
            />
          </div>
        )}

        {kind === "resumen" && (
          <div className="flex-1 flex flex-col gap-4">
            <Title>Tu perfil</Title>
            <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: "#0d0d0d" }}>
              <Row label="Sexo" value={sexo ? (sexo === "hombre" ? "Hombre" : "Mujer") : "— (falta)"} />
              <Row label="Peso" value={parseFloat(pesoKg) > 0 ? `${pesoKg} kg` : "— (falta)"} />
              <Row label="Edad" value={parseFloat(edad) > 0 ? `${edad} años` : "—"} />
              <Row label="Altura" value={parseFloat(alturaCm) > 0 ? `${alturaCm} cm` : "—"} />
              <Row label="Experiencia" value={labelOf(EXPERIENCIA_OPTIONS, experiencia)} />
              <Row label="Objetivo" value={labelOf(OBJETIVO_ENTRENAMIENTO_OPTIONS, objetivo)} />
              <Row label="Frecuencia" value={dias ? `${dias} días${minutos ? ` · ${minutos} min` : ""}` : "—"} />
              <Row label="Equipo" value={labelOf(EQUIPO_OPTIONS, equipo)} />
              <Row label="Actividad diaria" value={labelOf(ACTIVITY_LEVELS, nivelActividad)} />
              <Row label="Intensidad" value={labelOf(INTENSIDAD_OPTIONS, intensidad)} />
              <Row label="Lesiones" value={lesiones.trim() || "—"} />
            </div>
            {!canSave && <p className="text-xs text-white/50">Sexo y peso son obligatorios: sin ellos no se puede calcular tu rango.</p>}
            <button
              onClick={save}
              disabled={!canSave}
              className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
            >
              Guardar perfil
            </button>
          </div>
        )}
      </div>

      {kind !== "resumen" && (
        <div className="px-6 pb-[max(env(safe-area-inset-bottom),18px)] shrink-0 flex flex-col gap-1">
          <button
            onClick={next}
            disabled={!stepValid}
            className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-30 bg-white text-black"
          >
            Continuar
          </button>
          {!isRequired && (
            <button onClick={next} className="w-full py-2 text-xs font-medium cursor-pointer text-white/45">
              Omitir
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-white/50 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}

export default function PerfilEntrenamientoPage() {
  return (
    <Suspense fallback={null}>
      <PerfilEntrenamientoContent />
    </Suspense>
  );
}
