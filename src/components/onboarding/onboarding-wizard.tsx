"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, Btn, DarkCard } from "@/components/agente/ui";
import { ACTIVITY_LEVELS, OBJETIVO_LABELS, calcCalorieGoal } from "@/lib/gym/calorie-calc";
import { useGymStore, type EquipoDisponible, type Experiencia, type NivelActividad, type ObjetivoCalorico } from "@/lib/store/gymStore";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Formulario inicial de un usuario nuevo, ANTES de ver cualquier módulo. No crea formularios nuevos: escribe en los mismos campos
 * que ya usan Calorías (Configurar calorías) y Entrenamiento (Perfil de entrenamiento) — `gymProfile` del store — y calcula la
 * meta de calorías con la misma fórmula (`calcCalorieGoal`). Después el usuario puede cambiarlo todo desde esas pantallas.
 */
const EXPERIENCIAS: { v: Experiencia; l: string }[] = [
  { v: "menos_6m", l: "Menos de 6 meses" },
  { v: "6m_2a", l: "6 meses a 2 años" },
  { v: "2_5a", l: "2 a 5 años" },
  { v: "mas_5a", l: "Más de 5 años" },
];
const EQUIPOS: { v: EquipoDisponible; l: string }[] = [
  { v: "gimnasio", l: "Gimnasio" },
  { v: "mancuernas", l: "Mancuernas en casa" },
  { v: "peso_corporal", l: "Peso corporal" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full px-4 min-h-[44px] text-[14px] font-extrabold cursor-pointer active:scale-95 transition-transform", active ? "text-[#111]" : "text-white")}
      style={{ background: active ? "#f4f4f5" : "#3b3b3f" }}
    >
      {children}
    </button>
  );
}

function NumberField({ label, unit, value, onChange, min, max }: { label: string; unit: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">{label}</span>
      <div className="flex items-center rounded-2xl px-3 min-h-[48px]" style={{ background: "#2b2b2e", border: BORDER }}>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
          aria-label={label}
          min={min}
          max={max}
          className="flex-1 bg-transparent outline-none text-[17px] font-bold min-w-0"
        />
        <span className="text-sm text-white/40">{unit}</span>
      </div>
    </label>
  );
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function OnboardingWizard({ userId, name }: { userId: string; name: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sexo, setSexo] = useState<"hombre" | "mujer" | null>(null);
  const [edad, setEdad] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [objetivo, setObjetivo] = useState<ObjetivoCalorico>("mantener");
  const [actividad, setActividad] = useState<NivelActividad>("ligero");
  const [experiencia, setExperiencia] = useState<Experiencia>("menos_6m");
  const [dias, setDias] = useState(3);
  const [equipo, setEquipo] = useState<EquipoDisponible>("gimnasio");
  const [saving, setSaving] = useState(false);

  const bodyOk = !!sexo && num(edad) >= 12 && num(edad) <= 100 && num(peso) >= 30 && num(peso) <= 300 && num(altura) >= 120 && num(altura) <= 230;
  const steps = ["Tus datos", "Tu objetivo", "Tu entrenamiento"];

  async function finish() {
    if (!sexo) return;
    setSaving(true);
    // Intensidad por defecto de la calculadora: «estándar» para mantener, «moderado» para perder o ganar (se cambia luego en Calorías).
    const intensidad = objetivo === "mantener" ? "estandar" : "moderado";
    const calc = calcCalorieGoal({
      sexo,
      pesoKg: num(peso),
      alturaCm: num(altura),
      edad: num(edad),
      nivelActividad: actividad,
      objetivoCalorico: objetivo,
      intensidadObjetivo: intensidad,
    });
    const state = useGymStore.getState();
    // Mismo guardado que «Perfil de entrenamiento»: saveGymProfile también marca onboardingCompleted de Entrenamiento,
    // así esa pantalla no vuelve a pedir lo mismo.
    state.saveGymProfile({
      ...(state.gymProfile ?? {}),
      sexo,
      edad: num(edad),
      pesoKg: num(peso),
      alturaCm: num(altura),
      nivelActividad: actividad,
      objetivoCalorico: objetivo,
      intensidadObjetivo: intensidad,
      experiencia,
      diasPorSemana: dias,
      equipo,
    });
    useGymStore.setState({ calorieGoal: calc.calorieGoal });

    try {
      localStorage.setItem(`vt_onboarding_done_${userId}`, "1");
    } catch {
      /* sin almacenamiento local: el flag de la base de datos alcanza */
    }
    // Si la migración 0018 todavía no se aplicó, la columna no existe: el layout ya trata «sin columna» como hecho.
    const { error } = await createClient().from("profiles").update({ onboarding_done: true }).eq("id", userId);
    if (error) console.warn("onboarding: no se pudo guardar onboarding_done (¿falta la migración 0018?):", error.message);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center px-4 py-6 gap-5">
      <div className="w-full max-w-[460px] flex items-center gap-3">
        <Mascot mood="happy" size={72} />
        <div>
          <h1 className="text-xl font-extrabold leading-tight">¡Hola{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
          <p className="text-sm text-white/55">Tres preguntas rápidas para dejar todo listo.</p>
        </div>
      </div>

      <div className="w-full max-w-[460px] flex items-center gap-2" aria-label={`Paso ${step + 1} de 3`}>
        {steps.map((s, i) => (
          <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: i <= step ? "#f4f4f5" : "#3b3b3f" }} />
        ))}
      </div>

      <DarkCard className="w-full max-w-[460px] flex flex-col gap-4">
        <p className="text-[17px] font-extrabold">{steps[step]}</p>

        {step === 0 && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Sexo</span>
              <div className="flex gap-2">
                <Chip active={sexo === "hombre"} onClick={() => setSexo("hombre")}>Hombre</Chip>
                <Chip active={sexo === "mujer"} onClick={() => setSexo("mujer")}>Mujer</Chip>
              </div>
              <span className="text-xs text-white/40">Se usa solo para la fórmula de calorías (Mifflin-St Jeor).</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Edad" unit="años" value={edad} onChange={setEdad} min={12} max={100} />
              <NumberField label="Peso" unit="kg" value={peso} onChange={setPeso} min={30} max={300} />
              <NumberField label="Altura" unit="cm" value={altura} onChange={setAltura} min={120} max={230} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">¿Qué quieres lograr?</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(OBJETIVO_LABELS) as ObjetivoCalorico[]).map((o) => (
                  <Chip key={o} active={objetivo === o} onClick={() => setObjetivo(o)}>
                    {OBJETIVO_LABELS[o]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Tu día a día</span>
              <div className="flex flex-col gap-2">
                {ACTIVITY_LEVELS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={actividad === a.value}
                    onClick={() => setActividad(a.value)}
                    className="text-left rounded-[18px] p-3 cursor-pointer"
                    style={{ background: actividad === a.value ? "#2b2b2e" : "transparent", border: actividad === a.value ? "1px solid rgba(255,255,255,0.35)" : BORDER }}
                  >
                    <p className="text-[14px] font-extrabold">{a.label}</p>
                    <p className="text-xs text-white/50">{a.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Tiempo entrenando</span>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCIAS.map((e) => (
                  <Chip key={e.v} active={experiencia === e.v} onClick={() => setExperiencia(e.v)}>
                    {e.l}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Días por semana</span>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((d) => (
                  <Chip key={d} active={dias === d} onClick={() => setDias(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">Dónde entrenas</span>
              <div className="flex flex-wrap gap-2">
                {EQUIPOS.map((e) => (
                  <Chip key={e.v} active={equipo === e.v} onClick={() => setEquipo(e.v)}>
                    {e.l}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          {step > 0 ? (
            <Btn onClick={() => setStep(step - 1)}>Atrás</Btn>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Btn variant="light" disabled={step === 0 && !bodyOk} onClick={() => setStep(step + 1)}>
              Siguiente
            </Btn>
          ) : (
            <Btn variant="light" disabled={saving} onClick={finish}>
              {saving ? "Guardando…" : "Empezar"}
            </Btn>
          )}
        </div>
      </DarkCard>
      <p className="text-xs text-white/35 max-w-[420px] text-center">Después puedes cambiar todo esto en Calorías y en Entrenamiento.</p>
    </div>
  );
}
