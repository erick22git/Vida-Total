"use client";

import { useState } from "react";
import { Pencil, EyeOff, Eye } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import { applyDrinkOverride, DRINK_COLOR_OPTIONS, DRINK_ICON_OPTIONS, type DrinkOption } from "@/lib/data/drinks";
import { cn } from "@/lib/utils";

function PropertyRow({
  label,
  emoji,
  value,
  unit,
  onSave,
}: {
  label: string;
  emoji: string;
  value: number | undefined;
  unit: string;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  return (
    <div className="border-b border-white/[0.08] last:border-b-0">
      <button
        onClick={() => {
          setDraft(String(value ?? 0));
          setEditing((v) => !v);
        }}
        className="w-full flex items-center justify-between gap-2 py-3 cursor-pointer"
      >
        <span className="text-sm text-white/85 flex items-center gap-2">
          <span>{emoji}</span> {label}
        </span>
        <span className="text-sm font-medium text-white">
          {value ?? 0}
          {unit}
        </span>
      </button>
      {editing && (
        <div className="flex items-center gap-2 pb-3">
          <GlassInput
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <GlassButton
            size="sm"
            className="!text-black"
            accentColor="rgba(255,255,255,0.85)"
            onClick={() => {
              const n = parseFloat(draft);
              onSave(Number.isFinite(n) ? Math.max(0, n) : 0);
              setEditing(false);
            }}
          >
            Guardar
          </GlassButton>
        </div>
      )}
    </div>
  );
}

export function DrinkEditModal({
  open,
  onClose,
  drink: base,
}: {
  open: boolean;
  onClose: () => void;
  /** Bebida BASE (sin combinar) — los overrides se leen en vivo del store
   * abajo, así los cambios se reflejan de inmediato sin tener que reabrir. */
  drink: DrinkOption | null;
}) {
  const setDrinkOverride = useGymStore((s) => s.setDrinkOverride);
  const toggleDrinkHidden = useGymStore((s) => s.toggleDrinkHidden);
  const hiddenDrinkIds = useGymStore((s) => s.hiddenDrinkIds);
  const override = useGymStore((s) => (base ? s.drinkOverrides[base.id] : undefined));
  const drink = base ? applyDrinkOverride(base, override) : null;

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(drink?.nombre ?? "");

  if (!drink) return null;
  const oculta = hiddenDrinkIds.includes(drink.id);

  return (
    <GlassModal open={open} onClose={onClose} title="Editar bebida">
      <div className="flex flex-col gap-6 pb-2">
        <div className="flex flex-col items-center gap-2 pt-1">
          <span className="text-5xl leading-none">{drink.emoji}</span>
          {renaming ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <GlassInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 text-center"
                autoFocus
              />
              <GlassButton
                size="sm"
                accentColor="#3b82f6"
                onClick={() => {
                  const nombre = nameDraft.trim();
                  if (nombre) setDrinkOverride(drink.id, { nombre });
                  setRenaming(false);
                }}
              >
                Guardar
              </GlassButton>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameDraft(drink.nombre);
                setRenaming(true);
              }}
              className="flex items-center gap-1.5 text-xl font-bold cursor-pointer"
              style={{ color: drink.color }}
            >
              {drink.nombre} <Pencil size={14} className="text-white/40" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Ícono</p>
          <div className="flex flex-wrap gap-2">
            {DRINK_ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setDrinkOverride(drink.id, { emoji })}
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-2xl text-xl transition-colors cursor-pointer border",
                  drink.emoji === emoji
                    ? "border-white/70 bg-white/[0.14]"
                    : "border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.1]",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Color</p>
          <div className="flex flex-wrap gap-2">
            {DRINK_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => setDrinkOverride(drink.id, { color })}
                aria-label={color}
                className={cn(
                  "w-9 h-9 rounded-full transition-transform cursor-pointer",
                  drink.color === color ? "scale-110 ring-2 ring-white" : "hover:scale-105",
                )}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Propiedades de la bebida</p>
          <div className="rounded-2xl bg-white/[0.04] glass-specular-ring px-4">
            <PropertyRow
              label="Equilibrio hídrico"
              emoji="💧"
              value={drink.hidratacion}
              unit="%"
              onSave={(v) => setDrinkOverride(drink.id, { hidratacion: Math.min(100, v) })}
            />
            <PropertyRow
              label="Cafeína"
              emoji="🫘"
              value={drink.cafeinaMg}
              unit="mg"
              onSave={(v) => setDrinkOverride(drink.id, { cafeinaMg: v })}
            />
            <PropertyRow
              label="Azúcar"
              emoji="🧴"
              value={drink.azucarG}
              unit="g/100ml"
              onSave={(v) => setDrinkOverride(drink.id, { azucarG: v })}
            />
          </div>
        </div>

        <GlassButton
          variant="ghost"
          className="w-full"
          onClick={() => toggleDrinkHidden(drink.id)}
        >
          {oculta ? <Eye size={16} /> : <EyeOff size={16} />}
          {oculta ? "Mostrar bebida" : "Ocultar bebida"}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
