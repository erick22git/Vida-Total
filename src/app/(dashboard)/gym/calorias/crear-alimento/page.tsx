"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";
import { FOOD_CATEGORIES } from "@/lib/types";
import { MICRONUTRIENT_LABELS } from "@/lib/food-utils";

function Field({
  label,
  value,
  onChange,
  unit,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50">
        {label}
        {required && <span className="text-[var(--gym)]"> *</span>}
        {unit && <span className="text-white/30"> ({unit})</span>}
      </label>
      <GlassInput type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function CrearAlimentoPage() {
  return (
    <Suspense fallback={null}>
      <CrearAlimentoForm />
    </Suspense>
  );
}

function CrearAlimentoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBarcode = searchParams.get("barcode") ?? "";
  const fromScan = searchParams.get("fromScan") === "1";

  const addCustomFood = useGymStore((s) => s.addCustomFood);

  const [marca, setMarca] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<string>(FOOD_CATEGORIES[0]);
  const [barcode, setBarcode] = useState(prefillBarcode);

  const [porcionNombre, setPorcionNombre] = useState("unidad");
  const [peso, setPeso] = useState("100");
  const [unidadPeso, setUnidadPeso] = useState<"g" | "ml" | "oz">("g");

  const [calorias, setCalorias] = useState("");
  const [grasas, setGrasas] = useState("");
  const [grasasSaturadas, setGrasasSaturadas] = useState("");
  const [grasasTrans, setGrasasTrans] = useState("");
  const [colesterol, setColesterol] = useState("");
  const [sodio, setSodio] = useState("");
  const [carbos, setCarbos] = useState("");
  const [fibra, setFibra] = useState("");
  const [azucares, setAzucares] = useState("");
  const [azucaresAnadidos, setAzucaresAnadidos] = useState("");
  const [proteina, setProteina] = useState("");

  const [microOpen, setMicroOpen] = useState(false);
  const [micro, setMicro] = useState<Record<string, string>>({});
  const [scannedPhoto] = useState<string | null>(() => {
    if (typeof window === "undefined" || !fromScan) return null;
    try {
      const stored = sessionStorage.getItem("vt-scanned-photo");
      if (stored) sessionStorage.removeItem("vt-scanned-photo");
      return stored;
    } catch {
      return null;
    }
  });

  const canSave = nombre.trim().length > 0 && porcionNombre.trim().length > 0 && calorias.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const pesoNum = parseFloat(peso) || 100;
    const microValues: Record<string, number> = {};
    for (const [key, v] of Object.entries(micro)) {
      const n = parseFloat(v);
      if (!isNaN(n) && v.trim() !== "") microValues[key] = n;
    }

    const created = addCustomFood({
      nombre: nombre.trim(),
      marca: marca.trim() || undefined,
      categoria,
      porcion: `${porcionNombre.trim()} (${pesoNum} ${unidadPeso})`,
      pesoGramos: unidadPeso === "g" || unidadPeso === "ml" ? pesoNum : pesoNum * 28.35,
      calorias: parseFloat(calorias) || 0,
      proteina: parseFloat(proteina) || 0,
      carbos: parseFloat(carbos) || 0,
      grasas: parseFloat(grasas) || 0,
      grasasSaturadas: grasasSaturadas ? parseFloat(grasasSaturadas) : undefined,
      grasasTrans: grasasTrans ? parseFloat(grasasTrans) : undefined,
      colesterol: colesterol ? parseFloat(colesterol) : undefined,
      sodio: sodio ? parseFloat(sodio) : undefined,
      fibra: fibra ? parseFloat(fibra) : undefined,
      azucares: azucares ? parseFloat(azucares) : undefined,
      azucaresAnadidos: azucaresAnadidos ? parseFloat(azucaresAnadidos) : undefined,
      barcode: barcode.trim() || undefined,
      micronutrientes: Object.keys(microValues).length > 0 ? microValues : undefined,
      photoUrl: scannedPhoto,
    });

    router.push(`/gym/calorias/alimento/${created.id}`);
  }

  const vitaminas = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "vitamina");
  const minerales = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "mineral");

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Crear Alimento</h1>
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
        >
          <X size={18} className="text-white" />
        </button>
      </header>

      {fromScan && (
        <div className="flex items-center gap-3 bg-white/[0.05] rounded-xl glass-specular-ring px-3 py-2">
          {scannedPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={scannedPhoto} alt="Foto capturada" className="w-12 h-12 rounded-xl object-cover shrink-0" />
          )}
          <p className="text-xs text-white/50">Completa los datos del alimento detectado.</p>
        </div>
      )}

      <GlassCard padding="md" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Marca</label>
          <GlassInput placeholder="Sin marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">
            Nombre <span className="text-[var(--gym)]">*</span>
          </label>
          <GlassInput placeholder="Ej. Pechuga de pollo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-sm text-white outline-none focus:shadow-[var(--glass-specular-strong)]"
          >
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[#1c1c22]">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Código de barras (opcional)</label>
          <GlassInput placeholder="7501234567890" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white">Información Nutricional</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">
              Nombre de porción <span className="text-[var(--gym)]">*</span>
            </label>
            <GlassInput placeholder="unidad, taza..." value={porcionNombre} onChange={(e) => setPorcionNombre(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Peso</label>
            <div className="flex gap-1.5">
              <GlassInput
                type="number"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="flex-1"
              />
              <select
                value={unidadPeso}
                onChange={(e) => setUnidadPeso(e.target.value as "g" | "ml" | "oz")}
                className="rounded-2xl bg-white/[0.06] glass-specular-ring px-2 text-sm text-white outline-none"
              >
                <option value="g" className="bg-[#1c1c22]">g</option>
                <option value="ml" className="bg-[#1c1c22]">ml</option>
                <option value="oz" className="bg-[#1c1c22]">oz</option>
              </select>
            </div>
          </div>
        </div>

        <Field label="Calorías" value={calorias} onChange={setCalorias} unit="kcal" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grasas totales" value={grasas} onChange={setGrasas} unit="g" />
          <Field label="Grasas saturadas" value={grasasSaturadas} onChange={setGrasasSaturadas} unit="g" />
          <Field label="Grasas trans" value={grasasTrans} onChange={setGrasasTrans} unit="g" />
          <Field label="Colesterol" value={colesterol} onChange={setColesterol} unit="mg" />
          <Field label="Sodio" value={sodio} onChange={setSodio} unit="mg" />
          <Field label="Carbohidratos totales" value={carbos} onChange={setCarbos} unit="g" />
          <Field label="Fibra" value={fibra} onChange={setFibra} unit="g" />
          <Field label="Azúcares" value={azucares} onChange={setAzucares} unit="g" />
          <Field label="Azúcares añadidos" value={azucaresAnadidos} onChange={setAzucaresAnadidos} unit="g" />
          <Field label="Proteínas" value={proteina} onChange={setProteina} unit="g" />
        </div>
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <button
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setMicroOpen((v) => !v)}
        >
          <h2 className="text-sm font-semibold text-white">Micronutrientes (opcional)</h2>
          {microOpen ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
        </button>
        {microOpen && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-white/40 mb-2">Vitaminas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {vitaminas.map(([key, { label, unit }]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/45 truncate">
                      {label} ({unit})
                    </label>
                    <GlassInput
                      type="number"
                      inputMode="decimal"
                      value={micro[key] ?? ""}
                      onChange={(e) => setMicro((m) => ({ ...m, [key]: e.target.value }))}
                      className="text-xs py-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-2">Minerales</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {minerales.map(([key, { label, unit }]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/45 truncate">
                      {label} ({unit})
                    </label>
                    <GlassInput
                      type="number"
                      inputMode="decimal"
                      value={micro[key] ?? ""}
                      onChange={(e) => setMicro((m) => ({ ...m, [key]: e.target.value }))}
                      className="text-xs py-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto">
          <GlassButton className="w-full" size="lg" disabled={!canSave} onClick={handleSave}>
            Crear Alimento
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
