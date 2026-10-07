"use client";

import { useEffect, useState } from "react";

const KEYBOARD_MIN_PX = 120;

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(el.type);
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Altura del teclado en pantalla vía `visualViewport` (iOS Safari no achica el viewport de layout cuando sube el
 * teclado, Android Chrome sí con `interactive-widget=resizes-content`; esto cubre los dos casos).
 *
 * Mientras el teclado está abierto y se está escribiendo, publica en `<html>`:
 *   --vv-h   alto visible (para `height: var(--vv-h, 100dvh)`)
 *   --vv-top desplazamiento superior del viewport visual (para `top: var(--vv-top, 0px)`)
 *   --kb-h   alto del teclado
 * Al cerrarse (o al hacer zoom con los dedos, que NO es teclado) quita las variables y el CSS vuelve a su valor normal.
 * Devuelve `keyboardOpen` para pantallas que quieran compactarse.
 */
export function useKeyboardInset(): { keyboardOpen: boolean } {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let baseline = Math.max(window.innerHeight, vv.height + vv.offsetTop);
    let raf = 0;
    let lastOpen = false;

    const clear = () => {
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--kb-h");
    };

    const update = () => {
      raf = 0;
      const typing = isTyping(document.activeElement);
      // Sin teclado el alto "normal" puede cambiar (barra del navegador, giro): se vuelve a medir.
      if (!typing) baseline = Math.max(window.innerHeight, vv.height + vv.offsetTop);
      const kb = Math.max(0, Math.round(baseline - vv.height - vv.offsetTop));
      const open = typing && kb > KEYBOARD_MIN_PX;
      if (open) {
        root.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
        root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
        root.style.setProperty("--kb-h", `${kb}px`);
      } else {
        clear();
      }
      if (open !== lastOpen) {
        lastOpen = open;
        setKeyboardOpen(open);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // iOS anima el teclado ~250 ms: se vuelve a medir al final del foco.
    const onFocusChange = () => {
      schedule();
      window.setTimeout(schedule, 320);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", onFocusChange);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", onFocusChange);
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      clear();
    };
  }, []);

  return { keyboardOpen };
}
