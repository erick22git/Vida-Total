"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { CATEGORY_LABELS, CATEGORY_ORDER, COLOR_SWATCHES, SEASON_LABELS } from "@/lib/outfit-utils";
import { useOutfitStore } from "@/lib/store/outfitStore";
import type { ClothingCategory, ClothingItem, ClothingSeason } from "@/lib/types/outfit";

const SEASONS: ClothingSeason[] = ["todo", "verano", "invierno"];

export function ClothingFormModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: ClothingItem | null;
}) {
  const addClothingItem = useOutfitStore((s) => s.addClothingItem);
  const updateClothingItem = useOutfitStore((s) => s.updateClothingItem);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<ClothingCategory>(item?.category ?? "camisas");
  const [color, setColor] = useState(item?.color ?? COLOR_SWATCHES[0]);
  const [season, setSeason] = useState<ClothingSeason>(item?.season ?? "todo");
  const [cost, setCost] = useState(item?.cost != null ? String(item.cost) : "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!name.trim()) return;
    const parsedCost = cost.trim() ? Number(cost) : undefined;
    const payload = {
      name: name.trim(),
      category,
      color,
      season,
      imageUrl,
      cost: parsedCost != null && !Number.isNaN(parsedCost) ? parsedCost : undefined,
    };
    if (item) {
      updateClothingItem(item.id, payload);
    } else {
      addClothingItem(payload);
    }
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title={item ? "Editar prenda" : "Nueva prenda"}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer glass-specular-ring"
            style={{ background: "var(--outfit)14" }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />
            ) : (
              <Camera size={26} style={{ color: "var(--outfit)" }} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <GlassInput
          placeholder="Nombre de la prenda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Categoría</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer border transition-colors"
                style={{
                  color: category === c ? "white" : "var(--outfit)",
                  background: category === c ? "var(--outfit)" : "var(--outfit)1A",
                  borderColor: "var(--outfit)55",
                }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((sw) => (
              <button
                key={sw}
                onClick={() => setColor(sw)}
                className="w-7 h-7 rounded-full cursor-pointer transition-transform"
                style={{
                  background: sw,
                  border: color === sw ? "2px solid white" : "1px solid rgba(255,255,255,0.25)",
                  transform: color === sw ? "scale(1.15)" : undefined,
                }}
                aria-label={sw}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Temporada</label>
          <div className="flex items-center gap-2">
            {SEASONS.map((s) => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className="flex-1 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer border transition-colors"
                style={{
                  color: season === s ? "white" : "var(--outfit)",
                  background: season === s ? "var(--outfit)" : "var(--outfit)1A",
                  borderColor: "var(--outfit)55",
                }}
              >
                {SEASON_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <GlassInput
          type="number"
          placeholder="Costo (opcional)"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />

        <GlassButton accentColor="var(--outfit)" onClick={handleSave} className="w-full">
          {item ? "Guardar cambios" : "Agregar prenda"}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
