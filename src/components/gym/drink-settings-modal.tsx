"use client";

import { GlassModal } from "@/components/glass/glass-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { applyDrinkOverride, DRINK_CATEGORIES, POPULAR_DRINKS, type DrinkOption } from "@/lib/data/drinks";
import { cn } from "@/lib/utils";

function DrinkStatsTile({ drink, oculta, onClick }: { drink: DrinkOption; oculta: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] py-3.5 px-2 transition-colors cursor-pointer",
        oculta && "opacity-40",
      )}
    >
      <span className="text-2xl leading-none">{drink.emoji}</span>
      <span className="text-xs font-semibold text-white text-center leading-tight">{drink.nombre}</span>
      <span className="flex flex-col items-center gap-0.5 mt-0.5">
        <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: "#3b82f6" }}>
          💧 {drink.hidratacion}%
        </span>
        {drink.cafeinaMg !== undefined && (
          <span className="text-[11px] font-medium flex items-center gap-1 text-white/50">
            🫘 {drink.cafeinaMg}mg
          </span>
        )}
        {drink.azucarG !== undefined && (
          <span className="text-[11px] font-medium flex items-center gap-1 text-pink-300/80">
            🧴 {drink.azucarG}g
          </span>
        )}
      </span>
    </button>
  );
}

export function DrinkSettingsModal({
  open,
  onClose,
  onEditDrink,
}: {
  open: boolean;
  onClose: () => void;
  /** Recibe la bebida BASE (sin combinar) — DrinkEditModal lee los overrides
   * en vivo desde el store, así los cambios se reflejan sin tener que reabrir. */
  onEditDrink: (base: DrinkOption) => void;
}) {
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const hiddenDrinkIds = useGymStore((s) => s.hiddenDrinkIds);

  return (
    <GlassModal open={open} onClose={onClose} title="Bebidas">
      <div className="flex flex-col gap-6 pb-2">
        <p className="text-xs text-white/45 -mt-1">Toca una bebida para editarla.</p>

        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Populares</p>
          <div className="grid grid-cols-3 gap-2.5">
            {POPULAR_DRINKS.map((base) => {
              const drink = applyDrinkOverride(base, drinkOverrides[base.id]);
              return (
                <DrinkStatsTile
                  key={base.id}
                  drink={drink}
                  oculta={hiddenDrinkIds.includes(base.id)}
                  onClick={() => onEditDrink(base)}
                />
              );
            })}
          </div>
        </div>

        {DRINK_CATEGORIES.map((cat) => (
          <div key={cat.nombre} className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">{cat.nombre}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {cat.bebidas.map((base) => {
                const drink = applyDrinkOverride(base, drinkOverrides[base.id]);
                return (
                  <DrinkStatsTile
                    key={base.id}
                    drink={drink}
                    oculta={hiddenDrinkIds.includes(base.id)}
                    onClick={() => onEditDrink(base)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </GlassModal>
  );
}
