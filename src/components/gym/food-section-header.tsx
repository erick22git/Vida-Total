"use client";

/**
 * Encabezado compartido de las 5 formas de agregar comida (Recetas / Lista / Buscar / Escáner / Voz):
 * título centrado con puntos debajo, y deslizando horizontalmente sobre esa zona se pasa a la sección
 * de al lado. Reemplaza al menú de abajo (AddFoodMenu) y a la barra de pastillas (CaloriasMethodNav).
 * El botón de volver siempre lleva a Calorías. La comida elegida (`?meal=`) viaja de sección en sección.
 */
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";

export type FoodSection = "recetas" | "lista" | "buscar" | "escaner" | "voz";

/** Fondo oscuro con grano, pantalla completa — para las secciones que todavía no lo traían propio. */
export const FOOD_SECTION_BG = { background: "var(--app-bg)" } as const;

const SECTIONS: { key: FoodSection; label: string; path: string }[] = [
  { key: "recetas", label: "Recetas", path: "/gym/calorias/recetas" },
  { key: "lista", label: "Lista", path: "/gym/calorias/lista" },
  { key: "buscar", label: "Buscar", path: "/gym/calorias/buscar-nuevo" },
  { key: "escaner", label: "Escáner", path: "/gym/calorias/escaner" },
  { key: "voz", label: "Voz", path: "/gym/calorias/voz" },
];

export function FoodSectionHeader({ current }: { current: FoodSection }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const index = SECTIONS.findIndex((s) => s.key === current);

  function goTo(i: number) {
    if (i < 0 || i >= SECTIONS.length || i === index) return;
    const meal = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("meal") : null;
    router.replace(`${SECTIONS[i].path}${meal ? `?meal=${meal}` : ""}`);
  }

  return (
    <header
      className="flex flex-col items-center touch-pan-y select-none"
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const st = start.current;
        start.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(index + (dx < 0 ? 1 : -1));
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <div className="w-full flex items-center justify-between h-12 pt-[max(env(safe-area-inset-top),10px)] box-content">
        <button
          onClick={() => router.push("/gym/calorias")}
          aria-label="Volver a Calorías"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
          style={{ background: "#0d0d0d", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <h1 className="flex-1 text-center text-[15px] uppercase tracking-[0.12em] text-white truncate px-2" style={MONO_FONT}>
          {SECTIONS[index].label}
        </h1>
        <div className="w-10 h-10 shrink-0" aria-hidden />
      </div>
      <div className="h-5 flex items-center justify-center gap-1" style={MONO_FONT}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => goTo(i)}
            aria-label={`Ir a ${s.label}`}
            className="w-4 h-4 flex items-center justify-center cursor-pointer"
          >
            <span
              className="rounded-full transition-all"
              style={{
                width: i === index ? 7 : 5,
                height: i === index ? 7 : 5,
                background: i === index ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            />
          </button>
        ))}
      </div>
    </header>
  );
}
