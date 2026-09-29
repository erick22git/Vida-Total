"use client";

/**
 * Formulario de "Verificación / Configurar calorías" — rediseño en 6 páginas (referencia del usuario:
 * fondo negro, X arriba a la izquierda, contador "N / 6" arriba al centro, título grande en dos líneas,
 * "Continuar" como píldora abajo):
 *   1. Nombre del alimento (el campo grande, como el ejemplo "Manzana" de la referencia)
 *   2. Marca / Categoría / Código de barras
 *   3. Información nutricional — SIN tarjeta, todo directo sobre el fondo negro y en una grilla bien
 *      compacta: tiene que entrar entero en la pantalla, sin barra de scroll.
 *   4. Vitaminas (opcional)
 *   5. Minerales (opcional)
 *   6. Foto (arriba, reemplaza el ícono/emoji del alimento) + botón "Marcar como verificado" (abajo,
 *      manual — ahí se guarda todo lo cargado Y queda verificado). "Guardar cambios" sigue disponible
 *      para guardar sin verificar (p.ej. mientras se sigue completando otro día).
 * La lógica de guardado (`buildPatch`/`addCustomFood`/`upsertFoodOverride`) es la misma de siempre —
 * este rediseño solo cambia cómo se piden los datos.
 */
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ImagePlus, ShieldCheck, X } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { FOOD_CATEGORIES } from "@/lib/types";
import { MICRONUTRIENT_LABELS, mergeFoods } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MONO_FONT } from "@/lib/ui/mono-font";

const STEP_COUNT = 6;

