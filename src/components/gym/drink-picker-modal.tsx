"use client";

import { Settings } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { useGymStore } from "@/lib/store/gymStore";
import { applyDrinkOverride, DRINK_CATEGORIES, POPULAR_DRINKS, type DrinkOption } from "@/lib/data/drinks";

function DrinkTile({ drink, onClick }: { drink: DrinkOption; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] py-4 px-2 transition-colors cursor-pointer"
    >
      <span className="text-2xl leading-none">{drink.emoji}</span>
      <span className="text-xs font-medium text-white text-center leading-tight">{drink.nombre}</span>
    </button>
  );
}

export function DrinkPickerModal({
  open,
  onClose,
  onPick,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (drink: DrinkOption) => void;
  onOpenSettings: () => void;
}) {
  const drinkOverrides = useGymStore((s) => s.drinkOverrides);
  const hiddenDrinkIds = useGymStore((s) => s.hiddenDrinkIds);

  const visiblePopulares = POPULAR_DRINKS.filter((d) => !hiddenDrinkIds.includes(d.id));

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Añadir una bebida"
      headerStart={
        <button
          onClick={onOpenSettings}
          aria-label="Configurar bebidas"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer shrink-0"
        >
          <Settings size={16} className="text-white/70" />
        </button>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        {visiblePopulares.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Populares</p>
            <div className="grid grid-cols-3 gap-2.5">
              {visiblePopulares.map((base) => {
                const drink = applyDrinkOverride(base, drinkOverrides[base.id]);
                return <DrinkTile key={base.id} drink={drink} onClick={() => onPick(drink)} />;
              })}
            </div>
          </div>
        )}

        {DRINK_CATEGORIES.map((cat) => {
          const visibles = cat.bebidas.filter((d) => !hiddenDrinkIds.includes(d.id));
          if (visibles.length === 0) return null;
          return (
            <div key={cat.nombre} className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">{cat.nombre}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {visibles.map((base) => {
                  const drink = applyDrinkOverride(base, drinkOverrides[base.id]);
                  return <DrinkTile key={base.id} drink={drink} onClick={() => onPick(drink)} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </GlassModal>
  );
}
