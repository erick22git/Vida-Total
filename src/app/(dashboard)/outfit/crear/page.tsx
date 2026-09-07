"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dice5, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { MannequinSlot } from "@/components/outfit/mannequin-slot";
import { CATEGORY_ICONS, CATEGORY_LABELS, OCCASIONS, OCCASION_LABELS } from "@/lib/outfit-utils";
import { useOutfitStore } from "@/lib/store/outfitStore";
import type { ClothingCategory, OutfitOccasion } from "@/lib/types/outfit";

const SLOT_CATEGORIES: ClothingCategory[] = ["abrigos", "camisas", "pantalones", "zapatos"];
const CAROUSEL_CATEGORIES: ClothingCategory[] = [
  "abrigos",
  "camisas",
  "pantalones",
  "zapatos",
  "accesorios",
];

export default function CrearOutfitPage() {
  const clothingItems = useOutfitStore((s) => s.clothingItems);
  const addOutfit = useOutfitStore((s) => s.addOutfit);
  const router = useRouter();

  const [selection, setSelection] = useState<Partial<Record<ClothingCategory, string>>>({});
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState<OutfitOccasion>("casual");

  const byCategory = useMemo(() => {
    const map: Record<string, typeof clothingItems> = {};
    for (const cat of CAROUSEL_CATEGORIES) {
      map[cat] = clothingItems.filter((c) => c.category === cat);
    }
    return map;
  }, [clothingItems]);

  function toggleSelect(category: ClothingCategory, id: string) {
    setSelection((prev) => ({
      ...prev,
      [category]: prev[category] === id ? undefined : id,
    }));
  }

  function shuffle() {
    const next: Partial<Record<ClothingCategory, string>> = {};
    for (const cat of CAROUSEL_CATEGORIES) {
      const options = byCategory[cat];
      if (options && options.length > 0) {
        next[cat] = options[Math.floor(Math.random() * options.length)].id;
      }
    }
    setSelection(next);
  }

  function handleSave() {
    const itemIds = Object.values(selection).filter(Boolean) as string[];
    if (!name.trim() || itemIds.length === 0) return;
    addOutfit({ name: name.trim(), itemIds, occasion });
    router.push("/outfit");
  }

  const selectedItems = Object.values(selection).filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/outfit"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles style={{ color: "var(--outfit)" }} /> Crear Outfit
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Maniquí */}
        <GlassCard accentColor="var(--outfit)" glow className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-white/50 self-start">Vista previa</p>
          <div className="flex flex-col gap-3 w-full items-center">
            {SLOT_CATEGORIES.map((cat) => (
              <MannequinSlot
                key={cat}
                category={cat}
                item={
                  selection[cat] ? clothingItems.find((c) => c.id === selection[cat]) : undefined
                }
              />
            ))}
            <MannequinSlot
              category="accesorios"
              item={
                selection.accesorios
                  ? clothingItems.find((c) => c.id === selection.accesorios)
                  : undefined
              }
            />
          </div>
          <GlassButton accentColor="var(--outfit)" variant="outline" className="w-full" onClick={shuffle}>
            <Dice5 size={16} /> Shuffle
          </GlassButton>
        </GlassCard>

        {/* Selección por categoría */}
        <div className="flex flex-col gap-5">
          {CAROUSEL_CATEGORIES.map((cat) => (
            <div key={cat} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-white/80">{CATEGORY_LABELS[cat]}</p>
              {byCategory[cat]?.length ? (
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  {byCategory[cat].map((item) => {
                    const active = selection[cat] === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleSelect(cat, item.id)}
                        className="shrink-0"
                      >
                        <GlassCard
                          padding="sm"
                          accentColor="var(--outfit)"
                          glow={active}
                          className="w-24 flex flex-col gap-1.5 cursor-pointer"
                          style={{
                            borderColor: active ? "var(--outfit)" : undefined,
                          }}
                        >
                          <div
                            className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center"
                            style={{ background: "var(--outfit)14" }}
                          >
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (() => {
                                const Icon = CATEGORY_ICONS[cat];
                                return <Icon size={20} className="text-white/30" />;
                              })()
                            )}
                          </div>
                          <p className="text-[11px] text-white/70 truncate">{item.name}</p>
                        </GlassCard>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-white/35">Sin prendas en esta categoría todavía.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <GlassCard accentColor="var(--outfit)" className="flex flex-col gap-4">
        <GlassInput
          placeholder="Nombre del outfit"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-white/50">Ocasión</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => setOccasion(o)}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors cursor-pointer"
                style={{
                  background: occasion === o ? "var(--outfit)" : "rgba(255,255,255,0.06)",
                  borderColor: occasion === o ? "var(--outfit)" : "rgba(255,255,255,0.12)",
                  color: occasion === o ? "white" : "rgba(255,255,255,0.65)",
                }}
              >
                {OCCASION_LABELS[o]}
              </button>
            ))}
          </div>
        </div>
        <GlassButton
          accentColor="var(--outfit)"
          className="w-full"
          disabled={!name.trim() || selectedItems.length === 0}
          onClick={handleSave}
        >
          Guardar Outfit
        </GlassButton>
      </GlassCard>
    </div>
  );
}