/** Campo grande sin ningún contenedor — un renglón de texto sobre el fondo negro con una línea abajo. */
function PlainField({
  label,
  value,
  onChange,
  placeholder,
  unit,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <label className={compact ? "text-[9px] uppercase tracking-wide text-white/40 truncate" : "text-xs uppercase tracking-wide text-white/40"}>
        {label}
        {unit && <span className="text-white/25"> ({unit})</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={unit ? "decimal" : "text"}
        type={unit ? "number" : "text"}
        className={`w-full bg-transparent outline-none text-white placeholder:text-white/20 border-b border-white/15 focus:border-white/50 transition-colors ${
          compact ? "text-[15px] py-0.5" : "text-base py-1"
        }`}
      />
    </div>
  );
}

export default function CrearAlimentoPage() {
  return (
    <Suspense fallback={null}>
      <CrearAlimentoWizard />
    </Suspense>
  );
}

function CrearAlimentoWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBarcode = searchParams.get("barcode") ?? "";
  const fromScan = searchParams.get("fromScan") === "1";
  const editId = searchParams.get("editId");
  const returnTo = searchParams.get("returnTo");

  const addCustomFood = useGymStore((s) => s.addCustomFood);
  const upsertFoodOverride = useGymStore((s) => s.upsertFoodOverride);
  const customFoods = useGymStore((s) => s.customFoods);
  const editingFood = editId ? mergeFoods(customFoods).find((f) => f.id === editId) : undefined;
  const isEditing = !!editId;

  const numToStr = (n: number | undefined) => (n ? String(n) : "");

  const [marca, setMarca] = useState(() => editingFood?.marca ?? "");
  const [nombre, setNombre] = useState(() => editingFood?.nombre ?? "");
  const [categoria, setCategoria] = useState<string>(() => editingFood?.categoria ?? FOOD_CATEGORIES[0]);
  const [barcode, setBarcode] = useState(() => editingFood?.barcode ?? prefillBarcode);

  const [porcionNombre, setPorcionNombre] = useState(() => editingFood?.porcion ?? "unidad");
  const [peso, setPeso] = useState("100");
  const [unidadPeso, setUnidadPeso] = useState<"g" | "ml" | "oz">("g");

  const [calorias, setCalorias] = useState(() => numToStr(editingFood?.calorias));
  const [grasas, setGrasas] = useState(() => numToStr(editingFood?.grasas));
  const [grasasSaturadas, setGrasasSaturadas] = useState(() => numToStr(editingFood?.grasasSaturadas));
  const [grasasTrans, setGrasasTrans] = useState(() => numToStr(editingFood?.grasasTrans));
  const [colesterol, setColesterol] = useState(() => numToStr(editingFood?.colesterol));
  const [sodio, setSodio] = useState(() => numToStr(editingFood?.sodio));
  const [carbos, setCarbos] = useState(() => numToStr(editingFood?.carbos));
  const [fibra, setFibra] = useState(() => numToStr(editingFood?.fibra));
  const [azucares, setAzucares] = useState(() => numToStr(editingFood?.azucares));
  const [azucaresAnadidos, setAzucaresAnadidos] = useState(() => numToStr(editingFood?.azucaresAnadidos));
  const [proteina, setProteina] = useState(() => numToStr(editingFood?.proteina));

  const [micro, setMicro] = useState<Record<string, string>>(() => {
    if (!editingFood?.micronutrientes) return {};
    const asStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(editingFood.micronutrientes)) asStrings[k] = String(v);
    return asStrings;
  });
  const [confirmVerify, setConfirmVerify] = useState(false);
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
  const [photo, setPhoto] = useState<string | null>(() => editingFood?.photoUrl ?? scannedPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);

  const canSave = nombre.trim().length > 0 && porcionNombre.trim().length > 0 && calorias.trim().length > 0;
  const stepValid = step !== 0 || nombre.trim().length > 0;

  function buildPatch() {
    const pesoNum = parseFloat(peso) || 100;
    const microValues: Record<string, number> = {};
    for (const [key, v] of Object.entries(micro)) {
      const n = parseFloat(v);
      if (!isNaN(n) && v.trim() !== "") microValues[key] = n;
    }
    return {
      nombre: nombre.trim(),
      marca: marca.trim() || undefined,
      categoria,
      porcion: isEditing ? porcionNombre.trim() : `${porcionNombre.trim()} (${pesoNum} ${unidadPeso})`,
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
      photoUrl: photo ?? undefined,
      configurado: true,
    };
  }

  function goToFood(id: string) {
    const returnSuffix = returnTo ? `?returnTo=${returnTo}` : "";
    router.push(`/gym/calorias/alimento/${id}${returnSuffix}`);
  }

  function handleSave() {
    if (!canSave) return;
    if (isEditing && editId) {
      upsertFoodOverride(editId, buildPatch());
      goToFood(editId);
      return;
    }
    const created = addCustomFood(buildPatch());
    goToFood(created.id);
  }

  function handleMarkVerified() {
    if (!canSave) return;
    if (isEditing && editId) {
      upsertFoodOverride(editId, { ...buildPatch(), verificado: true });
      goToFood(editId);
      return;
    }
    const created = addCustomFood({ ...buildPatch(), verificado: true });
    goToFood(created.id);
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const vitaminas = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "vitamina");
  const minerales = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "mineral");

  function close() {
    if (isEditing && editId) goToFood(editId);
    else router.back();
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-black text-white select-none overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />

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

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-5 overflow-hidden">
        {step === 0 && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-[34px] leading-[1.05] font-black tracking-tight uppercase">
              {isEditing ? "Configurar" : "Crear"}
              <br />
              Alimento
            </h1>
            <div className="flex-1 flex items-center justify-center">
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Manzana"
                className="w-full bg-transparent outline-none text-center text-[42px] font-bold text-white placeholder:text-white/25"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col gap-8 justify-center">
            <h1 className="text-[26px] leading-[1.1] font-black tracking-tight uppercase mb-2">Más datos</h1>
            <PlainField label="Marca" value={marca} onChange={setMarca} placeholder="Sin marca" />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wide text-white/40">Categoría</label>
              <div className="flex flex-wrap gap-2">
                {FOOD_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoria(c)}
                    className="rounded-full px-3.5 py-1.5 text-xs cursor-pointer transition-colors"
                    style={{
                      background: categoria === c ? "#fff" : "rgba(255,255,255,0.08)",
                      color: categoria === c ? "#000" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <PlainField label="Código de barras" value={barcode} onChange={setBarcode} placeholder="7501234567890" />
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-0">
            <h1 className="text-[24px] leading-[1.1] font-black tracking-tight uppercase mb-3 shrink-0">Información nutricional</h1>
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5 overflow-hidden">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <PlainField label="Porción" value={porcionNombre} onChange={setPorcionNombre} placeholder="unidad, taza..." compact />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <label className="text-[9px] uppercase tracking-wide text-white/40">Peso</label>
                  <div className="flex items-center gap-1.5 border-b border-white/15">
                    <input
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none text-white text-[15px] py-0.5 min-w-0"
                    />
                    {(["g", "ml", "oz"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnidadPeso(u)}
                        className="text-[10px] px-1 shrink-0 cursor-pointer"
                        style={{ color: unidadPeso === u ? "#fff" : "rgba(255,255,255,0.35)" }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <PlainField label="Calorías" value={calorias} onChange={setCalorias} unit="kcal" compact />
                <PlainField label="Proteínas" value={proteina} onChange={setProteina} unit="g" compact />
                <PlainField label="Grasas totales" value={grasas} onChange={setGrasas} unit="g" compact />
                <PlainField label="Carbohidratos" value={carbos} onChange={setCarbos} unit="g" compact />
                <PlainField label="Grasas saturadas" value={grasasSaturadas} onChange={setGrasasSaturadas} unit="g" compact />
                <PlainField label="Fibra" value={fibra} onChange={setFibra} unit="g" compact />
                <PlainField label="Grasas trans" value={grasasTrans} onChange={setGrasasTrans} unit="g" compact />
                <PlainField label="Azúcares" value={azucares} onChange={setAzucares} unit="g" compact />
                <PlainField label="Colesterol" value={colesterol} onChange={setColesterol} unit="mg" compact />
                <PlainField label="Azúc. añadidos" value={azucaresAnadidos} onChange={setAzucaresAnadidos} unit="g" compact />
                <PlainField label="Sodio" value={sodio} onChange={setSodio} unit="mg" compact />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col min-h-0">
            <h1 className="text-[24px] leading-[1.1] font-black tracking-tight uppercase mb-1 shrink-0">Vitaminas</h1>
            <p className="text-xs text-white/35 mb-3 shrink-0">Opcional</p>
            <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
              <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                {vitaminas.map(([key, { label, unit }]) => (
                  <PlainField
                    key={key}
                    label={label.replace("Vitamina ", "Vit. ")}
                    value={micro[key] ?? ""}
                    onChange={(v) => setMicro((m) => ({ ...m, [key]: v }))}
                    unit={unit}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col min-h-0">
            <h1 className="text-[24px] leading-[1.1] font-black tracking-tight uppercase mb-1 shrink-0">Minerales</h1>
            <p className="text-xs text-white/35 mb-3 shrink-0">Opcional</p>
            <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
              <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                {minerales.map(([key, { label, unit }]) => (
                  <PlainField
                    key={key}
                    label={label}
                    value={micro[key] ?? ""}
                    onChange={(v) => setMicro((m) => ({ ...m, [key]: v }))}
                    unit={unit}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex-1 flex flex-col min-h-0">
            <h1 className="text-[26px] leading-[1.1] font-black tracking-tight uppercase mb-6 shrink-0">Verificar</h1>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 mx-auto cursor-pointer"
            >
              <span
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl overflow-hidden"
                style={{ background: "#0d0d0d", border: "1.5px dashed rgba(255,255,255,0.25)" }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Foto del alimento" className="w-full h-full object-cover" />
                ) : (
                  categoryEmoji(categoria)
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <ImagePlus size={13} /> {photo ? "Cambiar foto" : "Agregar foto (opcional)"}
              </span>
            </button>

            <div className="flex-1" />

            {fromScan && (
              <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-white/45">Completá los datos del alimento detectado antes de guardar.</p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 shrink-0">
              {editingFood?.verificado ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5 justify-center">
                  <ShieldCheck size={14} /> Ya está verificado — el check verde aparece junto a su nombre.
                </p>
              ) : confirmVerify ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-white/60 text-center">
                    ¿Confirmás que estos datos son correctos? Va a aparecer con el check de &quot;Verificado&quot;.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkVerified}
                      disabled={!canSave}
                      className="flex-1 rounded-full py-3 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
                    >
                      Sí, marcar como verificado
                    </button>
                    <button
                      onClick={() => setConfirmVerify(false)}
                      className="flex-1 rounded-full py-3 text-sm font-semibold cursor-pointer bg-white/10 text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmVerify(true)}
                  disabled={!canSave}
                  className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
                >
                  <ShieldCheck size={15} /> Marcar como verificado
                </button>
              )}
              {!confirmVerify && (
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full rounded-full py-2.5 text-xs font-medium cursor-pointer disabled:opacity-30 text-white/50"
                >
                  {isEditing ? "Guardar sin verificar" : "Crear alimento sin verificar"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {step < STEP_COUNT - 1 && (
        <div className="px-6 pb-[max(env(safe-area-inset-bottom),18px)] shrink-0">
          <button
            onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
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
