"use client";

/**
 * Perfil avanzado — Configuración > Perfil de entrenamiento > Avanzado. Mismo patrón visual que
 * /gym/entrenamiento/configurar-perfil (wizard por páginas, X arriba, contador, "Continuar" abajo).
 *
 * Todo lo de acá es OPCIONAL y se guarda como una entrada NUEVA con fecha (nunca se sobrescribe el
 * historial — así se puede graficar tendencia más adelante). La composición corporal es una
 * ESTIMACIÓN de báscula de bioimpedancia, no un dato de laboratorio: se aclara en la UI. El IMC se
 * calcula con peso/altura ya cargados en el perfil (no se piden de nuevo) y se muestra como índice
 * aproximado, no diagnóstico.
 *
 * La foto para estimar % de grasa por IA queda preparada acá (se guarda, se resize con
 * `resizeImageFile`) pero el CÁLCULO automático no está implementado — ver docs/roadmap/vision-entrenador.md.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { imc, imcCategoria, type ImcCategoria } from "@/lib/training/body-composition";
import { resizeImageFile } from "@/lib/ui/resize-image";
import { MONO_FONT } from "@/lib/ui/mono-font";

type StepKind = "intro" | "bioimpedancia" | "imc" | "perimetros" | "foto" | "resumen";
const STEPS: StepKind[] = ["intro", "bioimpedancia", "imc", "perimetros", "foto", "resumen"];

const IMC_LABELS: Record<ImcCategoria, string> = {
  bajo_peso: "Bajo peso",
  normal: "Normal",
  sobrepeso: "Sobrepeso",
  obesidad: "Obesidad",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[28px] leading-[1.05] font-black tracking-tight uppercase">{children}</h1>;
}

function Field({
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
        className="w-full bg-transparent outline-none text-white text-xl font-semibold placeholder:text-white/20 border-b border-white/15 focus:border-white/50 transition-colors py-1.5"
      />
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

export default function PerfilAvanzadoPage() {
  const router = useRouter();
  const gymProfile = useGymStore((s) => s.gymProfile);
  const addBodyCompositionEntry = useGymStore((s) => s.addBodyCompositionEntry);
  const addBodyMeasurementEntry = useGymStore((s) => s.addBodyMeasurementEntry);

  const [step, setStep] = useState(0);
  const kind = STEPS[step];
  const [date, setDate] = useState(todayISO());

  const [grasaPct, setGrasaPct] = useState("");
  const [masaMuscularPct, setMasaMuscularPct] = useState("");
  const [grasaVisceral, setGrasaVisceral] = useState("");
  const [aguaPct, setAguaPct] = useState("");
  const [masaOseaKg, setMasaOseaKg] = useState("");
  const [metabolismoBasalKcal, setMetabolismoBasalKcal] = useState("");

  const [cuelloCm, setCuelloCm] = useState("");
  const [pechoCm, setPechoCm] = useState("");
  const [cinturaCm, setCinturaCm] = useState("");
  const [caderaCm, setCaderaCm] = useState("");
  const [brazoRelajadoCm, setBrazoRelajadoCm] = useState("");
  const [brazoContraidoCm, setBrazoContraidoCm] = useState("");
  const [musloCm, setMusloCm] = useState("");
  const [pantorrillaCm, setPantorrillaCm] = useState("");

  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const imcValue = gymProfile?.pesoKg && gymProfile?.alturaCm ? imc(gymProfile.pesoKg, gymProfile.alturaCm) : null;

  function close() {
    router.back();
  }
  function next() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resizeImageFile(file)
      .then(setPhoto)
      .catch(() => {
        setNotice("No se pudo procesar esa foto. Probá con otra.");
        setTimeout(() => setNotice(null), 2500);
      });
  }

  function num(s: string): number | undefined {
    const n = parseFloat(s);
    return isNaN(n) || n <= 0 ? undefined : n;
  }

  function save() {
    const composition = {
      date,
      grasaPct: num(grasaPct),
      masaMuscularPct: num(masaMuscularPct),
      grasaVisceral: num(grasaVisceral),
      aguaPct: num(aguaPct),
      masaOseaKg: num(masaOseaKg),
      metabolismoBasalKcal: num(metabolismoBasalKcal),
      photoUrl: photo ?? undefined,
    };
    const hasComposition = Object.entries(composition).some(([k, v]) => k !== "date" && v !== undefined);
    if (hasComposition) addBodyCompositionEntry(composition);

    const measurement = {
      date,
      cuelloCm: num(cuelloCm),
      pechoCm: num(pechoCm),
      cinturaCm: num(cinturaCm),
      caderaCm: num(caderaCm),
      brazoRelajadoCm: num(brazoRelajadoCm),
      brazoContraidoCm: num(brazoContraidoCm),
      musloCm: num(musloCm),
      pantorrillaCm: num(pantorrillaCm),
    };
    const hasMeasurement = Object.entries(measurement).some(([k, v]) => k !== "date" && v !== undefined);
    if (hasMeasurement) addBodyMeasurementEntry(measurement);

    close();
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col app-bg text-white select-none overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
      {notice && (
        <div className="fixed top-16 inset-x-0 z-[95] flex justify-center px-4 pointer-events-none">
          <span className="rounded-full bg-black/85 px-4 py-2 text-xs text-amber-200">{notice}</span>
        </div>
      )}

      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] shrink-0">
        <button onClick={close} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/80">
          <X size={22} />
        </button>
        <span className="text-sm text-white/50 tabular-nums" style={MONO_FONT}>
          {step + 1} / {STEPS.length}
        </span>
        {step > 0 ? (
          <button onClick={back} aria-label="Atrás" className="w-9 h-9 flex items-center justify-center cursor-pointer text-white/50">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <span className="w-9 h-9" />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-5 overflow-y-auto no-scrollbar">
        {kind === "intro" && (
          <div className="flex-1 flex flex-col gap-5 justify-center">
            <Title>
              Perfil
              <br />
              avanzado
            </Title>
            <p className="text-sm text-white/55">
              Composición corporal de tu báscula, perímetros y una foto opcional. Todo es opcional y queda guardado con
              fecha — podés agregar una medición nueva cuando quieras, sin perder las anteriores.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-white/40">Fecha de esta medición</label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                max={todayISO()}
                className="w-full bg-transparent outline-none text-white text-lg font-semibold border-b border-white/15 focus:border-white/50 transition-colors py-1.5"
              />
            </div>
          </div>
        )}

        {kind === "bioimpedancia" && (
          <div className="flex-1 flex flex-col gap-4">
            <Title>Composición corporal</Title>
            <p className="text-xs text-amber-300/80">
              Son los valores que reporta tu báscula de bioimpedancia: una ESTIMACIÓN, no una medida de laboratorio
              (DEXA o calibre). Dejá en blanco lo que tu báscula no mida.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Grasa corporal" value={grasaPct} onChange={setGrasaPct} unit="%" placeholder="18" />
              <Field label="Masa muscular" value={masaMuscularPct} onChange={setMasaMuscularPct} unit="%" placeholder="42" />
              <Field label="Grasa visceral" value={grasaVisceral} onChange={setGrasaVisceral} unit="índice" placeholder="7" />
              <Field label="Agua corporal" value={aguaPct} onChange={setAguaPct} unit="%" placeholder="55" />
              <Field label="Masa ósea" value={masaOseaKg} onChange={setMasaOseaKg} unit="kg" placeholder="3.2" />
              <Field label="Metabolismo basal" value={metabolismoBasalKcal} onChange={setMetabolismoBasalKcal} unit="kcal" placeholder="1800" />
            </div>
          </div>
        )}

        {kind === "imc" && (
          <div className="flex-1 flex flex-col gap-5 justify-center">
            <Title>IMC</Title>
            {imcValue ? (
              <div className="rounded-3xl p-5 flex flex-col gap-1 items-center" style={{ background: "#0d0d0d" }}>
                <span className="text-4xl font-black tabular-nums">{imcValue.toFixed(1)}</span>
                <span className="text-sm text-white/55">{IMC_LABELS[imcCategoria(imcValue)]}</span>
              </div>
            ) : (
              <p className="text-sm text-white/50">
                Falta tu peso o altura en el perfil para calcularlo — cargalos en el perfil de entrenamiento básico.
              </p>
            )}
            <p className="text-xs text-white/35">
              Calculado con tu peso y altura ya guardados (kg / m²). Es un índice aproximado, no un diagnóstico: no
              distingue masa muscular de grasa.
            </p>
          </div>
        )}

        {kind === "perimetros" && (
          <div className="flex-1 flex flex-col gap-4">
            <Title>Perímetros</Title>
            <p className="text-xs text-white/40">En centímetros. Dejá en blanco lo que no midas.</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Cuello" value={cuelloCm} onChange={setCuelloCm} unit="cm" placeholder="38" />
              <Field label="Pecho" value={pechoCm} onChange={setPechoCm} unit="cm" placeholder="100" />
              <Field label="Cintura" value={cinturaCm} onChange={setCinturaCm} unit="cm" placeholder="85" />
              <Field label="Cadera" value={caderaCm} onChange={setCaderaCm} unit="cm" placeholder="98" />
              <Field label="Brazo relajado" value={brazoRelajadoCm} onChange={setBrazoRelajadoCm} unit="cm" placeholder="33" />
              <Field label="Brazo contraído" value={brazoContraidoCm} onChange={setBrazoContraidoCm} unit="cm" placeholder="36" />
              <Field label="Muslo" value={musloCm} onChange={setMusloCm} unit="cm" placeholder="58" />
              <Field label="Pantorrilla" value={pantorrillaCm} onChange={setPantorrillaCm} unit="cm" placeholder="38" />
            </div>
          </div>
        )}

        {kind === "foto" && (
          <div className="flex-1 flex flex-col gap-5 justify-center items-center">
            <Title>Foto</Title>
            <p className="text-xs text-white/45 text-center px-4">
              Se guarda junto a esta medición. Por ahora no se calcula nada automático a partir de ella — es para
              comparar vos mismo a futuro.
            </p>
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 cursor-pointer">
              <span
                className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: "#0d0d0d", border: "1.5px dashed rgba(255,255,255,0.25)" }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Foto de composición corporal" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={28} className="text-white/40" />
                )}
              </span>
              <span className="text-xs text-white/50">{photo ? "Cambiar foto" : "Agregar foto (opcional)"}</span>
            </button>
          </div>
        )}

        {kind === "resumen" && (
          <div className="flex-1 flex flex-col gap-4">
            <Title>Resumen</Title>
            <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: "#0d0d0d" }}>
              <Row label="Fecha" value={date} />
              <Row label="Grasa corporal" value={grasaPct ? `${grasaPct}%` : "—"} />
              <Row label="Masa muscular" value={masaMuscularPct ? `${masaMuscularPct}%` : "—"} />
              <Row label="Grasa visceral" value={grasaVisceral || "—"} />
              <Row label="Agua corporal" value={aguaPct ? `${aguaPct}%` : "—"} />
              <Row label="Masa ósea" value={masaOseaKg ? `${masaOseaKg} kg` : "—"} />
              <Row label="Metabolismo basal" value={metabolismoBasalKcal ? `${metabolismoBasalKcal} kcal` : "—"} />
              <Row label="Cuello" value={cuelloCm ? `${cuelloCm} cm` : "—"} />
              <Row label="Pecho" value={pechoCm ? `${pechoCm} cm` : "—"} />
              <Row label="Cintura" value={cinturaCm ? `${cinturaCm} cm` : "—"} />
              <Row label="Cadera" value={caderaCm ? `${caderaCm} cm` : "—"} />
              <Row label="Brazo relajado" value={brazoRelajadoCm ? `${brazoRelajadoCm} cm` : "—"} />
              <Row label="Brazo contraído" value={brazoContraidoCm ? `${brazoContraidoCm} cm` : "—"} />
              <Row label="Muslo" value={musloCm ? `${musloCm} cm` : "—"} />
              <Row label="Pantorrilla" value={pantorrillaCm ? `${pantorrillaCm} cm` : "—"} />
              <Row label="Foto" value={photo ? "Sí" : "—"} />
            </div>
            <button onClick={save} className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black">
              Guardar medición
            </button>
          </div>
        )}
      </div>

      {kind !== "resumen" && (
        <div className="px-6 pb-[max(env(safe-area-inset-bottom),18px)] shrink-0 flex flex-col gap-1">
          <button onClick={next} className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer bg-white text-black">
            Continuar
          </button>
          <button onClick={next} className="w-full py-2 text-xs font-medium cursor-pointer text-white/45">
            Omitir
          </button>
        </div>
      )}
    </div>
  );
}
