"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Scan } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { BeforeAfterSlider } from "@/components/gym/before-after-slider";

export default function BodyScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"futuro" | "escaneo">("escaneo");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Escaneo Corporal</h1>
      </header>

      <div className="flex gap-1.5 rounded-2xl bg-white/[0.04] p-1 border border-white/[0.08] w-fit mx-auto">
        <button
          onClick={() => setMode("futuro")}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
          style={{
            background: mode === "futuro" ? "linear-gradient(135deg, var(--gym), var(--gym-2))" : "transparent",
            color: mode === "futuro" ? "white" : "rgba(255,255,255,0.5)",
          }}
        >
          Tu futuro
        </button>
        <button
          onClick={() => setMode("escaneo")}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
          style={{
            background: mode === "escaneo" ? "linear-gradient(135deg, var(--gym), var(--gym-2))" : "transparent",
            color: mode === "escaneo" ? "white" : "rgba(255,255,255,0.5)",
          }}
        >
          Escaneo
        </button>
      </div>

      <BeforeAfterSlider
        beforeLabel={mode === "futuro" ? "Ahora" : "Antes"}
        afterLabel={mode === "futuro" ? "En 12 semanas" : "Después"}
      />

      <p className="text-center text-sm text-white/45 px-4">
        Escanea tu físico para analizar tu potencial, simetría y desarrollo muscular con ayuda de IA.
      </p>

      <GlassButton
        accentColor="var(--gym-2)"
        size="lg"
        className="w-full"
        onClick={() => router.push("/gym/entrenamiento/escaneo/capturar")}
      >
        <Scan size={18} /> ESCANEAR CUERPO
      </GlassButton>
    </div>
  );
}
