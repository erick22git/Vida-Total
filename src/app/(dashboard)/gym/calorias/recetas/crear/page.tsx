"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Plus, Minus, Trash2, Camera, Link2, FileEdit } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { RecipeIngredientPicker } from "@/components/gym/recipe-ingredient-picker";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS, type MealType, type RecipeIngredient } from "@/lib/types";

type CreationMode = "manual" | "foto" | "enlace" | null;
const MEALS: MealType[] = ["desayuno", "almuerzo", "cena", "snack1", "snack2"];

export default function CrearRecetaPage() {
  return (
    <Suspense fallback={null}>
      <CrearRecetaForm />
    </Suspense>
  );
}

function CrearRecetaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipeId = searchParams.get("recipeId");
  const initialMode = (searchParams.get("mode") as CreationMode) ?? null;

  const recipes = useGymStore((s) => s.recipes);
  const addRecipe = useGymStore((s) => s.addRecipe);
  const updateRecipe = useGymStore((s) => s.updateRecipe);

  const existing = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;

  const [mode, setMode] = useState<CreationMode>(existing ? "manual" : initialMode);
  const [choosing, setChoosing] = useState(!existing && !initialMode);

  const [nombre, setNombre] = useState(existing?.nombre ?? "");
  const [foto, setFoto] = useState<string | null>(existing?.foto ?? null);
  const [porciones, setPorciones] = useState(existing?.porciones ?? 2);
  const [tiempoPrepMin, setTiempoPrepMin] = useState(existing?.tiempoPrepMin ?? 20);
  const [tipos, setTipos] = useState<MealType[]>(existing?.tipos ?? []);
  const [ingredientes, setIngredientes] = useState<RecipeIngredient[]>(existing?.ingredientes ?? []);
  const [instrucciones, setInstrucciones] = useState<string[]>(existing?.instrucciones ?? [""]);
  const [enlace, setEnlace] = useState(existing?.enlace ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Note: form fields are seeded from `existing` at initial mount via useState above.
  // If `recipeId` changes without a remount, the form intentionally keeps the
  // in-progress edits rather than silently overwriting them.

  const totales = ingredientes.reduce(
    (acc, i) => ({
      calorias: acc.calorias + i.calorias,
      proteina: acc.proteina + i.proteina,
      carbos: acc.carbos + i.carbos,
      grasas: acc.grasas + i.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function toggleTipo(t: MealType) {
    setTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function removeIngredient(idx: number) {
    setIngredientes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, value: string) {
    setInstrucciones((prev) => prev.map((s, i) => (i === idx ? value : s)));
  }

  const canSave = nombre.trim().length > 0 && (ingredientes.length > 0 || mode !== "manual");

  function handleSave() {
    if (!nombre.trim()) return;
    const payload = {
      nombre: nombre.trim(),
      foto,
      porciones,
      tiempoPrepMin,
      tipos: tipos.length ? tipos : (["almuerzo"] as MealType[]),
      ingredientes,
      instrucciones: instrucciones.filter((s) => s.trim().length > 0),
      totales,
      favorito: existing?.favorito ?? false,
      fuente: (mode ?? "manual") as "manual" | "foto" | "enlace" | "ia",
      enlace: enlace.trim() || undefined,
    };
    if (existing) {
      updateRecipe(existing.id, payload);
    } else {
      addRecipe(payload);
    }
    router.push("/gym/calorias/recetas");
  }

  if (choosing) {
    return (
      <GlassModal
        open
        onClose={() => router.push("/gym/calorias/recetas")}
        title="Elige cómo crear tu receta"
      >
        <div className="flex flex-col gap-2">
          <button
            className="flex items-center gap-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] glass-specular-ring px-4 py-3.5 text-left cursor-pointer"
            onClick={() => {
              setMode("manual");
              setChoosing(false);
            }}
          >
            <FileEdit size={18} className="text-[var(--gym)]" />
            <div>
              <p className="text-sm font-medium text-white">Manual</p>
              <p className="text-xs text-white/45">Completa el formulario paso a paso</p>
            </div>
          </button>
          <button
            className="flex items-center gap-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] glass-specular-ring px-4 py-3.5 text-left cursor-pointer"
            onClick={() => {
              setMode("foto");
              setChoosing(false);
            }}
          >
            <Camera size={18} className="text-[var(--gym)]" />
            <div>
              <p className="text-sm font-medium text-white">Desde una foto</p>
              <p className="text-xs text-white/45">Sube una foto y completa los datos después</p>
            </div>
          </button>
          <button
            className="flex items-center gap-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] glass-specular-ring px-4 py-3.5 text-left cursor-pointer"
            onClick={() => {
              setMode("enlace");
              setChoosing(false);
            }}
          >
            <Link2 size={18} className="text-[var(--gym)]" />
            <div>
              <p className="text-sm font-medium text-white">Desde un enlace</p>
              <p className="text-xs text-white/45">Guarda el enlace y completa el resto manualmente</p>
            </div>
          </button>
        </div>
      </GlassModal>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          {existing ? "Editar Receta" : "Crear Receta"}
        </h1>
        <button
          onClick={() => router.push("/gym/calorias/recetas")}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
        >
          <X size={18} className="text-white" />
        </button>
      </header>

      {mode === "enlace" && (
        <GlassCard padding="md" className="flex flex-col gap-2">
          <label className="text-xs text-white/50">Enlace de la receta</label>
          <GlassInput placeholder="https://..." value={enlace} onChange={(e) => setEnlace(e.target.value)} />
          <p className="text-[11px] text-white/35">Guardamos el enlace de referencia; completa los datos abajo manualmente.</p>
        </GlassCard>
      )}

      <GlassCard padding="md" className="flex flex-col gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-36 rounded-2xl bg-white/[0.04] border border-dashed border-white/[0.15] flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="Foto de la receta" className="w-full h-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-white/40 text-xs">
              <Camera size={22} /> {mode === "foto" ? "Sube la foto de tu plato" : "Agregar foto (opcional)"}
            </span>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {mode === "foto" && (
          <p className="text-[11px] text-white/35">
            No hay reconocimiento automático de ingredientes — completa los datos manualmente abajo.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">
            Nombre <span className="text-[var(--gym)]">*</span>
          </label>
          <GlassInput placeholder="Ej. Bowl de pollo y quinua" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stepper label="Porciones" value={porciones} onChange={setPorciones} min={1} />
          <Stepper label="Tiempo prep. (min)" value={tiempoPrepMin} onChange={setTiempoPrepMin} min={0} step={5} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Tipo de comida</label>
          <div className="flex gap-1.5 flex-wrap">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => toggleTipo(m)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                style={
                  tipos.includes(m)
                    ? { background: "var(--gym)", color: "white" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Ingredientes</h2>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 text-xs text-[var(--gym)] cursor-pointer"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        {ingredientes.length === 0 ? (
          <p className="text-xs text-white/35">Agrega ingredientes para calcular la información nutricional.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ingredientes.map((ing, idx) => (
              <div key={`${ing.foodId}-${idx}`} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] glass-specular-ring px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{ing.nombre}</p>
                  <p className="text-[11px] text-white/45">
                    {ing.cantidad} {ing.porcionNombre} · {Math.round(ing.calorias)} kcal
                  </p>
                </div>
                <button onClick={() => removeIngredient(idx)} className="text-white/30 hover:text-red-400 cursor-pointer shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Instrucciones</h2>
          <button
            onClick={() => setInstrucciones((prev) => [...prev, ""])}
            className="flex items-center gap-1 text-xs text-[var(--gym)] cursor-pointer"
          >
            <Plus size={14} /> Paso
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {instrucciones.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs text-white/40 mt-2.5 w-4 shrink-0">{idx + 1}.</span>
              <GlassInput
                value={step}
                onChange={(e) => updateStep(idx, e.target.value)}
                placeholder={`Paso ${idx + 1}`}
                className="flex-1"
              />
              {instrucciones.length > 1 && (
                <button
                  onClick={() => setInstrucciones((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-white/30 hover:text-red-400 cursor-pointer mt-2.5 shrink-0"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white">Información Nutricional (total)</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-base font-bold text-white">{Math.round(totales.calorias)}</p>
            <p className="text-[10px] text-white/45">kcal</p>
          </div>
          <div>
            <p className="text-base font-bold text-white">{Math.round(totales.proteina)}g</p>
            <p className="text-[10px] text-white/45">Proteína</p>
          </div>
          <div>
            <p className="text-base font-bold text-white">{Math.round(totales.carbos)}g</p>
            <p className="text-[10px] text-white/45">Carbos</p>
          </div>
          <div>
            <p className="text-base font-bold text-white">{Math.round(totales.grasas)}g</p>
            <p className="text-[10px] text-white/45">Grasas</p>
          </div>
        </div>
        <p className="text-[11px] text-white/35 text-center">
          {Math.round(totales.calorias / Math.max(1, porciones))} kcal por porción
        </p>
      </GlassCard>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto">
          <GlassButton className="w-full" size="lg" disabled={!canSave} onClick={handleSave}>
            {existing ? "Guardar Receta" : "Crear Receta"}
          </GlassButton>
        </div>
      </div>

      <RecipeIngredientPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(ingredient) => setIngredientes((prev) => [...prev, ingredient])}
      />
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] glass-specular-ring px-2 py-1.5">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] cursor-pointer"
        >
          <Minus size={13} className="text-white" />
        </button>
        <span className="flex-1 text-center text-sm font-medium text-white">{value}</span>
        <button
          onClick={() => onChange(value + step)}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] cursor-pointer"
        >
          <Plus size={13} className="text-white" />
        </button>
      </div>
    </div>
  );
}
