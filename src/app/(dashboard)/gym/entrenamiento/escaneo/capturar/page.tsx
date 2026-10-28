"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, RotateCw, FlipHorizontal2, Crop, RotateCcw as ResetIcon } from "lucide-react";
import { GlassButton } from "@/components/glass/glass-button";
import { resizeImage } from "@/lib/gym/water-vessels";

export default function CaptureBodyScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFile(file);
    setPhoto(url);
  }

  function reset() {
    setRotation(0);
    setFlipped(false);
  }

  if (!photo) {
    return (
      <div className="flex flex-col gap-8 pb-8 items-center text-center pt-10">
        <header className="w-full flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/50 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold">Añadir Foto</h1>
        </header>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/15 py-16 px-8 w-full">
          <Camera size={40} className="text-white/30" />
          <p className="text-sm text-white/50 max-w-xs">
            Sube o toma una foto de cuerpo completo, de frente, con buena luz.
          </p>
          <GlassButton accentColor="rgba(255,255,255,0.9)" className="!text-black" onClick={() => fileRef.current?.click()}>
            Elegir foto
          </GlassButton>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFile} className="hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => setPhoto(null)} className="text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold">Ajustar Foto</h1>
      </header>

      <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-black/40 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt="Captura"
          className="max-w-full max-h-full object-contain transition-transform"
          style={{ transform: `rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})` }}
        />
        {/* decorative corner crop handles */}
        {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
          <div key={pos} className={`absolute ${pos} w-5 h-5 border-2 border-white/80 rounded-sm`} />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ToolButton icon={RotateCw} label="Girar" onClick={() => setRotation((r) => (r + 90) % 360)} />
        <ToolButton icon={FlipHorizontal2} label="Voltear" onClick={() => setFlipped((f) => !f)} />
        <ToolButton icon={Crop} label="Proporción" onClick={() => {}} />
        <ToolButton icon={ResetIcon} label="Restablecer" onClick={reset} />
      </div>

      <GlassButton
        accentColor="rgba(255,255,255,0.9)"
        size="lg"
        className="!text-black"
        onClick={async () => {
          // La foto se reduce y se pasa a la pantalla de guardado (un blob: no sobrevive a la navegación).
          try {
            if (file) sessionStorage.setItem("vt-scan-photo", await resizeImage(file, 1080, 0.82));
          } catch {
            /* sin sessionStorage o foto ilegible: la pantalla siguiente avisa que no hay foto */
          }
          router.push("/gym/entrenamiento/escaneo/resultado");
        }}
      >
        Continuar
      </GlassButton>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-medium text-white/65 bg-white/[0.05] glass-specular-ring cursor-pointer hover:text-white transition-colors"
    >
      <Icon size={17} />
      {label}
    </button>
  );
}
