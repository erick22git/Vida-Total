"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Shirt } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { ClothingCard } from "@/components/outfit/clothing-card";
import { ClothingFormModal } from "@/components/outfit/clothing-form-modal";
import { ClothingDetailModal } from "@/components/outfit/clothing-detail-modal";
import { useOutfitStore } from "@/lib/store/outfitStore";
import type { ClothingCategory, ClothingItem } from "@/lib/types/outfit";

const FILTERS: { key: ClothingCategory | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "camisas", label: "Camisas" },
  { key: "pantalones", label: "Pantalones" },
  { key: "zapatos", label: "Zapatos" },
  { key: "abrigos", label: "Abrigos" },
  { key: "accesorios", label: "Accesorios" },
];

export default function ArmarioPage() {
  const clothingItems = useOutfitStore((s) => s.clothingItems);
  const deleteClothingItem = useOutfitStore((s) => s.deleteClothingItem);

  const [filter, setFilter] = useState<ClothingCategory | "todas">("todas");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<ClothingItem | null>(null);
  const [editing, setEditing] = useState<ClothingItem | null>(null);

  const filtered = useMemo(
    () =>
      filter === "todas"
        ? clothingItems
        : clothingItems.filter((c) => c.category === filter),
    [clothingItems, filter],
  );

  return (
    <div className="flex flex-col gap-6 pb-20">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/outfit"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Shirt style={{ color: "var(--outfit)" }} /> Mi Armario
        </h1>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors cursor-pointer"
              style={{
                background: active ? "var(--outfit)" : "rgba(255,255,255,0.06)",
                borderColor: active ? "var(--outfit)" : "rgba(255,255,255,0.12)",
                color: active ? "white" : "rgba(255,255,255,0.65)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
          <Shirt size={32} className="text-white/25" />
          <p className="text-white/60 text-sm">
            {filter === "todas"
              ? "Tu armario está vacío. Agrega tu primera prenda."
              : "No tienes prendas en esta categoría."}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <ClothingCard key={item.id} item={item} onClick={() => setSelected(item)} />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 md:bottom-8 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, var(--outfit), #7e22ce)",
          boxShadow: "0 6px 24px rgba(168,85,247,0.5)",
        }}
        aria-label="Agregar prenda"
      >
        <Plus size={26} />
      </button>

      {showAdd && <ClothingFormModal open={showAdd} onClose={() => setShowAdd(false)} />}

      <ClothingDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        item={selected}
        onEdit={() => {
          if (selected) {
            setEditing(selected);
            setSelected(null);
          }
        }}
        onDelete={() => {
          if (selected) {
            deleteClothingItem(selected.id);
            setSelected(null);
          }
        }}
      />

      {editing && (
        <ClothingFormModal
          key={editing.id}
          open={!!editing}
          onClose={() => setEditing(null)}
          item={editing}
        />
      )}
    </div>
  );
}
