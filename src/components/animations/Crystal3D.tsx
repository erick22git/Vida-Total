"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ProgressCrystal, type CrystalState } from "@/components/animations/ProgressCrystal";
import type { SceneProps } from "@/components/animations/CrystalScene";

// three.js solo se descarga cuando se abre la vista FIGURA (nunca en el
// bundle general) y solo en el cliente.
const CrystalScene = dynamic(() => import("@/components/animations/CrystalScene"), {
  ssr: false,
  loading: () => null,
});

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Cristal de progreso 3D con respaldo: si el dispositivo no soporta WebGL
 * cae al cristal SVG de siempre (`ProgressCrystal`), así la vista FIGURA
 * nunca queda vacía.
 */
export function Crystal3D({
  size,
  fallbackState,
  ...scene
}: SceneProps & { size: number; fallbackState: CrystalState }) {
  const [supported] = useState(webglAvailable);

  if (!supported) return <ProgressCrystal state={fallbackState} reduceMotion={scene.reduceMotion} size={size} />;

  return (
    <div style={{ width: size, height: size }} aria-label="Cristal de progreso" role="img">
      <CrystalScene {...scene} />
    </div>
  );
}
