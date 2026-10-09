"use client";

/**
 * Modal/sheet negro desplegable — reemplaza a `GlassModal` (ver docs/diseno.md, sección "Modales
 * desplegables"). Mismo contrato de props que `GlassModal` (`open`, `onClose`, `title`, `headerStart`,
 * `children`) para poder migrar cada caso solo cambiando el import, sin tocar su lógica/formularios.
 *
 * Diferencias con GlassModal: fondo NEGRO sólido (sin vidrio/blur), radios más grandes, resorte más
 * "vivo" al entrar/salir (investigado en libraries.dev — ningún paquete de ahí hace esto; los valores
 * de abajo son propios, ver Fase 1 del prompt), arrastrar para cerrar, trampa de foco, `--vv-h` del
 * teclado, sonido+háptica de abrir/cerrar, y con `prefers-reduced-motion` SOLO hace fundido (sin mover
 * ni escalar nada).
 */
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { playEvent } from "@/lib/sound/sound-manager";
import { haptic } from "@/lib/haptics/haptic";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";

export interface ExpandSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Contenido extra en el header, a la izquierda del título (p.ej. un botón de ajustes). */
  headerStart?: React.ReactNode;
  children: React.ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
/** Umbral de arrastre hacia abajo para cerrar (px) o velocidad (px/s). */
const DRAG_CLOSE_OFFSET = 120;
const DRAG_CLOSE_VELOCITY = 600;

export function ExpandSheet({ open, onClose, title, headerStart, children }: ExpandSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(open);
  const reduceMotion = useEffectiveReduceMotion();
  useKeyboardInset();

  // Sonido + háptica de abrir/cerrar (una vez por transición, no en cada render).
  useEffect(() => {
    if (open && !wasOpen.current) {
      void playEvent("modal-open");
      haptic("light");
    } else if (!open && wasOpen.current) {
      void playEvent("modal-close");
      haptic("light");
    }
    wasOpen.current = open;
  }, [open]);

  // Escape, scroll lock, trampa de foco y devolver el foco a quien abrió el sheet al cerrar.
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus({ preventScroll: true });
    };
    const id = window.setTimeout(focusFirst, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      lastFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  function handleDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY) onClose();
  }

  const panelTransition = reduceMotion ? { duration: 0.15 } : { type: "spring" as const, damping: 30, stiffness: 360, mass: 0.9 };
  const panelVariants = reduceMotion
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 56, scale: 0.96 }, shown: { opacity: 1, y: 0, scale: 1 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 flex items-end md:items-center md:justify-center"
          style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.2 }}
        >
          <motion.div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            variants={panelVariants}
            initial="hidden"
            animate="shown"
            exit="hidden"
            transition={panelTransition}
            className="relative w-full md:max-w-lg max-h-[88vh] md:max-h-[85vh] rounded-t-[32px] md:rounded-[32px] overflow-hidden flex flex-col outline-none"
            style={{ background: "#0b0b0c", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 18px 60px rgba(0,0,0,0.75)" }}
          >
            <div className="flex md:hidden justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            {(title || headerStart) && (
              <div className="flex items-center justify-between px-5 py-3 md:py-4 shrink-0 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
                <div className="flex items-center gap-2 min-w-0">
                  {headerStart}
                  <h3 className="text-base md:text-lg font-semibold text-white truncate">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="flex items-center justify-center w-11 h-11 -mr-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 py-4 grow overscroll-contain pb-[max(env(safe-area-inset-bottom),16px)]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
