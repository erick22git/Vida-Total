"use client";

import { useEffect, useRef } from "react";
import { animationEngine } from "./animation-engine";
import type { AnimationEvent } from "./types";

/**
 * Suscribe un componente a los eventos del Animation Engine. El handler se
 * guarda en un ref para que el efecto no tenga que re-suscribirse cada vez
 * que el componente vuelve a renderizar con una función inline nueva.
 */
export function useAnimationEvent(handler: (event: AnimationEvent) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    return animationEngine.subscribe((event) => handlerRef.current(event));
  }, []);
}
