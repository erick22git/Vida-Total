"use client";

/*============================================================

    GLASS ENGINE
    USE-GLASS-MENU.TS

    Hook de React que monta un GlassMenu vainilla sobre el nodo
    referenciado por `ref` (el contenedor `.glass-menu`) y lo
    destruye al desmontar. Cuando cambia `activeIndex` (porque
    Next.js navegó a otra ruta vía <Link>, ver bottom-nav.tsx),
    llama a `instance.select(activeIndex)` + `syncToActive(false)`
    para retargetear los resortes hacia el nuevo ítem — el propio
    motor produce la animación/overshoot, no React.

    [GLASS ENGINE — CONSUMIDOR — PORTADO TAL CUAL desde
    C:\Erick\Gym\useGlassMenu.js] Única adaptación real: tipos de
    TypeScript y el import relativo a ./menu (en vez de
    ./core/menu.js).

============================================================*/

import { useCallback, useEffect, useRef, type RefObject } from "react";
import GlassMenu, { type GlassMenuOptions } from "./menu";

export function useGlassMenu(
  ref: RefObject<HTMLElement | null>,
  activeIndex: number,
  options?: GlassMenuOptions,
) {
  const instanceRef = useRef<GlassMenu | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const instance = new GlassMenu(ref.current, options);

    instanceRef.current = instance;

    return () => {
      instance.destroy();

      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (instanceRef.current && activeIndex >= 0) {
      instanceRef.current.select(activeIndex);

      instanceRef.current.syncToActive(false);
    }
  }, [activeIndex]);

  const hoverAt = useCallback((index: number) => {
    instanceRef.current?.hoverAt(index);
  }, []);

  const hoverRelease = useCallback(() => {
    instanceRef.current?.hoverRelease();
  }, []);

  return { hoverAt, hoverRelease };
}
