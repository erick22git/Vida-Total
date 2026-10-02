"use client";

/**
 * Formulario de "Verificación / Configurar calorías" — 6 páginas (fondo negro, X arriba a la
 * izquierda, contador "N / 6" arriba al centro, título grande en dos líneas, "Continuar" abajo):
 *   1. Nombre del alimento
 *   2. Marca / Categoría / Código de barras
 *   3. Información nutricional — SIN tarjeta, todo directo sobre el fondo negro, en grilla bien
 *      compacta (tiene que entrar sin scroll). Arriba tiene el selector CRUDO/COCIDO.
 *   4. Vitaminas (opcional) — mismo selector CRUDO/COCIDO (los valores cambian con la cocción).
 *   5. Minerales (opcional) — ídem.
 *   6. Foto (arriba, reemplaza el ícono/emoji) + "Marcar como verificado" (abajo, manual).
 *
 * CRUDO/COCIDO: dos sets de datos INDEPENDIENTES (no una fórmula sobre el crudo, como antes) — ver
 * `Food.cocido` en src/lib/types/index.ts. Al terminar de cargar crudo (info nutricional + vitaminas
 * + minerales) sin haber tocado nada de cocido, se ofrece llenarlo ahora, guardarlo para después, o
 * marcar que este alimento no tiene un estado cocido que tenga sentido (pan, marraqueta) — o al
 * revés, uno sin estado crudo que tenga sentido (cebolla caramelizada, pollo apanado). "Marcar como
 * verificado" pide que los dos estados estén completos (o que se haya marcado "un solo estado").
 */
import { useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ImagePlus, ShieldCheck, X } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { FOOD_CATEGORIES } from "@/lib/types";
import type { CookedState, NutritionProfile } from "@/lib/types";
import { MICRONUTRIENT_LABELS, mergeFoods } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { MONO_FONT } from "@/lib/ui/mono-font";

const STEP_COUNT = 6;

const NUT_FIELD_KEYS = [
  "calorias",
  "proteina",
  "grasas",
  "carbos",
  "grasasSaturadas",
  "fibra",
  "grasasTrans",
  "azucares",
  "grasasMonoinsaturadas",
  "azucaresAnadidos",
  "grasasPoliinsaturadas",
  "colesterol",
  "omega3Ala",
  "sodio",
  "omega6Linoleico",
  "agua",
  "ceniza",
] as const;
type NutFieldKey = (typeof NUT_FIELD_KEYS)[number];

const NUT_FIELD_META: Record<NutFieldKey, { label: string; unit: string }> = {
  calorias: { label: "Calorías", unit: "kcal" },
  proteina: { label: "Proteínas", unit: "g" },
  grasas: { label: "Grasas totales", unit: "g" },
  carbos: { label: "Carbohidratos", unit: "g" },
  grasasSaturadas: { label: "Grasas saturadas", unit: "g" },
  fibra: { label: "Fibra", unit: "g" },
  grasasTrans: { label: "Grasas trans", unit: "g" },
  azucares: { label: "Azúcares", unit: "g" },
  grasasMonoinsaturadas: { label: "Grasas monoinsat.", unit: "g" },
  azucaresAnadidos: { label: "Azúc. añadidos", unit: "g" },
  grasasPoliinsaturadas: { label: "Grasas poliinsat.", unit: "g" },
  colesterol: { label: "Colesterol", unit: "mg" },
  omega3Ala: { label: "Omega-3 (ALA)", unit: "g" },
  sodio: { label: "Sodio", unit: "mg" },
  omega6Linoleico: { label: "Omega-6 (linoleico)", unit: "g" },
  agua: { label: "Agua", unit: "g" },
  ceniza: { label: "Ceniza", unit: "g" },
};

interface NutForm {
  fields: Record<NutFieldKey, string>;
  micro: Record<string, string>;
}

function emptyNutForm(): NutForm {
  const fields = {} as Record<NutFieldKey, string>;
  for (const k of NUT_FIELD_KEYS) fields[k] = "";
  return { fields, micro: {} };
}

function nutFormFromProfile(p: NutritionProfile | null | undefined): NutForm {
  if (!p) return emptyNutForm();
  const numToStr = (n?: number) => (n ? String(n) : "");
  const fields = {} as Record<NutFieldKey, string>;
  for (const k of NUT_FIELD_KEYS) fields[k] = numToStr(p[k]);
  const micro: Record<string, string> = {};
  if (p.micronutrientes) for (const [k, v] of Object.entries(p.micronutrientes)) if (typeof v === "number") micro[k] = String(v);
  return { fields, micro };
}

function isNutFormEmpty(f: NutForm): boolean {
  return Object.values(f.fields).every((v) => v.trim() === "") && Object.values(f.micro).every((v) => v.trim() === "");
}

