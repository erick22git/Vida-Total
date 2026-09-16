"use client";

import { useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import {
  Plus,
  MoreHorizontal,
  Copy,
  ClipboardPaste,
  RotateCcw,
  Trash2,
  Scale,
  BookOpen,
  Share2,
  ChevronRight,
  Image as ImageIcon,
  FileStack,
  GripVertical,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { FoodPhoto } from "@/components/gym/food-photo";
import { FoodEntrySheet } from "@/components/gym/food-entry-sheet";
import type { Food, LoggedFood, MealType } from "@/lib/types";
import { MEAL_LABELS } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";
import { activeLoggedFoods, mergeFoods } from "@/lib/food-utils";
import { categoryEmoji } from "@/lib/food-category-emoji";
import { cn } from "@/lib/utils";

export function MealCard({
  meal,
  foods,
  onAdd,
  date,
  disableAdd,
}: {
  meal: MealType;
  foods: LoggedFood[];
  onAdd: () => void;
  /** Día que se está mostrando (default: hoy) — se pasa a copiar/pegar/repetir/
   * vaciar/escalar/plantilla para que operen sobre ese día, no siempre "hoy". */
  date?: Date;
  /** Cuando el día mostrado no es hoy, agregar comida nueva a mano no está
   * soportado todavía (el flujo de búsqueda de alimentos siempre registra
   * con la fecha/hora actual) — se deshabilita el botón "+" y se avisa. */
  disableAdd?: boolean;
}) {
  const updateLoggedFood = useGymStore((s) => s.updateLoggedFood);
  const reorderMealFoods = useGymStore((s) => s.reorderMealFoods);
  const copyMeal = useGymStore((s) => s.copyMeal);
  const pasteMeal = useGymStore((s) => s.pasteMeal);
  const repeatMeal = useGymStore((s) => s.repeatMeal);
  const clearMeal = useGymStore((s) => s.clearMeal);
  const scaleMealPortions = useGymStore((s) => s.scaleMealPortions);
  const saveMealAsTemplate = useGymStore((s) => s.saveMealAsTemplate);
  const addRecipe = useGymStore((s) => s.addRecipe);
  const mealClipboard = useGymStore((s) => s.mealClipboard);
  const customFoods = useGymStore((s) => s.customFoods);

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [items, setItems] = useState(foods);
  const [editingEntry, setEditingEntry] = useState<LoggedFood | null>(null);

  // Keep local reorder-list in sync when the underlying store data changes
  // (new item added/removed/edited) without fighting the user's in-progress drag.
  const key = foods.map((f) => `${f.id}:${f.calorias}:${f.gramos}:${f.cookedState}:${f.cantidad}:${f.activo}`).join(",");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setItems(foods);
  }

  const allFoods = useMemo<Food[]>(() => mergeFoods(customFoods), [customFoods]);

  const total = activeLoggedFoods(foods).reduce(
    (acc, f) => ({
      calorias: acc.calorias + f.calorias,
      proteina: acc.proteina + f.proteina,
      carbos: acc.carbos + f.carbos,
      grasas: acc.grasas + f.grasas,
    }),
    { calorias: 0, proteina: 0, carbos: 0, grasas: 0 },
  );

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function foodFor(entry: LoggedFood): Food {
    const match = allFoods.find((f) => f.id === entry.foodId);
    if (match) return match;
    return {
      id: entry.foodId,
      nombre: entry.nombre,
      categoria: "Otros",
      porcion: entry.porcionNombre ?? "1 porción",
      calorias: entry.calorias,
      proteina: entry.proteina,
      carbos: entry.carbos,
      grasas: entry.grasas,
      photoUrl: entry.photoUrl,
    };
  }

  return (
    <GlassCard
      padding="md"
      className={cn("flex flex-col gap-3 relative", menuOpen || shareMenuOpen ? "z-50" : "z-0")}
      style={{ background: "var(--glass-bg-dark)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{MEAL_LABELS[meal]}</p>
          <p className="text-[11px] text-white/45 truncate">
            {Math.round(total.calorias)} kcal · {Math.round(total.proteina)}g P · {Math.round(total.carbos)}g C ·{" "}
            {Math.round(total.grasas)}g G
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
              aria-label="Más opciones"
            >
              <MoreHorizontal size={16} className="text-white" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-40 w-56 rounded-2xl glass-panel shadow-2xl overflow-hidden py-1">
                  <MenuItem
                    icon={<Copy size={14} />}
                    label="Copiar"
                    onClick={() => {
                      copyMeal(meal, date);
                      setMenuOpen(false);
                      flashToast("Comida copiada");
                    }}
                  />
                  <MenuItem
                    icon={<ClipboardPaste size={14} />}
                    label="Pegar"
                    disabled={!mealClipboard || mealClipboard.length === 0}
                    onClick={() => {
                      pasteMeal(meal, date);
                      setMenuOpen(false);
                      flashToast("Comida pegada");
                    }}
                  />
                  <MenuItem
                    icon={<RotateCcw size={14} />}
                    label="Repetir comida"
                    onClick={() => {
                      const ok = repeatMeal(meal, date);
                      setMenuOpen(false);
                      flashToast(ok ? "Comida repetida" : "Sin comida anterior");
                    }}
                  />
                  <MenuItem
                    icon={<Trash2 size={14} />}
                    label="Vaciar comida"
                    danger
                    disabled={foods.length === 0}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmClear(true);
                    }}
                  />
                  <MenuItem
                    icon={<Scale size={14} />}
                    label="Ajustar porciones"
                    disabled={foods.length === 0}
                    onClick={() => {
                      setMenuOpen(false);
                      setScaleOpen(true);
                    }}
                  />
                  <MenuItem
                    icon={<BookOpen size={14} />}
                    label="Guardar como receta"
                    disabled={foods.length === 0}
                    onClick={() => {
                      const created = addRecipe({
                        nombre: `${MEAL_LABELS[meal]} guardada`,
                        porciones: 1,
                        tiempoPrepMin: 10,
                        tipos: [meal],
                        ingredientes: foods.map((f) => ({
                          foodId: f.foodId,
                          nombre: f.nombre,
                          cantidad: f.cantidad ?? 1,
                          porcionNombre: f.porcionNombre ?? "porción",
                          gramos: f.gramos ?? 100,
                          calorias: f.calorias,
                          proteina: f.proteina,
                          carbos: f.carbos,
                          grasas: f.grasas,
                        })),
                        instrucciones: [],
                        totales: total,
                        fuente: "manual",
                      });
                      setMenuOpen(false);
                      flashToast(created ? "Receta guardada" : "No se pudo guardar");
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
                            setMenuOpen(false);
                            setShareMenuOpen(false);
                            flashToast("Generando imagen...");
                          }}
                        />
                        <MenuItem
                          icon={<FileStack size={14} />}
                          label="Como plantilla"
                          onClick={() => {
                            setShareMenuOpen(false);
                            setMenuOpen(false);
                            setTemplateOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
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

      {toast && <p className="text-[11px] text-white/80 text-center">{toast}</p>}

      {items.length > 0 && (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(next) => {
            setItems(next);
            reorderMealFoods(
              meal,
              next.map((i) => i.id),
              date,
            );
          }}
          className="flex flex-col gap-1.5"
        >
          {items.map((f) => (
            <Reorder.Item
              key={f.id}
              value={f}
              dragListener={movingId === f.id}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-2.5 py-2 border transition-colors",
                movingId === f.id ? "border-white/70 bg-white/[0.08]" : "border-transparent",
              )}
            >
              <button
                onClick={() => setMovingId((v) => (v === f.id ? null : f.id))}
                aria-label="Reordenar"
                className={cn(
                  "flex items-center justify-center w-6 h-6 shrink-0 rounded-lg cursor-grab active:cursor-grabbing",
                  movingId === f.id ? "text-white" : "text-white/25 hover:text-white/50",
                )}
              >
                <GripVertical size={14} />
              </button>
              <button
                onClick={() => setEditingEntry(f)}
                className={cn(
                  "flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer transition-opacity",
                  f.activo === false && "opacity-40",
                )}
              >
                <FoodPhoto
                  photoUrl={f.photoUrl}
                  alt={f.nombre}
                  size={34}
                  emoji={categoryEmoji(foodFor(f).categoria)}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium text-white truncate", f.activo === false && "line-through")}>
                    {f.nombre}
                  </p>
                  <p className="text-[10px] text-white/40 capitalize">{f.cookedState ?? "crudo"}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs text-white/70">{f.gramos ? `${Math.round(f.gramos)} g` : f.porcionNombre}</span>
                  <span className="text-[10px] text-white/40">{Math.round(f.calorias)} kcal</span>
                </div>
              </button>
              <button
                onClick={() => updateLoggedFood(f.id, { activo: f.activo === false })}
                aria-label={f.activo === false ? "Contar este alimento" : "No contar este alimento"}
                title={f.activo === false ? "Contar este alimento" : "No contar este alimento"}
                className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full cursor-pointer transition-colors"
                style={{ color: f.activo === false ? "rgba(255,255,255,0.25)" : "white" }}
              >
                {f.activo === false ? <Circle size={20} /> : <CheckCircle2 size={20} />}
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <button
        onClick={() => {
          if (disableAdd) {
            flashToast("Para un día pasado, usá Pegar o Repetir comida");
            return;
          }
          onAdd();
        }}
        aria-label={`Agregar a ${MEAL_LABELS[meal]}`}
        className={cn(
          "flex items-center justify-center w-full h-11 rounded-2xl glass-specular-ring transition-colors",
          disableAdd
            ? "bg-white/[0.02] cursor-not-allowed"
            : "bg-white/[0.04] hover:bg-white/[0.09] cursor-pointer",
        )}
      >
        <Plus size={18} className={disableAdd ? "text-white/25" : "text-white/60"} />
      </button>

      {editingEntry && (
        <FoodEntrySheet
          open={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          food={foodFor(editingEntry)}
          meal={meal}
          existingEntry={editingEntry}
        />
      )}
    </GlassCard>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  trailing?: React.ReactNode;
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
