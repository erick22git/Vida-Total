"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { GlassInput } from "@/components/glass/glass-input";
import { useGymStore } from "@/lib/store/gymStore";
import { cn } from "@/lib/utils";

const GOALS = [
  { key: "musculo", label: "Ganar músculo", emoji: "💪" },
  { key: "fuerza", label: "Ganar fuerza", emoji: "🏋️" },
  { key: "grasa", label: "Perder grasa", emoji: "🔥" },
  { key: "funcionalidad", label: "Mejorar funcionalidad", emoji: "🏃" },
];

/**
 * Primer paso para quien entra a Entrenamiento sin ninguna rutina/plan
 * todavía — un formulario corto (peso, altura, lesiones, objetivo) antes de
 * mandarlo a crear su primera planificación. Ver el gate en
 * `entrenamiento/page.tsx` (solo aparece para alguien totalmente nuevo).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const saveGymProfile = useGymStore((s) => s.saveGymProfile);

  const [pesoKg, setPesoKg] = useState("");
  const [alturaCm, setAlturaCm] = useState("");
  const [lesiones, setLesiones] = useState("");
  const [objetivo, setObjetivo] = useState<string | null>(null);

  function handleContinue() {
    saveGymProfile({
      pesoKg: pesoKg ? parseFloat(pesoKg) : undefined,
      alturaCm: alturaCm ? parseFloat(alturaCm) : undefined,
      lesiones: lesiones.trim() || undefined,
      objetivo: objetivo ?? undefined,
    });
    router.push("/gym/entrenamiento/planificaciones");
  }

  return (
    <div className="flex flex-col gap-6 pb-8 pt-2">
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl"
          style={{ background: "var(--gym)22", color: "var(--gym)" }}
        >
          <Dumbbell size={26} />
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Antes de empezar</h1>
        <p className="text-sm text-white/50 max-w-sm">
          Contanos un poco de vos para armar tu plan de entrenamiento. Todo esto es opcional — podés dejarlo en
          blanco y completarlo después.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Peso (kg)</span>
          <GlassInput type="number" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} placeholder="70" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Altura (cm)</span>
          <GlassInput type="number" value={alturaCm} onChange={(e) => setAlturaCm(e.target.value)} placeholder="170" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">¿Alguna lesión o molestia?</span>
        <textarea
          value={lesiones}
          onChange={(e) => setLesiones(e.target.value)}
          placeholder="Ej: dolor de rodilla, lumbar delicada..."
          rows={2}
          className="w-full rounded-2xl bg-white/[0.06] glass-specular-ring backdrop-blur-md px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:shadow-[var(--glass-specular-strong)] focus:bg-white/[0.09] resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">¿Cuál es tu objetivo?</span>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => setObjetivo(g.key === objetivo ? null : g.key)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm font-medium cursor-pointer transition-colors border",
                objetivo === g.key
                  ? "bg-white/[0.85] border-white text-black"
                  : "bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/[0.1]",
              )}
            >
              <span>{g.emoji}</span> {g.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full rounded-2xl py-3.5 text-base font-medium text-white cursor-pointer transition-[box-shadow,background-color] duration-300"
        style={{
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 0 22px 1px rgba(255,255,255,0.35), 0 10px 24px rgba(0,0,0,0.35)",
        }}
      >
        Continuar y crear mi primera rutina
      </button>
    </div>
  );
}
