"use client";

import { useState } from "react";
import { GlassModal } from "@/components/glass/glass-modal";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { MUSCLE_GROUPS, EQUIPMENT_LIST } from "@/lib/data/gym-meta";
import type { Exercise, ExerciseInputType, MuscleGroup } from "@/lib/types";
import { useGymStore } from "@/lib/store/gymStore";

const INPUT_TYPES: { value: ExerciseInputType; label: string }[] = [
  { value: "peso_reps", label: "Peso y repeticiones" },
  { value: "solo_reps", label: "Solo repeticiones" },
  { value: "tiempo", label: "Tiempo" },
];

export function CreateExerciseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const addCustomExercise = useGymStore((s) => s.addCustomExercise);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<ExerciseInputType>("peso_reps");
  const [categoria, setCategoria] = useState<MuscleGroup>("Pecho");
  const [secundarios, setSecundarios] = useState<string[]>([]);
  const [equipo, setEquipo] = useState(EQUIPMENT_LIST[0]);

  function toggleSecundario(v: string) {
    setSecundarios((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }

  function handleSubmit() {
    if (!nombre.trim()) return;
    const created = addCustomExercise({
      nombre: nombre.trim(),
      categoria,
      musculoPrimario: categoria,
      musculosSecundarios: secundarios,
      equipo,
      nivel: "Intermedio",
      instrucciones: [],
    });
    onCreated(created);
    setNombre("");
    setSecundarios([]);
    onClose();
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Crear Ejercicio">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center w-full aspect-video rounded-2xl bg-white/[0.05] border border-dashed border-white/15 text-white/35 text-sm">
          Imagen opcional
        </div>

        <div>
          <p className="text-xs text-white/50 mb-1.5">Nombre</p>
          <GlassInput
            placeholder="Ej. Curl concentrado"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div>
          <p className="text-xs text-white/50 mb-1.5">Tipo</p>
          <div className="flex flex-col gap-1.5">
            {INPUT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm text-left cursor-pointer transition-colors"
                style={{
                  background: tipo === t.value ? "var(--gym)22" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${tipo === t.value ? "var(--gym)" : "rgba(255,255,255,0.1)"}`,
                  color: tipo === t.value ? "white" : "rgba(255,255,255,0.7)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-white/50 mb-1.5">Grupo muscular</p>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as MuscleGroup)}
            className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring px-4 py-2.5 text-sm text-white outline-none"
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#141420]">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-white/50 mb-1.5">Músculos secundarios</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.filter((m) => m.value !== categoria).map((m) => (
              <button
                key={m.value}
                onClick={() => toggleSecundario(m.value)}
                className="rounded-full px-3 py-1.5 text-xs font-medium border cursor-pointer transition-colors"
                style={{
                  background: secundarios.includes(m.value) ? "var(--gym-2)22" : "rgba(255,255,255,0.04)",
                  borderColor: secundarios.includes(m.value) ? "var(--gym-2)" : "rgba(255,255,255,0.12)",
                  color: secundarios.includes(m.value) ? "white" : "rgba(255,255,255,0.6)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-white/50 mb-1.5">Equipamiento</p>
          <select
            value={equipo}
            onChange={(e) => setEquipo(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring px-4 py-2.5 text-sm text-white outline-none"
          >
            {EQUIPMENT_LIST.map((eq) => (
              <option key={eq} value={eq} className="bg-[#141420]">
                {eq}
              </option>
            ))}
          </select>
        </div>

        <GlassButton accentColor="var(--gym-2)" size="lg" onClick={handleSubmit} disabled={!nombre.trim()}>
          Crear ejercicio
        </GlassButton>
      </div>
    </GlassModal>
  );
}
