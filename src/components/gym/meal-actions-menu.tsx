"use client";

/**
 * Menú de "..." de una comida — Copiar/Pegar/Repetir/Vaciar/Ajustar porciones/Guardar como receta —
 * extraído de `MealCard` (donde vivía duplicado inline) para reusarlo también en la pantalla de
 * detalle de alimento (`alimento/[id]`), que ahora abre el mismo menú con ítems extra propios
 * (Verificar, Compartir, el check de "contar este alimento") antes/después de estos.
 *
 * Toda la lógica (qué hace cada acción) sigue siendo la misma de siempre — esto solo mueve el JSX y
 * el estado del menú a un solo lugar para no mantener dos copias.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Copy, ClipboardPaste, RotateCcw, Trash2, Scale, BookOpen, Share2, ChevronRight, Image as ImageIcon, FileStack } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import { mergeFoods } from "@/lib/food-utils";
import { getResolverIndex } from "@/lib/nutrition/food-resolver";
import { buildRecipeFromLogged, findRecipeByName, updatePatchFromLogged } from "@/lib/nutrition/meal-to-recipe";
import type { LoggedFood, MealType, Recipe } from "@/lib/types";
import { MEAL_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify/use-notify";

export function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-xs cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.08]",
        danger ? "text-red-400" : "text-white",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

export function MealActionsMenu({
  meal,
  date,
  foods,
  open,
  onOpenChange,
  beforeItems,
  afterItems,
}: {
  meal: MealType;
  /** Día sobre el que operan copiar/pegar/repetir/vaciar/escalar/plantilla (default: hoy). */
  date?: Date;
  foods: LoggedFood[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ítems propios de quien use este menú, antes del divisor (p.ej. Verificar/Compartir en la
   * pantalla de alimento — ahí "Compartir" es del alimento puntual, no de la comida entera). */
  beforeItems?: ReactNode;
  /** Ítems propios después de "Guardar como receta" (p.ej. el check de "contar este alimento"). */
  afterItems?: ReactNode;
}) {
  const copyMeal = useGymStore((s) => s.copyMeal);
  const pasteMeal = useGymStore((s) => s.pasteMeal);
  const repeatMeal = useGymStore((s) => s.repeatMeal);
  const clearMeal = useGymStore((s) => s.clearMeal);
  const scaleMealPortions = useGymStore((s) => s.scaleMealPortions);
  const saveMealAsTemplate = useGymStore((s) => s.saveMealAsTemplate);
  const addRecipe = useGymStore((s) => s.addRecipe);
  const updateRecipe = useGymStore((s) => s.updateRecipe);
  const recipes = useGymStore((s) => s.recipes);
  const customFoods = useGymStore((s) => s.customFoods);
  const mealClipboard = useGymStore((s) => s.mealClipboard);

  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeConflict, setRecipeConflict] = useState<Recipe | null>(null);
  const resolverIdx = useMemo(() => getResolverIndex(mergeFoods(customFoods), recipes), [customFoods, recipes]);

  function flashToast(msg: string) {
    notify({ type: "reminder", priority: "low", title: msg });
  }

  return (
    <>
      <div className="relative">
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => onOpenChange(false)} />
            <div className="absolute right-0 top-2 z-40 w-56 rounded-2xl glass-panel shadow-2xl overflow-hidden py-1">
              {beforeItems}
              <MenuItem
                icon={<Copy size={14} />}
                label="Copiar todo"
                disabled={foods.length === 0}
                onClick={() => {
                  copyMeal(meal, date);
                  onOpenChange(false);
                  flashToast("Comida copiada");
                }}
              />
              <MenuItem
                icon={<ClipboardPaste size={14} />}
                label="Pegar"
                disabled={!mealClipboard || mealClipboard.length === 0}
                onClick={() => {
                  pasteMeal(meal, date);
                  onOpenChange(false);
                  flashToast("Comida pegada");
                }}
              />
              <MenuItem
                icon={<RotateCcw size={14} />}
                label="Repetir comida"
                onClick={() => {
                  const ok = repeatMeal(meal, date);
                  onOpenChange(false);
                  flashToast(ok ? "Comida repetida" : "Sin comida anterior");
                }}
              />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Vaciar comida"
                danger
                disabled={foods.length === 0}
                onClick={() => {
                  onOpenChange(false);
                  setConfirmClear(true);
                }}
              />
              <MenuItem
                icon={<Scale size={14} />}
                label="Ajustar porciones"
                disabled={foods.length === 0}
                onClick={() => {
                  onOpenChange(false);
                  setScaleOpen(true);
                }}
              />
              <MenuItem
                icon={<BookOpen size={14} />}
                label="Guardar como receta"
                disabled={foods.length === 0}
                onClick={() => {
                  onOpenChange(false);
                  setRecipeName(`${MEAL_LABELS[meal]} guardada`);
                  setRecipeConflict(null);
                  setRecipeOpen(true);
                }}
              />
              <div className="relative">
                <MenuItem
                  icon={<Share2 size={14} />}
                  label="Compartir comida"
                  disabled={foods.length === 0}
                  trailing={<ChevronRight size={13} className="text-white/30" />}
                  onClick={() => setShareMenuOpen((v) => !v)}
                />
                {shareMenuOpen && (
                  <div className="absolute right-full top-0 mr-1 w-44 rounded-2xl glass-panel shadow-2xl overflow-hidden py-1">
                    <MenuItem
                      icon={<ImageIcon size={14} />}
                      label="Como imagen"
                      onClick={() => {
                        onOpenChange(false);
                        setShareMenuOpen(false);
                        flashToast("Generando imagen...");
                      }}
                    />
                    <MenuItem
                      icon={<FileStack size={14} />}
                      label="Como plantilla"
                      onClick={() => {
                        setShareMenuOpen(false);
                        onOpenChange(false);
                        setTemplateOpen(true);
                      }}
                    />
                  </div>
                )}
              </div>
              {afterItems}
            </div>
          </>
        )}
      </div>

      {confirmClear && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="text-xs text-red-200">¿Vaciar {MEAL_LABELS[meal]}?</span>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => {
                clearMeal(meal, date);
                setConfirmClear(false);
              }}
              className="rounded-lg px-2.5 py-1 text-xs font-medium bg-red-500 text-white cursor-pointer"
            >
              Vaciar
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium bg-white/10 text-white cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {scaleOpen && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] glass-specular-ring p-3">
          <p className="text-xs text-white/60">Escalar todas las porciones de {MEAL_LABELS[meal]}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[0.5, 1.5, 2, 3].map((factor) => (
              <button
                key={factor}
                onClick={() => {
                  scaleMealPortions(meal, factor, date);
                  setScaleOpen(false);
                  flashToast(`Porciones x${factor}`);
                }}
                className="rounded-xl py-2 text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white cursor-pointer"
              >
                x{factor}
              </button>
            ))}
          </div>
          <button onClick={() => setScaleOpen(false)} className="text-xs text-white/40 hover:text-white/70 cursor-pointer self-end">
            Cancelar
          </button>
        </div>
      )}

      {recipeOpen && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] glass-specular-ring p-3">
          {recipeConflict ? (
            <>
              <p className="text-xs text-amber-200/90">
                Ya existe la receta “{recipeConflict.nombre}” ({recipeConflict.ingredientes.length} ingredientes). ¿Actualizarla con esta comida en vez de duplicarla?
              </p>
              <p className="text-[11px] text-white/45">Al actualizarla vuelve a “Sin verificar”, porque cambian sus valores.</p>
              <div className="flex gap-2">
                <GlassButton
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const fresh = buildRecipeFromLogged(recipeName, meal, foods, resolverIdx);
                    updateRecipe(recipeConflict.id, updatePatchFromLogged(recipeConflict, fresh));
                    setRecipeOpen(false);
                    setRecipeConflict(null);
                    flashToast("Receta actualizada (sin verificar)");
                  }}
                >
                  Actualizar
                </GlassButton>
                <GlassButton size="sm" variant="ghost" className="flex-1" onClick={() => setRecipeConflict(null)}>
                  Cambiar nombre
                </GlassButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-white/60">Nombre de la receta</p>
              <GlassInput value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Ej. Almuerzo fit" />
              <div className="flex gap-2">
                <GlassButton
                  size="sm"
                  className="flex-1"
                  disabled={!recipeName.trim()}
                  onClick={() => {
                    const existing = findRecipeByName(recipes, recipeName);
                    if (existing) {
                      setRecipeConflict(existing);
                      return;
                    }
                    const created = addRecipe(buildRecipeFromLogged(recipeName, meal, foods, resolverIdx));
                    setRecipeOpen(false);
                    flashToast(created ? "Receta guardada (sin verificar)" : "No se pudo guardar");
                  }}
                >
                  Guardar
                </GlassButton>
                <GlassButton size="sm" variant="ghost" className="flex-1" onClick={() => setRecipeOpen(false)}>
                  Cancelar
                </GlassButton>
              </div>
            </>
          )}
        </div>
      )}

      {templateOpen && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] glass-specular-ring p-3">
          <p className="text-xs text-white/60">Nombre de la plantilla</p>
          <GlassInput value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ej. Desayuno entrenamiento" />
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              className="flex-1"
              disabled={!templateName.trim()}
              onClick={() => {
                const created = saveMealAsTemplate(meal, templateName.trim(), date);
                setTemplateOpen(false);
                setTemplateName("");
                flashToast(created ? "Plantilla guardada" : "No se pudo guardar");
              }}
            >
              Guardar
            </GlassButton>
            <GlassButton size="sm" variant="ghost" className="flex-1" onClick={() => setTemplateOpen(false)}>
              Cancelar
            </GlassButton>
          </div>
        </div>
      )}
    </>
  );
}
