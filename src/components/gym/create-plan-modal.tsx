"use client";

import { useRouter } from "next/navigation";
import { Wrench, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { GlassModal } from "@/components/glass/glass-modal";

export function CreatePlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const options = [
    {
      icon: Wrench,
      label: "Crear Manualmente",
      color: "var(--gym)",
      onClick: () => router.push("/gym/entrenamiento/planificaciones/manual"),
    },
    {
      icon: BookOpen,
      label: "Biblioteca de Planes",
      color: "var(--gym-2)",
      onClick: () => router.push("/gym/entrenamiento/planificaciones/biblioteca"),
    },
    {
      icon: Sparkles,
      label: "Crear con IA",
      color: "#3b82f6",
      highlight: true,
      onClick: () => router.push("/gym/entrenamiento/planificaciones/ia"),
    },
  ];

  return (
    <GlassModal open={open} onClose={onClose} title="Crear Plan de Entrenamiento">
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => {
              onClose();
              opt.onClick();
            }}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-4 text-left cursor-pointer transition-colors"
            style={{
              background: opt.highlight ? `${opt.color}1a` : "rgba(255,255,255,0.04)",
              border: `1px solid ${opt.highlight ? `${opt.color}55` : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{ background: `${opt.color}26`, color: opt.color }}
            >
              <opt.icon size={18} />
            </span>
            <span
              className="flex-1 text-sm font-semibold"
              style={{ color: opt.highlight ? opt.color : "white" }}
            >
              {opt.label}
            </span>
            <ChevronRight size={16} className="text-white/30" />
          </button>
        ))}
      </div>
    </GlassModal>
  );
}