function buildProfileFromForm(f: NutForm): NutritionProfile {
  const num = (s: string) => (s.trim() === "" ? undefined : parseFloat(s));
  const microValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.micro)) {
    const n = parseFloat(v);
    if (!isNaN(n) && v.trim() !== "") microValues[k] = n;
  }
  return {
    calorias: num(f.fields.calorias) ?? 0,
    proteina: num(f.fields.proteina) ?? 0,
    carbos: num(f.fields.carbos) ?? 0,
    grasas: num(f.fields.grasas) ?? 0,
    grasasSaturadas: num(f.fields.grasasSaturadas),
    grasasTrans: num(f.fields.grasasTrans),
    grasasMonoinsaturadas: num(f.fields.grasasMonoinsaturadas),
    grasasPoliinsaturadas: num(f.fields.grasasPoliinsaturadas),
    omega3Ala: num(f.fields.omega3Ala),
    omega6Linoleico: num(f.fields.omega6Linoleico),
    colesterol: num(f.fields.colesterol),
    sodio: num(f.fields.sodio),
    fibra: num(f.fields.fibra),
    azucares: num(f.fields.azucares),
    azucaresAnadidos: num(f.fields.azucaresAnadidos),
    agua: num(f.fields.agua),
    ceniza: num(f.fields.ceniza),
    micronutrientes: Object.keys(microValues).length > 0 ? microValues : undefined,
  };
}

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
          compact ? "text-[13px] py-0.5" : "text-base py-1"
        }`}
      />
    </div>
  );
}

/** Selector CRUDO/COCIDO — arriba de las 3 páginas de datos nutricionales. */
function CookedStateSwitch({ value, onChange }: { value: CookedState; onChange: (v: CookedState) => void }) {
  return (
    <div className="flex gap-1 rounded-full p-0.5 mb-3 shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
      {(["crudo", "cocido"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className="flex-1 rounded-full py-1.5 text-[11px] font-semibold uppercase tracking-wide cursor-pointer transition-colors"
          style={value === s ? { background: "#fff", color: "#000" } : { color: "rgba(255,255,255,0.5)" }}
        >
          {s}
        </button>
      ))}
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

  const [marca, setMarca] = useState(() => editingFood?.marca ?? "");
  const [nombre, setNombre] = useState(() => editingFood?.nombre ?? "");
  const [categoria, setCategoria] = useState<string>(() => editingFood?.categoria ?? FOOD_CATEGORIES[0]);
  const [barcode, setBarcode] = useState(() => editingFood?.barcode ?? prefillBarcode);

  const [porcionNombre, setPorcionNombre] = useState(() => editingFood?.porcion ?? "unidad");
  const [peso, setPeso] = useState("100");
  const [unidadPeso, setUnidadPeso] = useState<"g" | "ml" | "oz">("g");

  // Dos formularios independientes — ver comentario de arriba del archivo.
  const [crudoForm, setCrudoForm] = useState<NutForm>(() => nutFormFromProfile(editingFood ?? null));
  const [cocidoForm, setCocidoForm] = useState<NutForm>(() => nutFormFromProfile(editingFood?.cocido ?? null));
  const [foodState, setFoodState] = useState<CookedState>("crudo");
  const [unSoloEstado, setUnSoloEstado] = useState(() => editingFood?.unSoloEstado ?? false);
  const [cocidoAlertOpen, setCocidoAlertOpen] = useState(false);

  const activeForm = foodState === "crudo" ? crudoForm : cocidoForm;
  const setActiveForm = foodState === "crudo" ? setCrudoForm : setCocidoForm;
  function setNutField(key: NutFieldKey, v: string) {
    setActiveForm((f) => ({ ...f, fields: { ...f.fields, [key]: v } }));
  }
  function setMicroField(key: string, v: string) {
    setActiveForm((f) => ({ ...f, micro: { ...f.micro, [key]: v } }));
  }

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

  const canSave = nombre.trim().length > 0 && porcionNombre.trim().length > 0 && crudoForm.fields.calorias.trim().length > 0;
  const stepValid = step !== 0 || nombre.trim().length > 0;
  const cocidoFilled = !isNutFormEmpty(cocidoForm);
  const readyToVerify = canSave && (unSoloEstado || cocidoFilled);

  function buildPatch() {
    const pesoNum = parseFloat(peso) || 100;
    const crudoProfile = buildProfileFromForm(crudoForm);
    const cocidoProfile = cocidoFilled
      ? { ...buildProfileFromForm(cocidoForm), fdcId: editingFood?.cocido?.fdcId }
      : undefined;
    return {
      nombre: nombre.trim(),
      marca: marca.trim() || undefined,
      categoria,
      porcion: isEditing ? porcionNombre.trim() : `${porcionNombre.trim()} (${pesoNum} ${unidadPeso})`,
      pesoGramos: unidadPeso === "g" || unidadPeso === "ml" ? pesoNum : pesoNum * 28.35,
      ...crudoProfile,
      barcode: barcode.trim() || undefined,
      photoUrl: photo ?? undefined,
      configurado: true,
      cocido: cocidoProfile,
      unSoloEstado,
      // Se preservan explícitamente: este formulario no busca en USDA, así que si no se tocan acá
      // quedarían pisados por `undefined` en el merge de `upsertFoodOverride` (spread shallow).
      fdcIdCrudo: editingFood?.fdcIdCrudo,
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
    if (!readyToVerify) return;
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

  function handleContinue() {
    // Al terminar minerales (el último de los 3 pasos nutricionales) en modo CRUDO, sin haber
    // tocado nada de COCIDO todavía: ofrecer llenarlo ahora, dejarlo para después, o marcar que
    // este alimento no tiene sentido en dos estados — en vez de avanzar derecho a Verificar.
    if (step === 4 && foodState === "crudo" && !unSoloEstado && !isNutFormEmpty(crudoForm) && !cocidoFilled) {
      setCocidoAlertOpen(true);
      return;
    }
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  }

  const vitaminas = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "vitamina");
  const minerales = Object.entries(MICRONUTRIENT_LABELS).filter(([, v]) => v.group === "mineral");

  function close() {
    if (isEditing && editId) goToFood(editId);
    else router.back();
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col app-bg text-white select-none overflow-hidden">
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
            <h1 className="text-[24px] leading-[1.1] font-black tracking-tight uppercase mb-1 shrink-0">Información nutricional</h1>
            <CookedStateSwitch value={foodState} onChange={setFoodState} />
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 overflow-hidden">
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <PlainField label="Porción" value={porcionNombre} onChange={setPorcionNombre} placeholder="unidad, taza..." compact />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <label className="text-[9px] uppercase tracking-wide text-white/40">Peso</label>
                  <div className="flex items-center gap-1 border-b border-white/15">
                    <input
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none text-white text-[13px] py-0.5 min-w-0"
                    />
                    {(["g", "ml", "oz"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnidadPeso(u)}
                        className="text-[9px] px-0.5 shrink-0 cursor-pointer"
                        style={{ color: unidadPeso === u ? "#fff" : "rgba(255,255,255,0.35)" }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <span />
                {NUT_FIELD_KEYS.map((key) => (
                  <PlainField
                    key={key}
                    label={NUT_FIELD_META[key].label}
                    value={activeForm.fields[key]}
                    onChange={(v) => setNutField(key, v)}
                    unit={NUT_FIELD_META[key].unit}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col min-h-0">
            <h1 className="text-[24px] leading-[1.1] font-black tracking-tight uppercase mb-1 shrink-0">Vitaminas</h1>
            <p className="text-xs text-white/35 mb-2 shrink-0">Opcional</p>
            <CookedStateSwitch value={foodState} onChange={setFoodState} />
            <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
              <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                {vitaminas.map(([key, { label, unit }]) => (
                  <PlainField
                    key={key}
                    label={label.replace("Vitamina ", "Vit. ")}
                    value={activeForm.micro[key] ?? ""}
                    onChange={(v) => setMicroField(key, v)}
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
            <p className="text-xs text-white/35 mb-2 shrink-0">Opcional</p>
            <CookedStateSwitch value={foodState} onChange={setFoodState} />
            <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
              <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                {minerales.map(([key, { label, unit }]) => (
                  <PlainField
                    key={key}
                    label={label}
                    value={activeForm.micro[key] ?? ""}
                    onChange={(v) => setMicroField(key, v)}
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

            {!unSoloEstado && !cocidoFilled && !editingFood?.verificado && (
              <p className="text-[11px] text-amber-300/80 text-center mb-2">
                Falta la versión cocida (o marcá que no aplica) para poder verificar.
              </p>
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
                      disabled={!readyToVerify}
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
                  disabled={!readyToVerify}
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
            onClick={handleContinue}
            disabled={!stepValid}
            className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer transition-opacity disabled:opacity-30 bg-white text-black"
          >
            Continuar
          </button>
        </div>
      )}

      {cocidoAlertOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setCocidoAlertOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-3" style={{ background: "#141414" }}>
            <h2 className="text-[15px] uppercase tracking-[0.1em]" style={MONO_FONT}>
              Falta llenar la versión cocida
            </h2>
            <p className="text-xs text-white/55">
              Cargaste el estado crudo, pero todavía no hay datos de cocido. Los dos estados son sets de datos
              independientes — el cocido no se calcula solo a partir del crudo.
            </p>
            <button
              onClick={() => {
                setFoodState("cocido");
                setStep(2);
                setCocidoAlertOpen(false);
              }}
              className="w-full rounded-full py-3 text-sm font-semibold cursor-pointer bg-white text-black"
            >
              Llenarlo ahora
            </button>
            <button
              onClick={() => {
                setStep(5);
                setCocidoAlertOpen(false);
              }}
              className="w-full rounded-full py-3 text-sm font-semibold cursor-pointer bg-white/10 text-white"
            >
              Guardar solo crudo por ahora
            </button>
            <button
              onClick={() => {
                setUnSoloEstado(true);
                setStep(5);
                setCocidoAlertOpen(false);
              }}
              className="w-full rounded-full py-2.5 text-xs font-medium cursor-pointer text-white/45"
            >
              No aplica un estado cocido para este alimento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
