"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis, X } from "lucide-react";

export const SURFACE = "#1c1c1e";
export const CARD = "#2b2b2e";
export const CHIP = "#3b3b3f";
export const MUTED = "rgba(255,255,255,0.5)";

export function RoundButton({ children, onClick, label, size = 40, light }: { children: ReactNode; onClick?: () => void; label: string; size?: number; light?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center rounded-full cursor-pointer shrink-0 active:scale-95 transition-transform"
      style={{ width: size, height: size, background: light ? "rgba(120,120,120,0.85)" : "#4a4a4e", color: "#fff" }}
    >
      {children}
    </button>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Muestra el botón "•••" (abre lo que pase en `onMore`). */
  onMore?: () => void;
  children: ReactNode;
  z?: number;
  /** Alto máximo en px (por defecto se ajusta al contenido). */
  maxHeight?: string;
}

/** Hoja inferior de la Agenda: sobre el contenido, con fondo atenuado. Se cierra con la X o tocando afuera. */
export function Sheet({ open, onClose, title, onMore, children, z = 70, maxHeight = "86%" }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 flex flex-col justify-end" style={{ zIndex: z }} initial="hidden" animate="shown" exit="hidden">
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            className="relative mx-2 mb-2 overflow-y-auto"
            style={{ background: CARD, borderRadius: 32, padding: 20, maxHeight, boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
            variants={{ hidden: { y: "100%" }, shown: { y: 0 } }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            {(title || onMore) && (
              <div className="flex items-center justify-between mb-3 gap-3">
                <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
                <div className="flex items-center gap-2">
                  {onMore && (
                    <RoundButton label="Más opciones" onClick={onMore}>
                      <Ellipsis size={20} />
                    </RoundButton>
                  )}
                  <RoundButton label="Cerrar" onClick={onClose}>
                    <X size={20} strokeWidth={2.6} />
                  </RoundButton>
                </div>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
