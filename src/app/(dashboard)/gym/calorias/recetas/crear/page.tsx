"use client";

/**
 * Rediseño Calorías: Crear/Editar Receta, al estilo oscuro del resto del módulo (mismo fondo con
 * grano, cabecera con círculo de volver + título centrado, bloques sin tarjeta de vidrio). La lógica
 * de guardado/borrador es la misma de siempre — esto solo cambia el envoltorio visual. El selector de
 * "cómo crear" (manual/foto/enlace) y el picker de ingredientes quedan como hojas oscuras propias en
 * vez de `GlassModal`.
 */
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, X, Plus, Minus, Trash2, Camera, Link2, FileEdit, MoreVertical, ShieldCheck } from "lucide-react";
import { FOOD_SECTION_BG } from "@/components/gym/food-section-header";
import { RecipeIngredientPicker } from "@/components/gym/recipe-ingredient-picker";
import { VerifiedBadge } from "@/components/gym/verified-badge";
import { useGymStore } from "@/lib/store/gymStore";
import { MEAL_LABELS, type Food, type MealType, type RecipeIngredient } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";

type CreationMode = "manual" | "foto" | "enlace" | null;
const MEALS: MealType[] = ["desayuno", "almuerzo", "snack1", "snack2", "cena"];

/** Al tocar "Agregar" en Ingredientes, en vez de sumar el alimento directo
 * con una porción default, se navega a la pantalla de detalle de ese
 * alimento para configurar cantidad/porción (y calorías, si hace falta) —
 * ver RecipeIngredientPicker. Como eso es un cambio de ruta completo, el
 * formulario en progreso (que solo vive en useState local) se guarda acá
 * antes de salir y se restaura al volver, igual que ya se hacía con la
 * foto escaneada del código de barras (`vt-scanned-photo`). */
const RECIPE_DRAFT_KEY = "vt-recipe-draft";

type RecipeDraft = {
  recipeId: string | null;
  mode: CreationMode;
  nombre: string;
  foto: string | null;
  porciones: number;
  tiempoPrepMin: number;
  tipos: MealType[];
  ingredientes: RecipeIngredient[];
  instrucciones: string[];
  enlace: string;
};

