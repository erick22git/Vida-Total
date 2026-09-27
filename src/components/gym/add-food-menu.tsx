"use client";

/**
 * Menú para agregar comida (rediseño Calorías, etapa 5): Recetas / Lista / Buscar / Escáner / Voz, en
 * scroll horizontal, estética oscura provisional (Not Boring, sin fotos de referencia todavía — colores
 * y tipografía finales pendientes). Se abre desde el "+" de la home nueva de una comida (etapa 2).
 */
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, List, Search, ScanLine, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MealType } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";

const OPTIONS = [
  { key: "recetas", label: "Recetas", icon: BookOpen, href: (meal: MealType) => `/gym/calorias/recetas?meal=${meal}` },
  { key: "lista", label: "Lista", icon: List, href: () => `/gym/calorias/lista` },
  { key: "buscar", label: "Buscar", icon: Search, href: (meal: MealType) => `/gym/calorias/buscar-nuevo?meal=${meal}` },
  { key: "escaner", label: "Escáner", icon: ScanLine, href: () => `/gym/calorias/escaner` },
  { key: "voz", label: "Voz", icon: Mic, href: () => `/gym/calorias/voz` },
] as const;

export function AddFoodMenu({ open, onClose, meal }: { open: boolean; onClose: () => void; meal: MealType }) {
  const router = useRouter();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[71] rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),20px)] pt-5 px-4"
            style={{ backgroundColor: "#1c1c1c", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" aria-hidden />
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-3 px-1" style={MONO_FONT}>
              Agregar comida
            </p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
              {OPTIONS.map(({ key, label, icon: Icon, href }) => (
                <button
                  key={key}
                  onClick={() => {
                    onClose();
                    router.push(href(meal));
                  }}
                  className="shrink-0 w-24 h-24 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Icon size={26} className="text-white" />
                  <span className="text-[11px] font-medium text-white/80">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
