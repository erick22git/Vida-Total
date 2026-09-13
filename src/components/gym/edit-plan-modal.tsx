"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";
import type { TrainingPlan } from "@/lib/types";

export function EditPlanModal({
  open,
  onClose,
  plan,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  plan: TrainingPlan | null;
  /** Categorías ya existentes (biblioteca + otros planes propios) para elegir rápido. */
  categorias: string[];
}) {
  const updatePlan = useGymStore((s) => s.updatePlan);

  const [nombre, setNombre] = useState(plan?.nombre ?? "");
  const [categoria, setCategoria] = useState(plan?.categoria ?? "");
  const [notas, setNotas] = useState(plan?.notas ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);

  if (!plan) return null;

  function handleSave() {
    if (!plan) return;
    updatePlan(plan.id, {
      nombre: nombre.trim() || plan.nombre,
      categoria: categoria.trim() || plan.categoria,
      notas: notas.trim(),
    });
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Editar plan">
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Nombre</span>
          <GlassInput value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del plan" autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoria(cat);
                  setNuevaCategoria(false);
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
                  categoria === cat && !nuevaCategoria
                    ? "bg-[var(--gym)] border-[var(--gym)] text-white"
                    : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
                )}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setNuevaCategoria(true)}
              className={cn(
                "flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors border",
                nuevaCategoria
                  ? "bg-[var(--gym)] border-[var(--gym)] text-white"
                  : "bg-white/[0.05] border-white/10 text-white/65 hover:bg-white/[0.1]",
              )}
            >
              <Plus size={12} /> Nueva
            </button>
          </div>
          {nuevaCategoria && (
            <GlassInput
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              className="mt-1"
              autoFocus
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Alguna observación sobre este plan..."
            rows={3}
            className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:shadow-[var(--glass-specular-strong)] focus:bg-white/[0.09] resize-none"
          />
        </div>

        <GlassButton className="w-full" size="lg" accentColor="var(--gym-2)" onClick={handleSave}>
          Guardar cambios
        </GlassButton>
      </div>
    </GlassModal>
  );
}
