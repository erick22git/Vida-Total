"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";

const METRICS = ["Potencial", "V-Taper", "Definición", "Simetría", "Inserciones", "Masa Muscular"];

function colorFor(value: number) {
  if (value >= 70) return "#22c55e";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function BodyScanResultPage() {
  const router = useRouter();
  const [values] = useState(() => METRICS.map(() => Math.round(20 + Math.random() * 75)));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">¡Último paso!</h1>
        <p className="text-sm text-white/50">Analiza tu físico</p>
      </header>

      <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-white/[0.05] glass-specular-ring flex items-center justify-center">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 30%, var(--gym-2)33, transparent 70%)" }}
        />
        <p className="text-white/25 text-sm">Vista previa del escaneo</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m, i) => (
          <GlassCard key={m} padding="sm" interactive={false} className="flex flex-col gap-2 relative overflow-hidden">
            <p className="text-xs text-white/50">{m}</p>
            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${values[i]}%`, background: colorFor(values[i]) }} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white blur-[5px] select-none">{values[i]}%</span>
              <Lock size={11} className="text-white/40" />
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassButton accentColor="var(--gym-2)" size="lg" onClick={() => router.push("/gym/entrenamiento/perfil")}>
        Quiero saber mis resultados →
      </GlassButton>
      <button onClick={() => router.back()} className="text-center text-sm text-white/40 hover:text-white/65 cursor-pointer">
        Volver atrás
      </button>
    </div>
  );
}