function readAndClearRecipeDraft(): RecipeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RECIPE_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RECIPE_DRAFT_KEY);
    return JSON.parse(raw) as RecipeDraft;
  } catch {
    return null;
  }
}

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

  // Si venimos de vuelta de configurar un ingrediente (ver
  // goToConfigureIngredient abajo), `draft` trae el formulario completo tal
  // como estaba antes de salir — tiene prioridad sobre `existing` para que
  // no se pierdan ediciones en progreso.
  const [draft] = useState(() => readAndClearRecipeDraft());

  const [mode, setMode] = useState<CreationMode>(draft?.mode ?? (existing ? "manual" : initialMode));
  const [choosing, setChoosing] = useState(!draft && !existing && !initialMode);

  const [nombre, setNombre] = useState(draft?.nombre ?? existing?.nombre ?? "");
  const [foto, setFoto] = useState<string | null>(draft?.foto ?? existing?.foto ?? null);
  const [porciones, setPorciones] = useState(draft?.porciones ?? existing?.porciones ?? 2);
  const [tiempoPrepMin, setTiempoPrepMin] = useState(draft?.tiempoPrepMin ?? existing?.tiempoPrepMin ?? 20);
  const [tipos, setTipos] = useState<MealType[]>(draft?.tipos ?? existing?.tipos ?? []);
  const [ingredientes, setIngredientes] = useState<RecipeIngredient[]>(draft?.ingredientes ?? existing?.ingredientes ?? []);
  const [instrucciones, setInstrucciones] = useState<string[]>(draft?.instrucciones ?? existing?.instrucciones ?? [""]);
  const [enlace, setEnlace] = useState(draft?.enlace ?? existing?.enlace ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Note: form fields are seeded from `existing`/`draft` at initial mount via
  // useState above. If `recipeId` changes without a remount, the form
  // intentionally keeps the in-progress edits rather than silently
  // overwriting them.

  function goToConfigureIngredient(food: Food) {
    const toSave: RecipeDraft = {
      recipeId: existing?.id ?? null,
      mode,
      nombre,
      foto,
      porciones,
      tiempoPrepMin,
      tipos,
      ingredientes,
      instrucciones,
      enlace,
    };
    try {
      sessionStorage.setItem(RECIPE_DRAFT_KEY, JSON.stringify(toSave));
    } catch {
      // sessionStorage puede fallar en modo privado — si pasa, simplemente
      // no se restaura el formulario al volver, pero no rompe la navegación.
    }
    setPickerOpen(false);
    router.push(`/gym/calorias/alimento/${food.id}?returnTo=recipe`);
  }

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
      // Editar los valores nutricionales (ingredientes/porciones) de una receta verificada la devuelve a "sin verificar".
      const changedValues = JSON.stringify(ingredientes) !== JSON.stringify(existing.ingredientes) || porciones !== existing.porciones;
      if (existing.verificado && changedValues) {
        updateRecipe(existing.id, { ...payload, verificado: false });
        setNotice("Cambiaste los ingredientes: la receta vuelve a “Sin verificar”.");
        setTimeout(() => router.push("/gym/calorias/recetas"), 1600);
        return;
      }
      updateRecipe(existing.id, payload);
    } else {
      addRecipe({ ...payload, verificado: false });
    }
    router.push("/gym/calorias/recetas");
  }

  // TODO: restringir "Verificar" al rol admin cuando exista el sistema de roles (hoy cualquier usuario puede,
  // igual que en alimentos). Solo MANUAL: ningún script ni migración puede poner verificado = true.
  function handleVerify() {
    if (!existing) return;
    updateRecipe(existing.id, { verificado: true });
    setConfirmVerify(false);
    setNotice("Receta verificada.");
    setTimeout(() => setNotice(null), 1800);
  }

  if (choosing) {
    return (
      <div className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center" style={FOOD_SECTION_BG}>
        <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-2" style={{ background: "#141414" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[15px] uppercase tracking-[0.1em] text-white" style={MONO_FONT}>
              Elegí cómo crear tu receta
            </h2>
            <button
              onClick={() => router.push("/gym/calorias/recetas")}
              className="w-8 h-8 flex items-center justify-center cursor-pointer text-white/50"
            >
              <X size={18} />
            </button>
          </div>
          <ChoiceRow
            icon={<FileEdit size={18} style={{ color: "var(--gym)" }} />}
            title="Manual"
            subtitle="Completá el formulario paso a paso"
            onClick={() => {
              setMode("manual");
              setChoosing(false);
            }}
          />
          <ChoiceRow
            icon={<Camera size={18} style={{ color: "var(--gym)" }} />}
            title="Desde una foto"
            subtitle="Subí una foto y completá los datos después"
            onClick={() => {
              setMode("foto");
              setChoosing(false);
            }}
          />
          <ChoiceRow
            icon={<Link2 size={18} style={{ color: "var(--gym)" }} />}
            title="Desde un enlace"
            subtitle="Guardá el enlace y completá el resto manualmente"
            onClick={() => {
              setMode("enlace");
              setChoosing(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto text-white select-none" style={FOOD_SECTION_BG}>
      <div className="max-w-md mx-auto px-4 pb-28 flex flex-col gap-5">
        <header className="flex items-center justify-between gap-2 pt-[max(env(safe-area-inset-top),14px)]">
          <button
            onClick={() => router.push("/gym/calorias/recetas")}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            style={{ background: "#0d0d0d" }}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
            {existing ? "Editar receta" : "Crear receta"}
          </h1>
          {existing ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Más opciones"
                className="w-10 h-10 flex items-center justify-center cursor-pointer"
              >
                <MoreVertical size={20} className="text-white/70" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-10 z-40 w-48 rounded-2xl shadow-2xl overflow-hidden py-1" style={{ background: "#151515" }}>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmVerify(true);
                      }}
                      disabled={existing.verificado === true}
                      className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-xs text-white cursor-pointer hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShieldCheck size={14} /> {existing.verificado ? "Ya está verificada" : "Verificar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <span className="w-10 h-10" />
          )}
        </header>

        {existing && (
          <div className="-mt-2 flex justify-center">
            <VerifiedBadge item={existing} label showUnverified />
          </div>
        )}

        {confirmVerify && (
          <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
            <p className="text-xs text-white/70 text-center">
              ¿Confirmás que los ingredientes y valores de esta receta son correctos? Va a aparecer con el check de &quot;Verificado&quot;.
            </p>
            <div className="flex gap-2">
              <button onClick={handleVerify} className="flex-1 rounded-full py-3 text-sm font-semibold cursor-pointer bg-white text-black">
                Sí, marcar como verificada
              </button>
              <button onClick={() => setConfirmVerify(false)} className="flex-1 rounded-full py-3 text-sm font-semibold cursor-pointer bg-white/10 text-white">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {notice && <p className="text-xs text-center text-amber-200/90">{notice}</p>}

        {mode === "enlace" && (
          <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
            <label className="text-[11px] uppercase tracking-wide text-white/40">Enlace de la receta</label>
            <PlainInput placeholder="https://..." value={enlace} onChange={setEnlace} />
            <p className="text-[11px] text-white/35">Guardamos el enlace de referencia; completá los datos abajo manualmente.</p>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-36 rounded-2xl bg-white/[0.04] border border-dashed border-white/[0.15] flex items-center justify-center overflow-hidden cursor-pointer"
          >
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Foto de la receta" className="w-full h-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-white/40 text-xs">
                <Camera size={22} /> {mode === "foto" ? "Subí la foto de tu plato" : "Agregar foto (opcional)"}
              </span>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {mode === "foto" && (
            <p className="text-[11px] text-white/35 -mt-2">No hay reconocimiento automático de ingredientes — completá los datos manualmente abajo.</p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-white/40">
              Nombre <span style={{ color: "var(--gym)" }}>*</span>
            </label>
            <PlainInput placeholder="Ej. Bowl de pollo y quinua" value={nombre} onChange={setNombre} big />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Porciones" value={porciones} onChange={setPorciones} min={1} />
            <Stepper label="Tiempo prep. (min)" value={tiempoPrepMin} onChange={setTiempoPrepMin} min={0} step={5} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-white/40">Tipo de comida</label>
            <div className="flex gap-1.5 flex-wrap">
              {MEALS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleTipo(m)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                  style={
                    tipos.includes(m)
                      ? { background: "#fff", color: "#000" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-wide text-white/40">Ingredientes</h2>
            <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--gym)" }}>
              <Plus size={14} /> Agregar
            </button>
          </div>
          {ingredientes.length === 0 ? (
            <p className="text-xs text-white/35">Agregá ingredientes para calcular la información nutricional.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ingredientes.map((ing, idx) => (
                <div key={`${ing.foodId}-${idx}`} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
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
        </div>

        <div className="flex flex-col gap-3 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-wide text-white/40">Instrucciones</h2>
            <button
              onClick={() => setInstrucciones((prev) => [...prev, ""])}
              className="flex items-center gap-1 text-xs cursor-pointer"
              style={{ color: "var(--gym)" }}
            >
              <Plus size={14} /> Paso
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {instrucciones.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs text-white/40 mt-2 w-4 shrink-0">{idx + 1}.</span>
                <div className="flex-1">
                  <PlainInput value={step} onChange={(v) => updateStep(idx, v)} placeholder={`Paso ${idx + 1}`} />
                </div>
                {instrucciones.length > 1 && (
                  <button
                    onClick={() => setInstrucciones((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-white/30 hover:text-red-400 cursor-pointer mt-1.5 shrink-0"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: "#0d0d0d" }}>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40">Información nutricional (total)</h2>
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
          <p className="text-[11px] text-white/35 text-center">{Math.round(totales.calorias / Math.max(1, porciones))} kcal por porción</p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-xl bg-[color-mix(in_srgb,#1c1c1c_85%,transparent)] border-t border-white/[0.08]">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-full py-3.5 text-sm font-semibold cursor-pointer disabled:opacity-30 bg-white text-black"
          >
            {existing ? "Guardar receta" : "Crear receta"}
          </button>
        </div>
      </div>

      <RecipeIngredientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={goToConfigureIngredient} />
    </div>
  );
}

function ChoiceRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] transition-colors px-4 py-3.5 text-left cursor-pointer"
      onClick={onClick}
    >
      {icon}
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/45">{subtitle}</p>
      </div>
    </button>
  );
}

function PlainInput({
  value,
  onChange,
  placeholder,
  big,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  big?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent outline-none text-white placeholder:text-white/25 border-b border-white/15 focus:border-white/45 transition-colors py-1.5 ${
        big ? "text-base" : "text-sm"
      }`}
    />
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
      <label className="text-[11px] uppercase tracking-wide text-white/40">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-2 py-1.5">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] cursor-pointer"
        >
          <Minus size={13} className="text-white" />
        </button>
        <span className="flex-1 text-center text-sm font-medium text-white tabular-nums">{value}</span>
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
